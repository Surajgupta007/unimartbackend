const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// @route   GET api/wishlist
// @desc    Get user's wishlist
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let wishlist = await Wishlist.findOne({ user: req.user.id }).populate('products');
        if (!wishlist) {
            wishlist = new Wishlist({ user: req.user.id, products: [] });
            await wishlist.save();
        }
        res.json(wishlist);
    } catch (err) {
        console.error('Error fetching wishlist:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/wishlist/add
// @desc    Add product to wishlist
// @access  Private
router.post('/add', auth, async (req, res) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ msg: 'Product ID required' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        let wishlist = await Wishlist.findOne({ user: req.user.id });
        if (!wishlist) {
            wishlist = new Wishlist({ user: req.user.id, products: [] });
        }

        if (wishlist.products.includes(productId)) {
            return res.status(400).json({ msg: 'Product already in wishlist' });
        }

        wishlist.products.push(productId);
        wishlist.updatedAt = Date.now();
        await wishlist.save();
        await wishlist.populate('products');

        res.json(wishlist);
    } catch (err) {
        console.error('Error adding to wishlist:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/wishlist/remove/:productId
// @desc    Remove product from wishlist
// @access  Private
router.delete('/remove/:productId', auth, async (req, res) => {
    try {
        let wishlist = await Wishlist.findOne({ user: req.user.id });
        if (!wishlist) {
            return res.status(404).json({ msg: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(id => id.toString() !== req.params.productId);
        wishlist.updatedAt = Date.now();
        await wishlist.save();
        await wishlist.populate('products');

        res.json(wishlist);
    } catch (err) {
        console.error('Error removing from wishlist:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
