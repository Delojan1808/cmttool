const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
    passport.use(
        new LocalStrategy(
            { usernameField: 'email', passwordField: 'password' },
            async (email, password, done) => {
                try {
                    // Check for user
                    const user = await User.findOne({ email }).select('+password');

                    if (!user) {
                        return done(null, false, { message: 'Invalid credentials' });
                    }

                    // Check password
                    const isMatch = await user.comparePassword(password);

                    if (!isMatch) {
                        return done(null, false, { message: 'Invalid credentials' });
                    }

                    return done(null, user);
                } catch (err) {
                    console.error(err);
                    return done(err);
                }
            }
        )
    );

    // Serialize user instance to the session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user instance from the session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};
