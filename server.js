const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://unimart-chi.vercel.app', 'https://unimart-n1y41yp1z-sumits-projects-dfda4785.vercel.app', process.env.FRONTEND_URL || '*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization']
}));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.send('API Running'));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/bookings', require('./routes/bookings'));

const PORT = process.env.PORT || 5000;

// Only start the server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

// Export for Vercel serverless
module.exports = app;
