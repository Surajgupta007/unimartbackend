const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WEBP files are allowed.'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// @route   GET api/products
// @desc    Get all products with filters
// @access  Public
router.get('/', async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, condition } = req.query;
        let filters = {};

        if (search) {
            filters.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (category) {
            filters.category = category;
        }

        if (condition) {
            filters.condition = condition;
        }

        if (minPrice || maxPrice) {
            filters.price = {};
            if (minPrice) filters.price.$gte = parseFloat(minPrice);
            if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
        }

        const products = await Product.find(filters)
            .populate('seller', 'name email _id')
            .sort({ createdAt: -1 });

        // Get Review model
        const Review = require('../models/Review');

        // Add average rating to each product
        const productsWithRatings = await Promise.all(
            products.map(async (product) => {
                const reviews = await Review.find({ product: product._id });
                const averageRating = reviews.length > 0
                    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                    : 0;
                
                const productObj = product.toObject();
                productObj.averageRating = parseFloat(averageRating);
                productObj.reviewCount = reviews.length;
                return productObj;
            })
        );

        res.json(productsWithRatings);
    } catch (err) {
        console.error('Error fetching products from DB:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET api/products/:id
// @desc    Get single product by ID with reviews
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('seller', 'name email _id');

        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        // Get reviews for this product
        const reviews = require('../models/Review');
        const productReviews = await reviews.find({ product: req.params.id });
        
        // Calculate average rating
        const averageRating = productReviews.length > 0
            ? (productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)
            : 0;

        const productObj = product.toObject();
        productObj.averageRating = parseFloat(averageRating);
        productObj.reviewCount = productReviews.length;

        res.json(productObj);
    } catch (err) {
        console.error('Error fetching single product:', err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Product not found' });
        }
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/products
// @desc    Create a new product with images and specifications
// @access  Private (Authenticated users only)
router.post('/', auth, (req, res, next) => {
    upload.array('images', 10)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ msg: 'File size too large. Max 10MB per image.' });
            }
            return res.status(400).json({ msg: err.message });
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(400).json({ msg: err.message });
        }
        
        // Continue to the next middleware/route handler
        next();
    });
}, async (req, res) => {
    try {
        const { title, description, price, category, condition, meetingLocation, specifications } = req.body;

        console.log('[DEBUG] Received form data:', { title, description, price, category, condition, meetingLocation });
        console.log('[DEBUG] Files received:', req.files?.length || 0);

        // Validate required fields (meetingLocation is optional)
        if (!title || !description || !price || !category || !condition) {
            // Clean up uploaded files if validation fails
            if (req.files) {
                req.files.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            return res.status(400).json({ msg: 'Please provide all required fields: title, description, price, category, condition' });
        }

        // Check if at least 3 images are uploaded
        if (!req.files || req.files.length < 3) {
            // Clean up uploaded files
            if (req.files) {
                req.files.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            return res.status(400).json({ msg: `Please upload at least 3 product images. You uploaded ${req.files?.length || 0}` });
        }

        // Parse specifications from JSON string if provided
        let specificationsMap = new Map();
        if (specifications) {
            try {
                const specsObj = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
                specificationsMap = new Map(Object.entries(specsObj));
            } catch (err) {
                console.error('Error parsing specifications:', err);
            }
        }

        // Get image file paths
        const images = req.files.map(file => `/uploads/${file.filename}`);

        // Create product
        const newProduct = new Product({
            title,
            description,
            price: parseFloat(price),
            category,
            condition,
            campus: 'Lovely Professional University',
            meetingLocation,
            images,
            image: images[0], // Set first image as primary for backward compatibility
            specifications: specificationsMap,
            seller: req.user.id
        });

        const product = await newProduct.save();
        console.log('[DEBUG] Product created successfully:', product._id);
        res.status(201).json(product);
    } catch (err) {
        console.error('[ERROR] Error creating product:', err.message);
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, err => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
        }
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   DELETE api/products/:id
// @desc    Delete a product
// @access  Private (Product owner only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ msg: 'Product not found' });
        }

        if (product.seller.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized to delete this product' });
        }

        // Delete associated images from filesystem
        if (product.images && product.images.length > 0) {
            product.images.forEach(imagePath => {
                const fullPath = path.join(__dirname, '..' + imagePath);
                fs.unlink(fullPath, err => {
                    if (err) console.error('Error deleting image:', err);
                });
            });
        }

        await Product.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
