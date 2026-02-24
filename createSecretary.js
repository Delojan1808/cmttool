require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Script to manually create a Secretary (admin) account
const createSecretary = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Secretary account details
        const secretaryData = {
            name: 'Admin Secretary',
            email: 'admin@cmt.com',
            password: 'Admin@123',
            role: 'Secretary'
        };

        // Check if Secretary already exists
        const existingSecretary = await User.findOne({ email: secretaryData.email });
        if (existingSecretary) {
            console.log(`❌ Secretary account already exists with email: ${secretaryData.email}`);
            process.exit(0);
        }

        // Create Secretary account
        const secretary = await User.create(secretaryData);

        console.log('✅ Secretary account created successfully!');
        console.log('------------------------------------------');
        console.log(`Name: ${secretary.name}`);
        console.log(`Email: ${secretary.email}`);
        console.log(`Role: ${secretary.role}`);
        console.log(`ID: ${secretary._id}`);
        console.log('------------------------------------------');
        console.log('Default password: Admin@123');
        console.log('⚠️  Please change this password after first login!');

        process.exit(0);
    } catch (error) {
        console.error('Error creating Secretary account:', error.message);
        process.exit(1);
    }
};

createSecretary();
