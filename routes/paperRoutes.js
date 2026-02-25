const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const upload = require('../config/upload');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const {
    uploadPaper,
    getMyPapers,
    getAllPapers,
    getPaperById,
    updatePaper,
    deletePaper,
    downloadPaper,
    getReviewers,
    assignReviewer,
    unassignReviewer
} = require('../controllers/paperController');

// Validation for paper metadata
const paperValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 300 })
        .withMessage('Title cannot exceed 300 characters'),
    body('abstract')
        .trim()
        .notEmpty()
        .withMessage('Abstract is required')
        .isLength({ max: 2000 })
        .withMessage('Abstract cannot exceed 2000 characters'),
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isIn([
            'Computer Science',
            'Engineering',
            'Mathematics',
            'Physics',
            'Chemistry',
            'Biology',
            'Medicine',
            'Social Sciences',
            'Humanities',
            'Other'
        ])
        .withMessage('Invalid category')
];

// Upload paper (Author+)
// Use multer middleware first, then validation, then controller
router.post(
    '/upload',
    authMiddleware,
    upload.single('pdf'),
    uploadPaper
);

// Get current user's papers (All authenticated users)
router.get('/my-papers', authMiddleware, getMyPapers);

// Get all users with Reviewer role (Editor, Sub Editor only)
// NOTE: Must be registered before /:id to avoid 'reviewers' being matched as an ID
router.get(
    '/reviewers',
    authMiddleware,
    requireRole('Editor', 'Sub Editor'),
    getReviewers
);

// Get all papers (Editor, Sub Editor, Secretary only)
router.get(
    '/',
    authMiddleware,
    requireRole('Editor', 'Sub Editor', 'Secretary'),
    getAllPapers
);

// Get single paper by ID (All authenticated users - permission checked in controller)
router.get('/:id', authMiddleware, getPaperById);

// Update paper metadata (Author only - permission checked in controller)
router.put('/:id', authMiddleware, updatePaper);

// Assign a reviewer to a paper (Editor, Sub Editor only)
router.put(
    '/:id/assign-reviewer',
    authMiddleware,
    requireRole('Editor', 'Sub Editor'),
    assignReviewer
);

// Delete paper (Author or Secretary - permission checked in controller)
router.delete('/:id', authMiddleware, deletePaper);

// Unassign reviewer from a paper (Editor, Sub Editor only)
router.delete(
    '/:id/assign-reviewer',
    authMiddleware,
    requireRole('Editor', 'Sub Editor'),
    unassignReviewer
);

// Download paper PDF (All authenticated users - permission checked in controller)
router.get('/:id/download', authMiddleware, downloadPaper);

module.exports = router;
