const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const {
    createReview,
    getReviewsForPaper,
    getReviewById
} = require('../controllers/reviewController');

// Submit a new review for a paper (Reviewer only)
router.post(
    '/:paperId',
    authMiddleware,
    requireRole('Reviewer'),
    createReview
);

// Get all reviews for a specific paper
router.get(
    '/paper/:paperId',
    authMiddleware,
    getReviewsForPaper
);

// Get a single review by its ID
router.get(
    '/:id',
    authMiddleware,
    getReviewById
);

module.exports = router;
