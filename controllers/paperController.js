const Paper = require('../models/Paper');
const User = require('../models/User');
const Conference = require('../models/Conference');
const ProfessionalField = require('../models/ProfessionalField');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../utils/emailService');

// Helper to get fully populated paper data
const getFullPaperData = async (paperId) => {
    const paper = await Paper.findById(paperId)
        .populate('authors', 'name email')
        .populate('field', 'fieldName')
        .populate('conference', 'title startDate')
        .select('-fileUrl')
        .lean();

    if (paper) {
        const reviews = await Review.find({ paper: paper._id }).populate('reviewer', 'name email');
        paper.assignedReviewers = reviews.map(r => r.reviewer);
    }
    return paper;
};

// @desc    Upload a new paper (PDF)
// @route   POST /api/papers/upload
// @access  Private (Author+)
const uploadPaper = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a PDF file' });
        }

        const { title, abstract, keywords, field, authors, conferenceId } = req.body;

        if (!title || !abstract || !field || !conferenceId) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Title, abstract, field, and conference selection are required' });
        }

        const mongoose = require('mongoose');
        let fieldId;
        if (mongoose.Types.ObjectId.isValid(field)) {
            fieldId = field;
        } else {
            const fieldDoc = await ProfessionalField.findOne({ fieldName: field });
            if (!fieldDoc) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ success: false, message: `Professional field "${field}" not found` });
            }
            fieldId = fieldDoc._id;
        }

        const conference = await Conference.findById(conferenceId).populate('createdBy', 'name email');
        if (!conference) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Selected conference not found' });
        }

        if (new Date() > new Date(conference.submissionDeadline)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Submission deadline for this conference has passed' });
        }

        let parsedKeywords = keywords;
        if (typeof keywords === 'string') {
            parsedKeywords = keywords.split(',').map(k => k.trim()).filter(k => k);
        }

        let parsedAuthors = [req.user._id];
        if (authors) {
            try {
                const addl = typeof authors === 'string' ? JSON.parse(authors) : authors;
                parsedAuthors = [...new Set([...parsedAuthors.map(id => id.toString()), ...addl])];
            } catch (err) { }
        }

        const paper = await Paper.create({
            title,
            abstract,
            keywords: parsedKeywords,
            field: fieldId,
            authors: parsedAuthors,
            conference: conferenceId,
            fileName: req.file.originalname,
            fileUrl: req.file.path
        });

        sendEmail({
            to: req.user.email,
            subject: `Submission Confirmation: ${paper.title}`,
            text: `Hello ${req.user.name},\n\nYour paper titled "${paper.title}" has been successfully submitted.\n\nThank you,\nCMT System`,
            html: `<p>Hello ${req.user.name},</p><p>Your paper titled <strong>"${paper.title}"</strong> has been successfully submitted.</p><p>Thank you,<br/>CMT System</p>`
        });

        res.status(201).json({ success: true, message: 'Paper uploaded successfully', data: { paper } });
    } catch (error) {
        console.error('Upload paper error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get current user's papers
// @route   GET /api/papers/my-papers
// @access  Private
const getMyPapers = async (req, res) => {
    try {
        const papers = await Paper.find({ authors: req.user._id })
            .populate('field', 'fieldName')
            .populate('conference', 'title startDate submissionDeadline')
            .sort({ createdAt: -1 })
            .select('-fileUrl');

        res.status(200).json({ success: true, count: papers.length, data: { papers } });
    } catch (error) {
        console.error('Get my papers error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get papers assigned to the current reviewer
// @route   GET /api/papers/assigned
// @access  Private (Reviewer)
const getAssignedPapers = async (req, res) => {
    try {
        if (!req.user.roles.includes('Reviewer')) {
            return res.status(403).json({ success: false, message: 'Only Reviewers can fetch assigned papers' });
        }

        // Fetch assigned reviews instead
        const reviews = await Review.find({ reviewer: req.user._id, status: 'assigned' })
            .populate({
                path: 'paper',
                select: '-fileUrl',
                populate: [
                    { path: 'authors', select: 'name email' },
                    { path: 'field', select: 'fieldName' },
                    { path: 'conference', select: 'title' }
                ]
            })
            .sort({ createdAt: -1 });

        const papers = reviews.map(r => r.paper);

        res.status(200).json({ success: true, count: papers.length, data: { papers } });
    } catch (error) {
        console.error('Get assigned papers error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get all papers (Editor/Secretary only)
// @route   GET /api/papers
// @access  Private (Editor, SubEditor, Secretary)
const getAllPapers = async (req, res) => {
    try {
        const { status, field, author } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (field) filter.field = field;
        if (author) filter.authors = author;

        if (req.user.roles.includes('SubEditor')) {
            const allowedIds = req.user.professionalFields || [];

            if (field) {
                const reqField = await ProfessionalField.findOne({ fieldName: field });
                if (!reqField || !allowedIds.some(id => id.equals(reqField._id))) {
                    filter.field = { $in: [] };
                } else {
                    filter.field = reqField._id;
                }
            } else {
                filter.field = { $in: allowedIds };
            }
        }

        const papers = await Paper.find(filter)
            .populate('authors', 'name email')
            .populate('field', 'fieldName')
            .populate('conference', 'title startDate')
            .sort({ createdAt: -1 })
            .select('-fileUrl')
            .lean();

        // Also populate assigned reviewers for dashboard view
        for (let paper of papers) {
            const reviews = await Review.find({ paper: paper._id }).populate('reviewer', 'name email');
            paper.assignedReviewers = reviews.map(r => r.reviewer);
        }

        res.status(200).json({ success: true, count: papers.length, data: { papers } });
    } catch (error) {
        console.error('Get all papers error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get single paper by ID
// @route   GET /api/papers/:id
// @access  Private
const getPaperById = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id)
            .populate('authors', 'name email')
            .populate('field', 'fieldName')
            .populate('conference', 'title startDate submissionDeadline')
            .lean();

        if (!paper) {
            return res.status(404).json({ success: false, message: 'Paper not found' });
        }

        const reviews = await Review.find({ paper: paper._id }).populate('reviewer', 'name email');
        paper.assignedReviewers = reviews.map(r => r.reviewer);

        const isAuthor = paper.authors.some(a => a._id.toString() === req.user._id.toString());
        const isAssigned = paper.assignedReviewers.some(r => r._id.toString() === req.user._id.toString());
        const hasElevatedPrivilege = req.user.roles.some(role => ['Secretary', 'Editor', 'SubEditor'].includes(role));

        if (!isAuthor && !isAssigned && !hasElevatedPrivilege) {
            return res.status(403).json({ success: false, message: 'You do not have permission to view this paper' });
        }

        res.status(200).json({ success: true, data: { paper } });
    } catch (error) {
        console.error('Get paper by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Update paper metadata
// @route   PUT /api/papers/:id
// @access  Private (Author of the paper)
const updatePaper = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);

        if (!paper) {
            return res.status(404).json({ success: false, message: 'Paper not found' });
        }

        if (!paper.authors.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'You can only update your own papers' });
        }

        const updatableStatuses = ['submitted', 'revision_required', 'accepted'];
        if (!updatableStatuses.includes(paper.status)) {
            return res.status(403).json({ success: false, message: `Paper cannot be edited while in '${paper.status}' status` });
        }

        const { title, abstract, keywords, field, authors } = req.body;

        if (title) paper.title = title;
        if (abstract) paper.abstract = abstract;
        if (keywords) {
            paper.keywords = typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(k => k) : keywords;
        }
        if (field) {
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(field)) {
                paper.field = field;
            } else {
                const fieldDoc = await ProfessionalField.findOne({ fieldName: field });
                if (fieldDoc) paper.field = fieldDoc._id;
            }
        }
        if (authors) {
            try {
                paper.authors = typeof authors === 'string' ? JSON.parse(authors) : authors;
            } catch (err) { }
        }

        if (req.file) {
            if (paper.fileUrl && fs.existsSync(paper.fileUrl)) {
                try { fs.unlinkSync(paper.fileUrl); } catch (e) { }
            }
            paper.fileName = req.file.originalname;
            paper.fileUrl = req.file.path;

            if (paper.status === 'revision_required') {
                paper.status = 'submitted';
            }
        }

        await paper.save();
        res.status(200).json({ success: true, message: 'Paper updated', data: { paper } });
    } catch (error) {
        console.error('Update paper error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Delete paper
// @route   DELETE /api/papers/:id
// @access  Private (Author or Secretary)
const deletePaper = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ success: false, message: 'Paper not found' });

        const canDelete = paper.authors.includes(req.user._id) || req.user.roles.includes('Secretary');
        if (!canDelete) return res.status(403).json({ success: false, message: 'You do not have permission to delete this paper' });

        if (paper.fileUrl && fs.existsSync(paper.fileUrl)) {
            try { fs.unlinkSync(paper.fileUrl); } catch (e) { }
        }

        await Paper.findByIdAndDelete(req.params.id);
        await Review.deleteMany({ paper: req.params.id }); // Clean up reviews

        res.status(200).json({ success: true, message: 'Paper deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Download paper PDF
// @route   GET /api/papers/:id/download
// @access  Private
const downloadPaper = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ success: false, message: 'Paper not found' });

        const reviews = await Review.find({ paper: paper._id });
        const isAssigned = reviews.some(r => r.reviewer.toString() === req.user._id.toString());
        const isAuthor = paper.authors.includes(req.user._id);
        const hasElevated = req.user.roles.some(role => ['Secretary', 'Editor', 'SubEditor'].includes(role));

        if (!isAuthor && !isAssigned && !hasElevated) {
            return res.status(403).json({ success: false, message: 'Permission denied' });
        }

        if (!paper.fileUrl || !fs.existsSync(paper.fileUrl)) {
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.fileName || 'paper.pdf'}"`);
        const fileStream = fs.createReadStream(paper.fileUrl);
        fileStream.pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Get all users with Reviewer role
// @route   GET /api/papers/reviewers
// @access  Private (Secretary)
const getReviewers = async (req, res) => {
    try {
        const query = { roles: 'Reviewer' };
        if (req.query.field) query.professionalFields = req.query.field;

        const reviewers = await User.find(query).select('name email professionalFields').populate('professionalFields', 'fieldName');
        res.status(200).json({ success: true, count: reviewers.length, data: { reviewers } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Assign a reviewer to a paper
// @route   PUT /api/papers/:id/assign-reviewer
// @access  Private (Secretary, Editor, SubEditor)
const assignReviewer = async (req, res) => {
    try {
        if (!req.user.roles.some(role => ['Secretary', 'Editor', 'SubEditor'].includes(role))) {
            return res.status(403).json({ success: false, message: 'You are not authorized to assign reviewers' });
        }

        const { reviewerId } = req.body;
        if (!reviewerId) {
            return res.status(400).json({ success: false, message: 'reviewerId is required' });
        }

        const paper = await Paper.findById(req.params.id);
        if (!paper) return res.status(404).json({ success: false, message: 'Paper not found' });

        const reviewer = await User.findById(reviewerId);
        if (!reviewer || !reviewer.roles.includes('Reviewer')) {
            return res.status(404).json({ success: false, message: 'User is not a Reviewer' });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({ paper: paper._id, reviewer: reviewer._id });
        if (existingReview) return res.status(400).json({ success: false, message: 'Already assigned' });

        // Create assignment
        await Review.create({
            paper: paper._id,
            reviewer: reviewer._id,
            status: 'assigned'
        });

        if (paper.status === 'submitted') {
            paper.status = 'under_review';
            await paper.save();
        }

        const updatedPaper = await getFullPaperData(paper._id);
        res.status(200).json({ success: true, message: 'Reviewer assigned successfully', data: { paper: updatedPaper } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Unassign a reviewer from a paper
// @route   DELETE /api/papers/:id/assign-reviewer
// @access  Private (Secretary, Editor)
const unassignReviewer = async (req, res) => {
    try {
        if (!req.user.roles.some(role => ['Secretary', 'Editor', 'SubEditor'].includes(role))) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const { reviewerId } = req.body;
        if (!reviewerId) return res.status(400).json({ success: false, message: 'reviewerId required' });

        const deleted = await Review.findOneAndDelete({ paper: req.params.id, reviewer: reviewerId });
        if (!deleted) return res.status(400).json({ success: false, message: 'Not assigned' });

        // Revert paper status if no reviewers left
        const remaining = await Review.countDocuments({ paper: req.params.id });
        if (remaining === 0) {
            const paper = await Paper.findById(req.params.id);
            if (paper && paper.status === 'under_review') {
                paper.status = 'submitted';
                await paper.save();
            }
        }

        const updatedPaper = await getFullPaperData(req.params.id);
        res.status(200).json({ success: true, message: 'Unassigned successfully', data: { paper: updatedPaper } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Update final decision status of a paper (Accept/Reject)
// @route   PUT /api/papers/:id/status
// @access  Private (Editor, SubEditor)
const updatePaperStatus = async (req, res) => {
    try {
        if (!req.user.roles.some(role => ['Editor', 'SubEditor'].includes(role))) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const { status } = req.body;
        const paper = await Paper.findById(req.params.id).populate('authors');
        if (!paper) return res.status(404).json({ success: false, message: 'Paper not found' });

        if (req.user.roles.includes('SubEditor') && !req.user.roles.includes('Editor')) {
            const field = await ProfessionalField.findOne({ _id: paper.field, subEditors: req.user._id });
            if (!field) return res.status(403).json({ success: false, message: "Not assigned to this field" });
        }

        paper.status = status;
        paper.finalDecision = status;
        paper.decisionBy = req.user._id;
        paper.decisionDate = new Date();
        await paper.save();

        res.status(200).json({ success: true, message: 'Status updated', data: { paper } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Decline a review assignment
// @route   PUT /api/papers/:id/decline-review
// @access  Private (Reviewer)
const declineReview = async (req, res) => {
    try {
        const deleted = await Review.findOneAndDelete({ paper: req.params.id, reviewer: req.user._id });
        if (!deleted) return res.status(400).json({ success: false, message: 'Not assigned' });

        const remaining = await Review.countDocuments({ paper: req.params.id });
        if (remaining === 0) {
            const paper = await Paper.findById(req.params.id);
            if (paper && paper.status === 'under_review') {
                paper.status = 'submitted';
                await paper.save();
            }
        }
        res.status(200).json({ success: true, message: 'Declined successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

module.exports = {
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
    updatePaperStatus,
    declineReview
};
