// Middleware to protect routes - requires valid session
const authMiddleware = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: 'Not authorized, please log in'
    });
};

module.exports = authMiddleware;
