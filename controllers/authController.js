const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Register a new user (Author only - public registration)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, email, password, professionalField } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create user with Author role (force role to Author for public registration)
        const user = await User.create({
            name,
            email,
            password,
            role: 'Author', // Always Author for public registration
            professionalField
        });

        // Log the user in after registration
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Server error during login' });
            }
            return res.status(201).json({
                success: true,
                message: 'Author account registered successfully',
                data: {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        professionalField: user.professionalField,
                        createdAt: user.createdAt
                    }
                }
            });
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = (req, res) => {
    // passport.authenticate('local') handles the validation and sets req.user
    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                professionalField: req.user.professionalField,
                createdAt: req.user.createdAt
            }
        }
    });
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logout = (req, res) => {
    req.logout((err) => {
        if (err) { return res.status(500).json({ success: false, message: 'Error logging out' }); }
        req.session.destroy((err) => {
            res.clearCookie('connect.sid');
            res.status(200).json({ success: true, message: 'Logged out successfully' });
        });
    });
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    professionalField: user.professionalField,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile',
            error: error.message
        });
    }
};

// @desc    Create user account (Admin/Secretary only)
// @route   POST /api/auth/admin/create-user
// @access  Private (Secretary only)
const createUser = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, email, password, role, professionalField } = req.body;

        // Only allow Secretary to create Editor, Reviewer, and Sub Editor
        const allowedRoles = ['Editor', 'Reviewer', 'Sub Editor'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Admins can only create Editor, Reviewer, or Sub Editor accounts'
            });
        }

        // professionalField is required for Reviewer / Sub Editor but NOT for Editor
        const rolesRequiringField = ['Reviewer', 'Sub Editor'];
        if (rolesRequiringField.includes(role) && !professionalField) {
            return res.status(400).json({
                success: false,
                message: 'Professional field is required for Reviewer and Sub Editor accounts'
            });
        }
        if (role === 'Editor' && professionalField) {
            return res.status(400).json({
                success: false,
                message: 'Editor accounts do not have a professional field'
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create user with specified role
        const user = await User.create({
            name,
            email,
            password,
            role,
            ...(professionalField && { professionalField })
        });

        res.status(201).json({
            success: true,
            message: `${role} account created successfully`,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    professionalField: user.professionalField,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user creation',
            error: error.message
        });
    }
};

// @desc    Get all Sub-Editors
// @route   GET /api/auth/sub-editors
// @access  Private (Editor)
const getSubEditors = async (req, res) => {
    try {
        const subEditors = await User.find({ role: 'Sub Editor' }).select('name email');
        res.status(200).json({
            success: true,
            data: { subEditors }
        });
    } catch (error) {
        console.error('Get sub-editors error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching sub-editors',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    createUser,
    getSubEditors
};
