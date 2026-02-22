const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/unmart')
    .then(async () => {
        console.log('MongoDB Connected');
        
        try {
            const result = await Product.deleteMany({});
            console.log(`✓ Deleted ${result.deletedCount} products from database`);
            console.log('Database is now clean!');
            process.exit(0);
        } catch (err) {
            console.error('Error deleting products:', err);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('Database Connection Error:', err);
        process.exit(1);
    });
