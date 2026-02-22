const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// @route   POST api/bookings
// @desc    Create a new booking request
// @access  Private (Buyer)
router.post('/', auth, async (req, res) => {
    try {
        const { productId, proposedLocation, proposedTime } = req.body;

        // Validate product exists
        const product = await Product.findById(productId).populate('seller', 'name email');
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        // Check if product is available
        if (product.status !== 'available') {
            return res.status(400).json({ msg: 'Product is not available for booking' });
        }

        // Check if buyer is not the seller
        if (product.seller._id.toString() === req.user.id) {
            return res.status(400).json({ msg: 'You cannot book your own product' });
        }

        // Check if this product already has a pending booking
        const existingBooking = await Booking.findOne({
            product: productId,
            status: { $in: ['pending_confirmation', 'confirmed'] }
        });

        if (existingBooking) {
            return res.status(400).json({ msg: 'This product already has an active booking' });
        }

        // Create booking
        const booking = new Booking({
            product: productId,
            buyer: req.user.id,
            seller: product.seller._id,
            status: 'pending_confirmation',
            productStatus: 'pending_confirmation',
            meetingDetails: {
                proposedLocation: proposedLocation || product.meetingLocation,
                proposedTime: proposedTime || 'To be decided',
                chatEnabled: true
            }
        });

        await booking.save();

        // Update product status
        product.status = 'pending_confirmation';
        product.buyerId = req.user.id;
        product.bookingTimestamp = new Date();
        product.meetingDetails = booking.meetingDetails;
        await product.save();

        // Populate for response
        await booking.populate('buyer', 'name email');
        await booking.populate('product', 'title price images');

        // Create notification for seller
        try {
            const buyerData = await require('../models/User').findById(req.user.id).select('name email');
            const notification = new Notification({
                seller: product.seller._id,
                buyer: req.user.id,
                product: productId,
                booking: booking._id,
                type: 'booking_request',
                title: `New Booking for ${product.title}`,
                message: `${buyerData.name} wants to book your ${product.title}. Proposed meeting: ${proposedLocation || 'TBD'}`,
                isRead: false
            });
            await notification.save();
            console.log('[DEBUG] Booking notification created for seller:', product.seller._id);
        } catch (notifyErr) {
            console.error('[ERROR] Failed to create notification:', notifyErr.message);
        }

        res.status(201).json({
            msg: 'Booking request sent to seller',
            booking
        });
    } catch (err) {
        console.error('Error creating booking:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// @route   GET api/bookings/seller/requests
// @desc    Get all booking requests for seller
// @access  Private (Seller)
router.get('/seller/requests', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ seller: req.user.id })
            .populate('buyer', 'name email')
            .populate('product', 'title price images meetingLocation')
            .sort({ createdAt: -1 });

        res.json(bookings);
    } catch (err) {
        console.error('Error fetching booking requests:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   GET api/bookings/buyer
// @desc    Get all bookings for buyer
// @access  Private (Buyer)
router.get('/buyer/my-bookings', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ buyer: req.user.id })
            .populate('seller', 'name email phone')
            .populate('product', 'name price images status')
            .sort({ createdAt: -1 });

        res.json(bookings);
    } catch (err) {
        console.error('Error fetching buyer bookings:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   PUT api/bookings/:id/confirm-meeting
// @desc    Seller confirms the booking and schedules meeting
// @access  Private (Seller)
router.put('/:id/confirm-meeting', auth, async (req, res) => {
    try {
        const { confirmedLocation, confirmedTime } = req.body;

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        // Check if seller
        if (booking.seller.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // Check if booking is pending
        if (booking.status !== 'pending_confirmation') {
            return res.status(400).json({ msg: 'Can only confirm pending bookings' });
        }

        // Update booking
        booking.status = 'confirmed';
        booking.productStatus = 'meeting_scheduled';
        booking.confirmedAt = new Date();
        booking.meetingDetails.confirmedLocation = confirmedLocation || booking.meetingDetails.proposedLocation;
        booking.meetingDetails.confirmedTime = confirmedTime || booking.meetingDetails.proposedTime;
        await booking.save();

        // Update product
        const product = await Product.findById(booking.product);
        product.status = 'meeting_scheduled';
        product.meetingLocation = booking.meetingDetails.confirmedLocation;
        product.meetingDetails = booking.meetingDetails;
        await product.save();

        // Create notification for buyer
        try {
            const sellerData = await require('../models/User').findById(req.user.id).select('name email');
            const notification = new Notification({
                seller: req.user.id,
                buyer: booking.buyer,
                product: booking.product,
                booking: booking._id,
                type: 'booking_confirmed',
                title: 'Meeting Confirmed',
                message: `${sellerData.name} has confirmed the meeting at ${booking.meetingDetails.confirmedLocation} on ${booking.meetingDetails.confirmedTime}. Prepare for payment.`,
                isRead: false
            });
            await notification.save();
            console.log('[DEBUG] Confirmation notification created for buyer:', booking.buyer);
        } catch (notifyErr) {
            console.error('[ERROR] Failed to create notification:', notifyErr.message);
        }

        await booking.populate('buyer', 'name email');
        await booking.populate('product', 'title price');

        res.json({
            msg: 'Meeting confirmed. Buyer has been notified.',
            booking
        });
    } catch (err) {
        console.error('Error confirming meeting:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// @route   PUT api/bookings/:id/reject
// @desc    Seller rejects the booking
// @access  Private (Seller)
router.put('/:id/reject', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        // Check if seller
        if (booking.seller.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // Check if booking is pending
        if (booking.status !== 'pending_confirmation') {
            return res.status(400).json({ msg: 'Can only reject pending bookings' });
        }

        // Update booking
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        await booking.save();

        // Reset product
        const product = await Product.findById(booking.product);
        product.status = 'available';
        product.buyerId = null;
        product.bookingTimestamp = null;
        await product.save();

        // Create notification for buyer
        try {
            const sellerData = await require('../models/User').findById(req.user.id).select('name email');
            const notification = new Notification({
                seller: req.user.id,
                buyer: booking.buyer,
                product: booking.product,
                booking: booking._id,
                type: 'booking_rejected',
                title: 'Booking Rejected',
                message: `${sellerData.name} has declined your booking request for this product. It is now available for other buyers.`,
                isRead: false
            });
            await notification.save();
            console.log('[DEBUG] Rejection notification created for buyer:', booking.buyer);
        } catch (notifyErr) {
            console.error('[ERROR] Failed to create notification:', notifyErr.message);
        }

        res.json({
            msg: 'Booking rejected. Buyer has been notified. Product is now available again.',
            booking
        });
    } catch (err) {
        console.error('Error rejecting booking:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// @route   PUT api/bookings/:id/confirm-payment
// @desc    Buyer confirms payment after meeting
// @access  Private (Buyer)
router.put('/:id/confirm-payment', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        // Check if buyer
        if (booking.buyer.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Only the buyer can confirm payment' });
        }

        // Check if booking is confirmed
        if (booking.status !== 'confirmed') {
            return res.status(400).json({ msg: 'Can only confirm payment for confirmed bookings' });
        }

        // Update booking
        booking.paymentConfirmed = true;
        booking.paymentConfirmedAt = new Date();
        booking.completedAt = new Date();
        await booking.save();

        // Mark product as sold
        const product = await Product.findById(booking.product);
        product.status = 'sold';
        product.paymentConfirmed = true;
        await product.save();

        // Create notification for seller
        try {
            const buyerData = await require('../models/User').findById(req.user.id).select('name email');
            const notification = new Notification({
                seller: booking.seller,
                buyer: req.user.id,
                product: booking.product,
                booking: booking._id,
                type: 'payment_confirmed',
                title: 'Payment Confirmed - Sale Complete',
                message: `${buyerData.name} has confirmed payment for ${product.title}. Your item has been marked as sold.`,
                isRead: false
            });
            await notification.save();
            console.log('[DEBUG] Payment confirmation notification created for seller:', booking.seller);
        } catch (notifyErr) {
            console.error('[ERROR] Failed to create notification:', notifyErr.message);
        }

        await booking.populate('buyer', 'name email');
        await booking.populate('seller', 'name email');
        await booking.populate('product', 'title price');

        res.json({
            msg: 'Payment confirmed! Product marked as sold.',
            booking
        });
    } catch (err) {
        console.error('Error confirming payment:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// @route   GET api/bookings/:id
// @desc    Get booking details
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('buyer', 'name email')
            .populate('seller', 'name email')
            .populate('product', 'title price images meetingLocation');

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        // Check authorization
        if (booking.buyer.toString() !== req.user.id && booking.seller.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        res.json(booking);
    } catch (err) {
        console.error('Error fetching booking:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
