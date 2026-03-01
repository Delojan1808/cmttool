const passport = require('passport');
const User = require('../models/User');
const Conference = require('../models/Conference');
const Paper = require('../models/Paper');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/emailService');

// @desc    Register a new user (Author only - public registration)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
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
            roles: ['Author'], // Always Author for public registration
            professionalFields: professionalField ? [professionalField] : []
        });

        // Send Welcome Email asynchronously
        sendEmail({
            to: user.email,
            subject: 'Welcome to CMT System',
            text: `Hello ${user.name},\n\nYour Author account has been successfully created.\n\nYou can now log in and submit papers to active conferences.\n\nThank you,\nCMT System`,
            html: `<p>Hello ${user.name},</p><p>Your Author account has been successfully created.</p><p>You can now log in and submit papers to active conferences.</p><p>Thank you,<br/>CMT System</p>`
        });

        // Automatically log in the user after registration
        req.login(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.status(201).json({
                success: true,
                message: 'Author account registered successfully',
                data: {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        roles: user.roles,
                        professionalFields: user.professionalFields,
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
const login = (req, res, next) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Server error during login',
                error: err.message
            });
        }
        if (!user) {
            return res.status(401).json({
                success: false,
                message: info.message || 'Invalid credentials'
            });
        }
        req.logIn(user, (err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Server error during session creation',
                    error: err.message
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        roles: user.roles,
                        professionalFields: user.professionalFields,
                        createdAt: user.createdAt
                    }
                }
            });
        });
    })(req, res, next);
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            return res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    });
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        // req.user is populated by passport via session
        const user = req.user;

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
                    roles: user.roles,
                    professionalFields: user.professionalFields,
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

// Helper: detect conflicting role combinations (Author cannot mix with academic staff)
const STAFF_ROLES = ['Editor', 'Reviewer', 'SubEditor', 'Sub Editor', 'Secretary'];
const hasConflictingRoles = (roles) => {
    const hasAuthor = roles.includes('Author');
    const hasStaff = roles.some(r => STAFF_ROLES.includes(r));
    return hasAuthor && hasStaff;
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

        // Prevent Author + staff role conflict
        if (hasConflictingRoles([role])) {
            return res.status(400).json({
                success: false,
                message: 'A user cannot be both an Author and a staff role (Reviewer/Editor/SubEditor). These roles conflict.'
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
            roles: [role],
            professionalFields: professionalField ? [professionalField] : []
        });

        // Send Notification Email asynchronously
        sendEmail({
            to: user.email,
            subject: `Welcome to CMT System - You have been assigned as a ${role}`,
            text: `Hello ${user.name},\n\nAn administrator has created an account for you as a ${role}.\n\nYour temporary password is: ${password}\n\nPlease log in to access your dashboard.\n\nThank you,\nCMT System`,
            html: `<p>Hello ${user.name},</p><p>An administrator has created an account for you as a <strong>${role}</strong>.</p><p>Your temporary password is: <strong>${password}</strong></p><p>Please log in to access your dashboard.</p><p>Thank you,<br/>CMT System</p>`
        });

        res.status(201).json({
            success: true,
            message: `${role} account created successfully`,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    roles: user.roles,
                    professionalFields: user.professionalFields,
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
        const subEditors = await User.find({ roles: 'Sub Editor' }).select('name email');
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

// @desc    Get all users under conferences created by the Secretary
// @route   GET /api/auth/secretary-users
// @access  Private (Secretary)
const getSecretaryUsers = async (req, res) => {
    try {
        // Find conferences created by this secretary
        const conferences = await Conference.find({ createdBy: req.user._id });
        const conferenceIds = conferences.map(c => c._id);
        const conferenceFields = conferences.flatMap(c => c.fields);

        // Find papers submitted to these conferences
        const papers = await Paper.find({ conference: { $in: conferenceIds } });

        const userIds = new Set();

        // Extract authors and assigned reviewers from the papers
        papers.forEach(p => {
            if (p.authors) {
                p.authors.forEach(authorId => userIds.add(authorId.toString()));
            }
            if (p.assignedReviewers) {
                p.assignedReviewers.forEach(reviewerId => userIds.add(reviewerId.toString()));
            }
        });

        // Find Reviewers / SubEditors whose professional fields match the conference fields
        const relatedStaff = await User.find({
            professionalFields: { $in: conferenceFields },
            roles: { $in: ['Reviewer', 'SubEditor'] }
        }).select('_id');

        relatedStaff.forEach(staff => userIds.add(staff._id.toString()));

        // Always include all Editors — they have no professional fields so they won't
        // match the field filter above, but they are always relevant to the conferences
        const editors = await User.find({ roles: 'Editor' }).select('_id');
        editors.forEach(e => userIds.add(e._id.toString()));


        // Fetch full details of these unique users
        const users = await User.find({
            _id: { $in: Array.from(userIds) }
        }).select('-password').populate('professionalFields', 'fieldName');

        res.status(200).json({
            success: true,
            data: { users }
        });
    } catch (error) {
        console.error('Get secretary users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching users',
            error: error.message
        });
    }
};

// @desc    Update user details (Admin/Secretary only)
// @route   PUT /api/auth/admin/users/:id
// @access  Private (Secretary only)
const updateUser = async (req, res) => {
    try {
        const { name, email, roles, professionalFields, isActive } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Prevent Secretary from modifying other Secretaries
        if (user.roles.includes('Secretary') && req.user._id.toString() !== user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Cannot modify other Secretary accounts' });
        }

        // Validate role conflict before applying
        const incomingRoles = roles || user.roles.toObject?.() || user.roles;
        if (hasConflictingRoles(incomingRoles)) {
            return res.status(400).json({
                success: false,
                message: 'A user cannot be both an Author and a staff role (Reviewer/Editor/SubEditor). These roles conflict.'
            });
        }

        // Build update object with only the provided fields
        // Normalise 'Sub Editor' (with space) → 'SubEditor' since findByIdAndUpdate bypasses pre-save hooks
        const normaliseRoles = (arr) => arr.map(r => r === 'Sub Editor' ? 'SubEditor' : r);
        const updateFields = {};
        if (name) updateFields.name = name;
        if (email) updateFields.email = email;
        if (roles) updateFields.roles = normaliseRoles(roles);
        if (professionalFields) updateFields.professionalFields = professionalFields;
        if (typeof isActive === 'boolean') updateFields.isActive = isActive;

        // Use findByIdAndUpdate to avoid triggering the password `required` validator
        const updated = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password').populate('professionalFields', 'fieldName');

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: { user: updated }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Server error updating user', error: error.message });
    }
};



// @desc    Delete user account (Admin/Secretary only)
// @route   DELETE /api/auth/admin/users/:id
// @access  Private (Secretary only)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.roles.includes('Secretary')) {
            return res.status(403).json({ success: false, message: 'Cannot delete Secretary accounts' });
        }

        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting user', error: error.message });
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    createUser,
    getSubEditors,
    getSecretaryUsers,
    updateUser,
    deleteUser
};
