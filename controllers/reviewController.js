const Review = require('../models/Review');
const Paper = require('../models/Paper');
const ProfessionalField = require('../models/ProfessionalField');
const { sendEmail } = require('../utils/emailService');

// @desc    Submit a new review
// @route   POST /api/reviews/:paperId
//   *(Actually handles updating the "assigned" review created by Editor)*
// @access  Private (Reviewer)
const createReview = async (req, res) => {
    try {
        const paperId = req.params.paperId;

        const paper = await Paper.findById(paperId).populate('authors', 'name email');
        if (!paper) {
            return res.status(404).json({ success: false, message: 'Paper not found' });
        }

        const existingReview = await Review.findOne({ paper: paperId, reviewer: req.user._id });
        if (!existingReview) {
            return res.status(403).json({ success: false, message: 'You are not assigned to review this paper' });
        }

        if (existingReview.status === 'submitted') {
            return res.status(400).json({ success: false, message: 'You have already submitted a review for this paper' });
        }

        existingReview.score = req.body.score;
        existingReview.recommendation = req.body.recommendation;
        existingReview.commentsToAuthor = req.body.commentsToAuthor;
        existingReview.confidentialComments = req.body.confidentialComments;
        existingReview.status = 'submitted';
        existingReview.submittedAt = new Date();

        await existingReview.save();

        if (paper.status === 'under_review') {
            // Check if ALL assigned reviews are submitted
            const allReviewsForPaper = await Review.find({ paper: paperId });
            const allSubmitted = allReviewsForPaper.every(r => r.status === 'submitted');

            if (allSubmitted && allReviewsForPaper.length > 0) {
                paper.status = 'reviewed';
                await paper.save();
            }
        }

        // Notify Sub-Editor asynchronously
        try {
            const field = await ProfessionalField.findById(paper.field).populate('subEditors', 'name email');
            if (field && field.subEditors && field.subEditors.length > 0) {
                for (const sub of field.subEditors) {
                    sendEmail({
                        to: sub.email,
                        subject: `New Review Submitted: ${paper.title}`,
                        text: `Hello ${sub.name},\n\nA reviewer has evaluated "${paper.title}".\n\nThank you,\nCMT System`,
                        html: `<p>Hello ${sub.name},</p><p>A reviewer has evaluated <strong>"${paper.title}"</strong>.</p><p>Thank you,<br/>CMT System</p>`
                    });
                }
            }
        } catch (mailErr) { }

        // Notify Author asynchronously
        try {
            for (const author of paper.authors) {
                if (author && author.email) {
                    sendEmail({
                        to: author.email,
                        subject: `Review Completed: ${paper.title}`,
                        text: `Hello ${author.name},\n\nA review has been completed for "${paper.title}".\n\nThank you,\nCMT System`,
                        html: `<p>Hello ${author.name},</p><p>A review has been completed for <strong>"${paper.title}"</strong>.</p><p>Thank you,<br/>CMT System</p>`
                    });
                }
            }
        } catch (mailErr) { }

        res.status(200).json({ success: true, data: { review: existingReview } });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get reviews for a paper
// @route   GET /api/reviews/paper/:paperId
// @access  Private
const getReviewsForPaper = async (req, res) => {
    try {
        const paperId = req.params.paperId;

        const paper = await Paper.findById(paperId);
        if (!paper) return res.status(404).json({ success: false, message: 'Paper not found' });

        const reviews = await Review.find({ paper: paperId }).populate('reviewer', 'name email');

        const isAssigned = reviews.some(r => r.reviewer._id.toString() === req.user._id.toString());
        const isAuthor = paper.authors.includes(req.user._id);
        const hasElevatedPrivilege = req.user.roles.some(role => ['Editor', 'Sub Editor', 'Secretary'].includes(role));

        if (!isAuthor && !isAssigned && !hasElevatedPrivilege) {
            return res.status(403).json({ success: false, message: 'Not authorized to view reviews for this paper' });
        }

        // Hide confidential comments from authors
        const sanitizedReviews = reviews.map(r => {
            if (isAuthor && !hasElevatedPrivilege) {
                const copy = r.toObject();
                delete copy.confidentialComments;
                return copy;
            }
            return r;
        });

        res.status(200).json({ success: true, count: sanitizedReviews.length, data: { reviews: sanitizedReviews } });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get review by ID
// @route   GET /api/reviews/:id
// @access  Private
const getReviewById = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate('paper', 'title field')
            .populate('reviewer', 'name email');

        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

        res.status(200).json({ success: true, data: { review } });
    } catch (error) {
        console.error('Get review error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

module.exports = {
    createReview,
    getReviewsForPaper,
    getReviewById
};
