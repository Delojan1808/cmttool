const Review = require('../models/Review');
const Paper = require('../models/Paper');

// @desc    Submit a new review
// @route   POST /api/reviews/:paperId
// @access  Private (Reviewer)
const createReview = async (req, res) => {
    try {
        const paperId = req.params.paperId;

        // Check if paper exists
        const paper = await Paper.findById(paperId);
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Verify the user is the assigned reviewer
        if (paper.reviewer?.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not the assigned reviewer for this paper'
            });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({ paper: paperId, reviewer: req.user._id });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a review for this paper'
            });
        }

        // Construct review data from req.body
        const reviewData = {
            paper: paperId,
            reviewer: req.user._id,
            evaluations: req.body.evaluations,
            recommendation: req.body.recommendation,
            suggestions: req.body.suggestions,
            otherComments: req.body.otherComments,
            reviewerInfo: req.body.reviewerInfo
        };

        const review = await Review.create(reviewData);

        // Update paper status to reviewed
        paper.status = 'reviewed';
        await paper.save();

        res.status(201).json({
            success: true,
            data: { review }
        });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while submitting review',
            error: error.message
        });
    }
};

// @desc    Get reviews for a paper
// @route   GET /api/reviews/paper/:paperId
// @access  Private
const getReviewsForPaper = async (req, res) => {
    try {
        const paperId = req.params.paperId;

        // Optionally check access permissions here (Author of paper, Reviewer, Editor, etc.)
        const paper = await Paper.findById(paperId);
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Simple access check
        const canView =
            paper.author.toString() === req.user._id.toString() ||
            (paper.reviewer && paper.reviewer.toString() === req.user._id.toString()) ||
            ['Editor', 'Sub Editor', 'Secretary'].includes(req.user.role);

        if (!canView) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view reviews for this paper'
            });
        }

        const reviews = await Review.find({ paper: paperId })
            .populate('reviewer', 'name email');

        res.status(200).json({
            success: true,
            count: reviews.length,
            data: { reviews }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching reviews',
            error: error.message
        });
    }
};

// @desc    Get review by ID
// @route   GET /api/reviews/:id
// @access  Private
const getReviewById = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate('paper', 'title category')
            .populate('reviewer', 'name email');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { review }
        });
    } catch (error) {
        console.error('Get review by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching review',
            error: error.message
        });
    }
};

module.exports = {
    createReview,
    getReviewsForPaper,
    getReviewById
};
