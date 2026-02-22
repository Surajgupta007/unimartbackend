const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
        type: String,
        required: true,
        enum: ['Books', 'Electronics', 'Furniture', 'Fashion', 'Hostel Essentials', 'Notes & Study Materials']
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Like New', 'Used']
    },
    campus: { type: String, default: 'Lovely Professional University' },
    meetingLocation: { type: String, default: null },
    image: { type: String },
    images: {
        type: [String],
        validate: {
            validator: function(v) {
                return v.length >= 3;
            },
            message: 'At least 3 product images are required'
        }
    },
    specifications: {
        type: Map,
        of: String,
        default: new Map()
    },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
        type: String,
        enum: ['available', 'pending_confirmation', 'meeting_scheduled', 'sold'],
        default: 'available'
    },
    bookingTimestamp: { type: Date, default: null },
    meetingDetails: {
        proposedLocation: String,
        proposedTime: String,
        chatEnabled: { type: Boolean, default: true }
    },
    paymentConfirmed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
