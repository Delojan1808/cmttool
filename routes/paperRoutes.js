const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const upload = require('../config/upload');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const {
    uploadPaper,
    getMyPapers,
    getAssignedPapers,
    getAllPapers,
    getPaperById,
    updatePaper,
    deletePaper,
    downloadPaper,
    getReviewers,
    assignReviewer,
    unassignReviewer,
    declineReview,
    updatePaperStatus
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

// Get papers assigned to the current reviewer (Reviewer only)
router.get(
    '/assigned',
    authMiddleware,
    requireRole('Reviewer'),
    getAssignedPapers
);

// Get all users with Reviewer role (Secretary only)
// NOTE: Must be registered before /:id to avoid 'reviewers' being matched as an ID
router.get(
    '/reviewers',
    authMiddleware,
    requireRole('Secretary'),
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
// Added upload middleware to support optional re-upload of revisions/camera-ready PDFs
router.put('/:id', authMiddleware, upload.single('pdf'), updatePaper);

// Decline a review assignment (Reviewer only)
router.put(
    '/:id/decline-review',
    authMiddleware,
    requireRole('Reviewer'),
    declineReview
);

// Assign a reviewer to a paper (Secretary only)
router.put(
    '/:id/assign-reviewer',
    authMiddleware,
    requireRole('Secretary'),
    assignReviewer
);

// Update paper status (Editor, Sub Editor only)
router.put(
    '/:id/status',
    authMiddleware,
    requireRole('Editor', 'Sub Editor'),
    updatePaperStatus
);

// Delete paper (Author or Secretary - permission checked in controller)
router.delete('/:id', authMiddleware, deletePaper);

// Unassign reviewer from a paper (Secretary only)
router.delete(
    '/:id/assign-reviewer',
    authMiddleware,
    requireRole('Secretary'),
    unassignReviewer
);

// Download paper PDF (All authenticated users - permission checked in controller)
router.get('/:id/download', authMiddleware, downloadPaper);

module.exports = router;
