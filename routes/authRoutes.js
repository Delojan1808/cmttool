const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    register,
    login,
    logout,
    getProfile,
    createUser,
    getSubEditors,
    getSecretaryUsers,
    updateUser,
    deleteUser
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// Validation rules for public registration (Author only - no role field)
const registerValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
];

// Validation rules for admin user creation
const createUserValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['Editor', 'Reviewer', 'Sub Editor'])
        .withMessage('Invalid role. Allowed roles: Editor, Reviewer, Sub Editor'),
    // professionalField required for Reviewer & Sub Editor; must be absent for Editor
    body('professionalField')
        .if(body('role').isIn(['Reviewer', 'Sub Editor']))
        .notEmpty()
        .withMessage('Professional field is required for Reviewer and Sub Editor')
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected routes
router.post('/logout', authMiddleware, logout);
router.get('/profile', authMiddleware, getProfile);

// Admin routes (Secretary only)
router.post(
    '/admin/create-user',
    authMiddleware,
    requireRole('Secretary'),
    createUserValidation,
    createUser
);

// Route for Editor to fetch Sub-Editors
router.get(
    '/sub-editors',
    authMiddleware,
    requireRole('Editor'),
    getSubEditors
);

// Route for Secretary to fetch users under their conferences
router.get(
    '/secretary-users',
    authMiddleware,
    requireRole('Secretary'),
    getSecretaryUsers
);

// Route for Secretary to update a user
router.put(
    '/admin/users/:id',
    authMiddleware,
    requireRole('Secretary'),
    updateUser
);

// Route for Secretary to delete a user
router.delete(
    '/admin/users/:id',
    authMiddleware,
    requireRole('Secretary'),
    deleteUser
);

module.exports = router;
