const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

const {
    getFields,
    createField,
    updateField,
    deleteField
} = require('../controllers/fieldController');

const fieldValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Field name is required')
        .isLength({ max: 100 })
        .withMessage('Field name cannot exceed 100 characters')
];

// Public route: fetch all available fields
router.get('/', getFields);

// Protected Admin Routes (Secretary only)
router.post(
    '/',
    authMiddleware,
    requireRole('Secretary'),
    fieldValidation,
    createField
);

router.put(
    '/:id',
    authMiddleware,
    requireRole('Secretary'),
    fieldValidation,
    updateField
);

router.delete(
    '/:id',
    authMiddleware,
    requireRole('Secretary'),
    deleteField
);

module.exports = router;
