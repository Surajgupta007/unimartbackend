const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// @route   GET api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
// NOTE: Must come BEFORE /:id route to avoid being matched as GET /:id
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            seller: req.user.id,
            isRead: false
        });

        res.json({ unreadCount: count });
    } catch (err) {
        console.error('Error fetching unread count:', err);
        res.status(500).json({ msg: 'Error fetching unread count' });
    }
});

// @route   GET api/notifications
// @desc    Get all notifications for logged-in user (seller)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ seller: req.user.id })
            .populate('buyer', 'name email')
            .populate('product', 'title price')
            .populate('booking', 'status productStatus meetingDetails')
            .populate('order', 'status totalAmount meetingLocation')
            .sort({ createdAt: -1 });

        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ msg: 'Error fetching notifications' });
    }
});

// @route   PUT api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found' });
        }

        if (notification.seller.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized to update this notification' });
        }

        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();

        res.json(notification);
    } catch (err) {
        console.error('Error updating notification:', err);
        res.status(500).json({ msg: 'Error updating notification' });
    }
});

// @route   PUT api/notifications/:id/confirm-meeting
// @desc    Seller confirms they will meet the buyer
// @access  Private
router.put('/:id/confirm-meeting', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found' });
        }

        if (notification.seller.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // Check if this is a booking notification or order notification
        if (notification.booking) {
            // Handle booking confirmation
            const Booking = require('../models/Booking');
            const booking = await Booking.findById(notification.booking);

            if (!booking) {
                return res.status(404).json({ msg: 'Booking not found' });
            }

            if (booking.status !== 'pending_confirmation') {
                return res.status(400).json({ msg: 'Booking already processed' });
            }

            // Update booking
            booking.status = 'confirmed';
            booking.productStatus = 'meeting_scheduled';
            booking.confirmedAt = new Date();
            booking.meetingDetails.confirmedLocation = booking.meetingDetails.proposedLocation;
            booking.meetingDetails.confirmedTime = booking.meetingDetails.proposedTime;
            await booking.save();

            // Update product
            const Product = require('../models/Product');
            const product = await Product.findById(booking.product);
            if (product) {
                product.status = 'meeting_scheduled';
                product.meetingLocation = booking.meetingDetails.confirmedLocation;
                product.meetingDetails = booking.meetingDetails;
                await product.save();
            }

            // Create notification for buyer
            const User = require('../models/User');
            const sellerData = await User.findById(req.user.id).select('name email');
            const buyerNotification = new Notification({
                seller: req.user.id,
                buyer: notification.buyer,
                product: notification.product,
                booking: notification.booking,
                type: 'booking_confirmed',
                title: 'Meeting Confirmed',
                message: `${sellerData.name} has confirmed the meeting at ${booking.meetingDetails.confirmedLocation} on ${booking.meetingDetails.confirmedTime}. Prepare for payment.`,
                isRead: false
            });
            await buyerNotification.save();

            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();

            return res.json({ msg: 'Meeting confirmed successfully', booking });
        } else if (notification.type === 'booking_request' && !notification.booking) {
            // Handle old notifications created before booking field was added
            const Booking = require('../models/Booking');
            const booking = await Booking.findOne({
                product: notification.product,
                buyer: notification.buyer,
                seller: notification.seller,
                status: 'pending_confirmation'
            });

            if (!booking) {
                return res.status(404).json({ msg: 'Booking not found. It may have been cancelled or already processed.' });
            }

            // Update booking
            booking.status = 'confirmed';
            booking.productStatus = 'meeting_scheduled';
            booking.confirmedAt = new Date();
            booking.meetingDetails.confirmedLocation = booking.meetingDetails.proposedLocation;
            booking.meetingDetails.confirmedTime = booking.meetingDetails.proposedTime;
            await booking.save();

            // Update product
            const Product = require('../models/Product');
            const product = await Product.findById(booking.product);
            if (product) {
                product.status = 'meeting_scheduled';
                product.meetingLocation = booking.meetingDetails.confirmedLocation;
                product.meetingDetails = booking.meetingDetails;
                await product.save();
            }

            // Create notification for buyer
            const User = require('../models/User');
            const sellerData = await User.findById(req.user.id).select('name email');
            const buyerNotification = new Notification({
                seller: req.user.id,
                buyer: notification.buyer,
                product: notification.product,
                booking: booking._id,
                type: 'booking_confirmed',
                title: 'Meeting Confirmed',
                message: `${sellerData.name} has confirmed the meeting at ${booking.meetingDetails.confirmedLocation} on ${booking.meetingDetails.confirmedTime}. Prepare for payment.`,
                isRead: false
            });
            await buyerNotification.save();

            // Update the old notification to include booking reference
            notification.booking = booking._id;
            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();

            return res.json({ msg: 'Meeting confirmed successfully', booking });
        } else if (notification.order) {
            // Handle order confirmation (existing logic)
            const Order = require('../models/Order');
            const order = await Order.findById(notification.order);

            if (!order) {
                return res.status(404).json({ msg: 'Order not found' });
            }

            order.sellerConfirmed = true;
            order.status = 'product_confirmed';
            await order.save();

            // Create a notification for the buyer
            const buyerNotification = new Notification({
                seller: req.user.id,
                buyer: notification.buyer,
                product: notification.product,
                order: notification.order,
                type: 'seller_confirmed',
                title: 'Seller Confirmed Meeting',
                message: `The seller has confirmed they will meet you at the scheduled location to exchange the product.`,
                isRead: false
            });
            await buyerNotification.save();

            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();

            return res.json(order);
        } else {
            return res.status(400).json({ msg: 'Invalid notification type' });
        }
    } catch (err) {
        console.error('Error confirming meeting:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ msg: 'Error confirming meeting', error: err.message });
    }
});

// @route   DELETE api/notifications/clear-all
// @desc    Clear all notifications for logged-in user
// @access  Private
// NOTE: Must come BEFORE /:id route to avoid being matched as DELETE /:id
router.delete('/clear-all', auth, async (req, res) => {
    try {
        const result = await Notification.deleteMany({ seller: req.user.id });
        res.json({ msg: 'All notifications cleared', deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Error clearing notifications:', err);
        res.status(500).json({ msg: 'Error clearing notifications' });
    }
});

// @route   GET api/notifications/:id
// @desc    Get single notification details
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id)
            .populate('buyer', 'name email')
            .populate('product', 'title price meetingLocation images')
            .populate('booking', 'status productStatus meetingDetails')
            .populate('order', 'status totalAmount meetingLocation buyerConfirmed sellerConfirmed');

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found' });
        }

        if (notification.seller.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        res.json(notification);
    } catch (err) {
        console.error('Error fetching notification:', err);
        res.status(500).json({ msg: 'Error fetching notification' });
    }
});

module.exports = router;
