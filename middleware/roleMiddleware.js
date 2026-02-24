// Middleware to check if user has required role(s)
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        // Check if user is authenticated (should be set by authMiddleware)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user's role is in the allowed roles
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};

module.exports = requireRole;
