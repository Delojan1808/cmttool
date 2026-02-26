const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
    passport.use(
        new LocalStrategy(
            { usernameField: 'email', passwordField: 'password' },
            async (email, password, done) => {
                try {
                    // Match user
                    const user = await User.findOne({ email }).select('+password');
                    if (!user) {
                        return done(null, false, { message: 'Invalid credentials' });
                    }

                    // Match password
                    const isMatch = await user.comparePassword(password);
                    if (isMatch) {
                        return done(null, user);
                    } else {
                        return done(null, false, { message: 'Invalid credentials' });
                    }
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    // Serialize user instance to session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user instance from session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};
