const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/unmart')
    .then(() => console.log('MongoDB Connected for Seeding'))
    .catch(err => {
        console.error('Database Connection Error:', err);
        process.exit(1);
    });

const seedProducts = [
    {
        title: 'Introduction to Algorithms 3rd Edition',
        description: 'Barely used textbook for CS301. No highlights.',
        price: 45,
        category: 'Books',
        condition: 'Like New',
        campus: 'North Campus',
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80',
        seller: new mongoose.Types.ObjectId()
    },
    {
        title: 'IKEA Study Desk & Chair',
        description: 'Moving out sale! Great condition wooden desk with rolling ergonomic chair.',
        price: 60,
        category: 'Furniture',
        condition: 'Used',
        campus: 'South Campus',
        rating: 4.5,
        image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&q=80',
        seller: new mongoose.Types.ObjectId()
    },
    {
        title: 'Casio fx-991EX Scientific Calculator',
        description: 'Approved for engineering exams. Works perfectly.',
        price: 15,
        category: 'Electronics',
        condition: 'New',
        campus: 'Main Campus',
        rating: 5.0,
        image: 'https://images.unsplash.com/photo-1611077544669-7eecc7a950db?auto=format&fit=crop&q=80',
        seller: new mongoose.Types.ObjectId()
    },
    {
        title: 'Apple iPad Air (4th Gen) 64GB',
        description: 'Used for taking notes. Comes with Apple Pencil 2.',
        price: 350,
        category: 'Electronics',
        condition: 'Like New',
        campus: 'North Campus',
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80',
        seller: new mongoose.Types.ObjectId()
    },
    {
        title: 'Mini Fridge (Whirlpool 90L)',
        description: 'Perfect size for hostel rooms. Quite operation.',
        price: 85,
        category: 'Hostel Essentials',
        condition: 'Used',
        campus: 'East Campus',
        rating: 4.2,
        image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&q=80',
        seller: new mongoose.Types.ObjectId()
    },
    {
        title: 'Data Structures Compilation Notes',
        description: 'Handwritten scanned notes for the entire semester. Very helpful for finals.',
        price: 10,
        category: 'Notes & Study Materials',
        condition: 'New',
        campus: 'Main Campus',
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80',
        seller: new mongoose.Types.ObjectId()
    }
];

const importData = async () => {
    try {
        await Product.deleteMany(); // Clear existing products
        await Product.insertMany(seedProducts);
        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

importData();
