const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const user = await User.findOne({ email: 'delojan1@gmail.com' }).select('+password');
        if (!user) {
            console.log('User not found!');
            process.exit(1);
        }
        console.log('User found in DB:', user.email);
        console.log('Hashed password in DB:', user.password);

        const isMatch = await user.comparePassword('password123');
        console.log('Compare password123 result:', isMatch);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
