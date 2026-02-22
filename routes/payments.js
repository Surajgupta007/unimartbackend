const express = require('express');
const router = express.Router();

// Mock Razorpay Order Creation
router.post('/create-order', (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;

        // In a real app, initialize Razorpay instance here:
        // const instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_SECRET });

        // Respond with mock order details
        const orderData = {
            id: `mock_order_${Math.floor(Math.random() * 1000000)}`,
            entity: "order",
            amount: amount * 100, // Amount is in currency subunits
            amount_paid: 0,
            amount_due: amount * 100,
            currency: currency,
            receipt: receipt || "mock_receipt_1",
            status: "created",
            attempts: 0,
            created_at: Math.floor(Date.now() / 1000)
        };

        res.json(orderData);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error generating mock order');
    }
});

// Mock Payment Verification Callback
router.post('/verify-payment', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // In a real app, verify signature using crypto module:
        // const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET).update(razorpay_order_id + "|" + razorpay_payment_id).digest('hex');
        // if (generated_signature == razorpay_signature) { ... }

        // Mock successful verification
        res.json({
            status: 'success',
            msg: 'Payment verified successfully (MOCK)',
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id
        });
    } catch (error) {
        res.status(500).json({ status: 'failed', msg: 'Payment verification failed' });
    }
});

module.exports = router;
