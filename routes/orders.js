const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// @route   GET api/orders
// @desc    Get user's orders
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .populate('items.product')
            .populate('items.seller', 'name email upiNumber')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error('Error fetching orders:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET api/orders/:orderId
// @desc    Get single order
// @access  Private
router.get('/:orderId', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('items.product')
            .populate('items.seller', 'name email upiNumber');
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        if (order.user.toString() !== req.user.id && !order.items.some(item => item.seller.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        res.json(order);
    } catch (err) {
        console.error('Error fetching order:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/orders
// @desc    Create order from meeting confirmation page or cart
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { items, totalAmount, meetingLocation, buyerConfirmed, status } = req.body;

        // Check if it's from meeting confirmation page (new flow)
        if (items && Array.isArray(items) && items.length > 0) {
            // Create order with meeting details
            const orderItems = [];
            const sellerIds = new Set();

            for (const item of items) {
                // Handle both object and string/ID formats for product and seller
                const productId = item.product?._id || item.product;
                const sellerId = item.seller?._id || item.seller;
                
                if (productId && sellerId) {
                    orderItems.push({
                        product: productId,
                        seller: sellerId,
                        quantity: item.quantity || 1,
                        price: item.price || 0
                    });
                    sellerIds.add(sellerId);
                }
            }

            if (orderItems.length === 0) {
                return res.status(400).json({ msg: 'Invalid items data' });
            }

            const newOrder = new Order({
                user: req.user.id,
                items: orderItems,
                totalAmount: totalAmount || orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                meetingLocation,
                buyerConfirmed: buyerConfirmed || false,
                status: status || 'pending',
                paymentStatus: 'pending'
            });

            const savedOrder = await newOrder.save();
            await savedOrder.populate('items.product');
            await savedOrder.populate('items.seller', 'name email');

            // Create notifications for each unique seller
            for (const sellerId of sellerIds) {
                try {
                    // Find the first item for this seller to get product info
                    const sellerItem = savedOrder.items.find(item => 
                        (item.seller?._id?.toString() === sellerId || item.seller?.toString() === sellerId)
                    );
                    
                    if (sellerItem && sellerItem.product) {
                        const notification = new Notification({
                            seller: sellerId,
                            buyer: req.user.id,
                            product: sellerItem.product._id,
                            order: savedOrder._id,
                            type: 'booking_request',
                            title: `New Booking for ${sellerItem.product.title}`,
                            message: `A buyer wants to exchange your ${sellerItem.product.title}. Meet them at ${meetingLocation}.`,
                            isRead: false
                        });
                        await notification.save();
                        console.log('[DEBUG] Notification created for seller:', sellerId);
                    }
                } catch (notifyErr) {
                    console.error('[ERROR] Failed to create notification:', notifyErr.message);
                }
            }

            return res.status(201).json(savedOrder);
        }

        // Original cart-based flow
        const { shippingAddress } = req.body;

        if (!shippingAddress) {
            return res.status(400).json({ msg: 'Shipping address required' });
        }

        const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ msg: 'Cart is empty' });
        }

        // Calculate total
        let calculatedTotal = 0;
        const orderItems = [];

        for (const item of cart.items) {
            calculatedTotal += item.product.price * item.quantity;
            orderItems.push({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.price
            });
        }

        const order = new Order({
            user: req.user.id,
            items: orderItems,
            totalAmount: calculatedTotal,
            shippingAddress,
            paymentStatus: 'pending'
        });

        await order.save();
        await order.populate('items.product');

        // Clear cart
        cart.items = [];
        cart.updatedAt = Date.now();
        await cart.save();

        res.status(201).json(order);
    } catch (err) {
        console.error('Error creating order:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT api/orders/:orderId/status
// @desc    Update order status (seller only)
// @access  Private
router.put('/:orderId/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ msg: 'Status required' });
        }

        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        order.status = status;
        order.updatedAt = Date.now();
        await order.save();

        res.json(order);
    } catch (err) {
        console.error('Error updating order:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT api/orders/:orderId/confirm-payment
// @desc    Confirm payment received by seller
// @access  Private
router.put('/:orderId/confirm-payment', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        // Check if user is one of the sellers in this order
        const isSellerInOrder = order.items.some(item => 
            item.seller.toString() === req.user.id
        );

        if (!isSellerInOrder && order.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // If buyer confirms payment
        if (order.user.toString() === req.user.id) {
            order.paymentStatus = 'paid';
            order.status = 'paid';
            
            // Mark all products in this order as sold
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.product, { status: 'sold' });
            }
        } else {
            // If seller confirms payment received
            order.paymentStatus = 'paid';
            order.status = 'completed';
            
            // Mark all products in this order as sold
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.product, { status: 'sold' });
            }
        }

        order.updatedAt = Date.now();
        await order.save();

        res.json(order);
    } catch (err) {
        console.error('Error confirming payment:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/orders/:orderId
// @desc    Delete an order
// @access  Private
router.delete('/:orderId', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        // Check if user is authorized (order owner or seller)
        const isOwner = order.user.toString() === req.user.id;
        const isSeller = order.items.some(item => item.seller && item.seller.toString() === req.user.id);
        
        if (!isOwner && !isSeller) {
            return res.status(401).json({ msg: 'Not authorized to delete this order' });
        }

        await Order.findByIdAndDelete(req.params.orderId);
        
        res.json({ msg: 'Order deleted successfully' });
    } catch (err) {
        console.error('Error deleting order:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
