const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const user = await User.findOne({ email: 'delojan1@gmail.com' });
        if (!user) {
            console.log('User not found!');
            process.exit(1);
        }

        // Setting raw password, the userSchema.pre('save') will hash it securely.
        user.password = 'password123';
        await user.save();

        console.log('Successfully updated password via Mongoose save() hook!');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
