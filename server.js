require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const paperRoutes = require('./routes/paperRoutes');
const fieldRoutes = require('./routes/fieldRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const conferenceRoutes = require('./routes/conferenceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Passport config
require('./config/passport')(passport);

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:4173'], // Enable CORS for Vite frontend dev servers and preview
    credentials: true // Allow cookies to be sent
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/fields', fieldRoutes); // Mount fields API
app.use('/api/reviews', reviewRoutes);
app.use('/api/conferences', conferenceRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'CMT Backend API is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Multer error handling middleware
app.use((err, req, res, next) => {
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                message: 'File size too large. Maximum size is 10MB'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next(err);
});

// General error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
