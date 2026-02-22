const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// @route   GET api/reviews/product/:productId
// @desc    Get all reviews for a product
// @access  Public
router.get('/product/:productId', async (req, res) => {
    try {
        const reviews = await Review.find({ product: req.params.productId })
            .populate('user', 'name')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        console.error('Error fetching reviews:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/reviews
// @desc    Create a review
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { productId, rating, review } = req.body;

        if (!productId || !rating || !review) {
            return res.status(400).json({ msg: 'All fields required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ msg: 'Rating must be between 1 and 5' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        // Check if user already reviewed this product
        const existingReview = await Review.findOne({ product: productId, user: req.user.id });
        if (existingReview) {
            return res.status(400).json({ msg: 'You have already reviewed this product' });
        }

        const newReview = new Review({
            product: productId,
            user: req.user.id,
            rating,
            review
        });

        await newReview.save();
        await newReview.populate('user', 'name');

        res.status(201).json(newReview);
    } catch (err) {
        console.error('Error creating review:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/reviews/:reviewId
// @desc    Delete a review
// @access  Private
router.delete('/:reviewId', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ msg: 'Review not found' });
        }

        if (review.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await Review.findByIdAndDelete(req.params.reviewId);
        res.json({ msg: 'Review deleted' });
    } catch (err) {
        console.error('Error deleting review:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
