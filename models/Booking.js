const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Booking status flow
    status: {
        type: String,
        enum: ['pending_confirmation', 'confirmed', 'cancelled'],
        default: 'pending_confirmation'
    },
    
    // Product status at booking
    productStatus: {
        type: String,
        enum: ['available', 'pending_confirmation', 'meeting_scheduled', 'sold'],
        default: 'pending_confirmation'
    },
    
    // Meeting details
    meetingDetails: {
        proposedLocation: String,
        proposedTime: String,
        confirmedLocation: String,
        confirmedTime: String,
        chatEnabled: { type: Boolean, default: true }
    },
    
    // Payment
    paymentConfirmed: { type: Boolean, default: false },
    paymentConfirmedAt: { type: Date, default: null },
    
    // Timeline
    createdAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Booking', BookingSchema);
