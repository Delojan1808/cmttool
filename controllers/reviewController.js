const Review = require('../models/Review');
const Paper = require('../models/Paper');
const ProfessionalField = require('../models/ProfessionalField');
const { sendEmail } = require('../utils/emailService');

// @desc    Submit a new review
// @route   POST /api/reviews/:paperId
// @access  Private (Reviewer)
const createReview = async (req, res) => {
    try {
        const paperId = req.params.paperId;

        // Check if paper exists
        const paper = await Paper.findById(paperId).populate('author', 'name email');
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Verify the user is an assigned reviewer
        if (!paper.assignedReviewers || !paper.assignedReviewers.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to review this paper'
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

        // Update paper status to reviewed (if not already)
        // If there are multiple reviewers, we might want to check if ALL reviewers submitted
        // before marking it as 'reviewed', but for now we will just use 'reviewed' as a signal.
        if (paper.status === 'under_review') {
            paper.status = 'reviewed';
            await paper.save();
        }

        // Notify Sub-Editor asynchronously
        try {
            const field = await ProfessionalField.findOne({ name: paper.category }).populate('subEditor', 'name email');
            if (field && field.subEditor) {
                sendEmail({
                    to: field.subEditor.email,
                    subject: `New Review Submitted: ${paper.title}`,
                    text: `Hello ${field.subEditor.name},\n\nA reviewer has just submitted their evaluation for the paper titled "${paper.title}".\n\nPlease log in to the dashboard to review the recommendation and make a final decision.\n\nThank you,\nCMT System`,
                    html: `<p>Hello ${field.subEditor.name},</p><p>A reviewer has just submitted their evaluation for the paper titled <strong>"${paper.title}"</strong>.</p><p>Please log in to the dashboard to review the recommendation and make a final decision.</p><p>Thank you,<br/>CMT System</p>`
                });
            }
        } catch (mailErr) {
            console.error('Error sending review notification:', mailErr);
        }

        // Notify Author asynchronously
        try {
            if (paper.author && paper.author.email) {
                sendEmail({
                    to: paper.author.email,
                    subject: `Review Completed: ${paper.title}`,
                    text: `Hello ${paper.author.name},\n\nA review has just been completed for your paper titled "${paper.title}".\n\nThe Editor will review the evaluation and provide a final decision soon.\n\nThank you,\nCMT System`,
                    html: `<p>Hello ${paper.author.name},</p><p>A review has just been completed for your paper titled <strong>"${paper.title}"</strong>.</p><p>The Editor will review the evaluation and provide a final decision soon.</p><p>Thank you,<br/>CMT System</p>`
                });
            }
        } catch (mailErr) {
            console.error('Error sending author review notification:', mailErr);
        }

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

        const isAssignedReviewer = paper.assignedReviewers && paper.assignedReviewers.some(
            reviewer => reviewer.toString() === req.user._id.toString()
        );

        // Simple access check
        const canView =
            paper.author.toString() === req.user._id.toString() ||
            isAssignedReviewer ||
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
