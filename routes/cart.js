const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// @route   GET api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (!cart) {
            cart = new Cart({ user: req.user.id, items: [] });
            await cart.save();
        }
        res.json(cart);
    } catch (err) {
        console.error('Error fetching cart:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/cart/add
// @desc    Add product to cart
// @access  Private
router.post('/add', auth, async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({ msg: 'Product ID and quantity required' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            cart = new Cart({ user: req.user.id, items: [] });
        }

        const existingItem = cart.items.find(item => item.product.toString() === productId);
        if (existingItem) {
            existingItem.quantity += parseInt(quantity);
        } else {
            cart.items.push({ product: productId, quantity: parseInt(quantity) });
        }

        cart.updatedAt = Date.now();
        await cart.save();
        await cart.populate('items.product');

        res.json(cart);
    } catch (err) {
        console.error('Error adding to cart:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   PUT api/cart/update/:productId
// @desc    Update product quantity in cart
// @access  Private
router.put('/update/:productId', auth, async (req, res) => {
    try {
        const { quantity } = req.body;

        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            return res.status(404).json({ msg: 'Cart not found' });
        }

        const item = cart.items.find(item => item.product.toString() === req.params.productId);
        if (!item) {
            return res.status(404).json({ msg: 'Product not in cart' });
        }

        if (quantity <= 0) {
            cart.items = cart.items.filter(item => item.product.toString() !== req.params.productId);
        } else {
            item.quantity = quantity;
        }

        cart.updatedAt = Date.now();
        await cart.save();
        await cart.populate('items.product');

        res.json(cart);
    } catch (err) {
        console.error('Error updating cart:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/cart/remove/:productId
// @desc    Remove product from cart
// @access  Private
router.delete('/remove/:productId', auth, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            return res.status(404).json({ msg: 'Cart not found' });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== req.params.productId);
        cart.updatedAt = Date.now();
        await cart.save();
        await cart.populate('items.product');

        res.json(cart);
    } catch (err) {
        console.error('Error removing from cart:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete('/clear', auth, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) {
            return res.status(404).json({ msg: 'Cart not found' });
        }

        cart.items = [];
        cart.updatedAt = Date.now();
        await cart.save();

        res.json(cart);
    } catch (err) {
        console.error('Error clearing cart:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
