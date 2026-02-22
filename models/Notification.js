const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    type: {
        type: String,
        enum: [
            'booking_request', 
            'booking_confirmed', 
            'booking_rejected',
            'buyer_confirmed', 
            'seller_confirmed', 
            'payment_completed',
            'payment_confirmed',
            'cancelled'
        ],
        default: 'booking_request'
    },
    title: String,
    message: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
