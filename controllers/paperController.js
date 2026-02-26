const Paper = require('../models/Paper');
const User = require('../models/User');
const Conference = require('../models/Conference');
const ProfessionalField = require('../models/ProfessionalField');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../utils/emailService');

// @desc    Upload a new paper (PDF)
// @route   POST /api/papers/upload
// @access  Private (Author+)
const uploadPaper = async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF file'
            });
        }

        // Extract metadata from request body
        const { title, abstract, keywords, category, coAuthors, conferenceId } = req.body;

        // Validate required fields
        if (!title || !abstract || !category || !conferenceId) {
            // Delete uploaded file if validation fails
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Title, abstract, category, and conference selection are required'
            });
        }

        // Validate conference exists
        const conference = await Conference.findById(conferenceId).populate('createdBy', 'name email');
        if (!conference) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: 'Selected conference not found'
            });
        }

        // Validate submission deadline
        if (new Date() > new Date(conference.submissionDeadline)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Submission deadline for this conference has passed'
            });
        }

        // Parse keywords (can be sent as comma-separated string or array)
        let parsedKeywords = keywords;
        if (typeof keywords === 'string') {
            parsedKeywords = keywords.split(',').map(k => k.trim()).filter(k => k);
        }

        // Parse coAuthors if provided
        let parsedCoAuthors = [];
        if (coAuthors) {
            try {
                parsedCoAuthors = typeof coAuthors === 'string'
                    ? JSON.parse(coAuthors)
                    : coAuthors;
            } catch (err) {
                // If parsing fails, ignore coAuthors
                parsedCoAuthors = [];
            }
        }

        // Create paper document
        const paper = await Paper.create({
            title,
            abstract,
            keywords: parsedKeywords,
            category,
            coAuthors: parsedCoAuthors,
            author: req.user._id,
            conference: conferenceId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            assignedReviewers: []
        });

        // Send confirmation email to Author asynchronously
        sendEmail({
            to: req.user.email,
            subject: `Submission Confirmation: ${paper.title}`,
            text: `Hello ${req.user.name},\n\nYour paper titled "${paper.title}" has been successfully submitted to the conference.\n\nYou can track its status from your Author Dashboard.\n\nThank you,\nCMT System`,
            html: `<p>Hello ${req.user.name},</p><p>Your paper titled <strong>"${paper.title}"</strong> has been successfully submitted to the conference.</p><p>You can track its status from your Author Dashboard.</p><p>Thank you,<br/>CMT System</p>`
        });

        // Send notification email to the Secretary who created the conference asynchronously
        if (conference && conference.createdBy) {
            sendEmail({
                to: conference.createdBy.email,
                subject: `New Paper Submission: ${paper.title}`,
                text: `Hello ${conference.createdBy.name},\n\nA new paper titled "${paper.title}" has been submitted to your conference "${conference.title}" by ${req.user.name}.\n\nThank you,\nCMT System`,
                html: `<p>Hello ${conference.createdBy.name},</p><p>A new paper titled <strong>"${paper.title}"</strong> has been submitted to your conference <strong>"${conference.title}"</strong> by ${req.user.name}.</p><p>Thank you,<br/>CMT System</p>`
            });
        }

        res.status(201).json({
            success: true,
            message: 'Paper uploaded successfully',
            data: {
                paper: {
                    id: paper._id,
                    title: paper.title,
                    abstract: paper.abstract,
                    keywords: paper.keywords,
                    category: paper.category,
                    filename: paper.filename,
                    originalName: paper.originalName,
                    fileSize: paper.fileSize,
                    status: paper.status,
                    submittedAt: paper.submittedAt,
                    createdAt: paper.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Upload paper error:', error);

        // Delete uploaded file if database save fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Server error during paper upload',
            error: error.message
        });
    }
};

// @desc    Get current user's papers
// @route   GET /api/papers/my-papers
// @access  Private
const getMyPapers = async (req, res) => {
    try {
        const papers = await Paper.find({ author: req.user._id })
            .populate('conference', 'title conferenceDate submissionDeadline')
            .sort({ createdAt: -1 })
            .select('-filePath'); // Don't expose file path

        res.status(200).json({
            success: true,
            count: papers.length,
            data: {
                papers
            }
        });
    } catch (error) {
        console.error('Get my papers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching papers',
            error: error.message
        });
    }
};

// @desc    Get papers assigned to the current reviewer
// @route   GET /api/papers/assigned
// @access  Private (Reviewer)
const getAssignedPapers = async (req, res) => {
    try {
        if (req.user.role !== 'Reviewer') {
            return res.status(403).json({
                success: false,
                message: 'Only Reviewers can fetch assigned papers'
            });
        }

        const papers = await Paper.find({ assignedReviewers: req.user._id })
            .populate('author', 'name email')
            .populate('conference', 'title')
            .sort({ createdAt: -1 })
            .select('-filePath'); // Don't expose file path in list

        res.status(200).json({
            success: true,
            count: papers.length,
            data: {
                papers
            }
        });
    } catch (error) {
        console.error('Get assigned papers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching assigned papers',
            error: error.message
        });
    }
};

// @desc    Get all papers (Editor/Secretary only)
// @route   GET /api/papers
// @access  Private (Editor, Sub Editor, Secretary)
const getAllPapers = async (req, res) => {
    try {
        // Query parameters for filtering
        const { status, category, author } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (category) filter.category = category;
        if (author) filter.author = author;

        // Restrict Sub-Editors to only see papers that belong to their assigned Professional Fields
        if (req.user.role === 'Sub Editor') {
            const assignedFields = await ProfessionalField.find({ subEditor: req.user._id });
            const allowedCategories = assignedFields.map(f => f.name);

            if (category) {
                // If they requested a category they don't have access to, force empty query
                if (!allowedCategories.includes(category)) {
                    filter.category = { $in: [] };
                }
            } else {
                // Show everything they have access to
                filter.category = { $in: allowedCategories };
            }
        }

        const papers = await Paper.find(filter)
            .populate('author', 'name email')
            .populate('assignedReviewers', 'name email')
            .populate('conference', 'title conferenceDate')
            .sort({ createdAt: -1 })
            .select('-filePath');

        res.status(200).json({
            success: true,
            count: papers.length,
            data: {
                papers
            }
        });
    } catch (error) {
        console.error('Get all papers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching papers',
            error: error.message
        });
    }
};

// @desc    Get single paper by ID
// @route   GET /api/papers/:id
// @access  Private
const getPaperById = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id)
            .populate('author', 'name email')
            .populate('assignedReviewers', 'name email')
            .populate('conference', 'title conferenceDate submissionDeadline');

        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Check if user has permission to view
        const isAssignedReviewer = paper.assignedReviewers && paper.assignedReviewers.some(
            reviewer => reviewer._id.toString() === req.user._id.toString()
        );

        const canView =
            paper.author._id.toString() === req.user._id.toString() ||
            isAssignedReviewer ||
            ['Secretary', 'Editor', 'Sub Editor'].includes(req.user.role);

        if (!canView) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this paper'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                paper
            }
        });
    } catch (error) {
        console.error('Get paper by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching paper',
            error: error.message
        });
    }
};

// @desc    Update paper metadata
// @route   PUT /api/papers/:id
// @access  Private (Author of the paper)
const updatePaper = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);

        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Check if user is the author
        if (paper.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own papers'
            });
        }

        // Only allow updating certain fields
        const { title, abstract, keywords, category, coAuthors } = req.body;

        if (title) paper.title = title;
        if (abstract) paper.abstract = abstract;
        if (keywords) {
            // Support keywords as a comma-separated string or array
            if (typeof keywords === 'string') {
                paper.keywords = keywords.split(',').map(k => k.trim()).filter(k => k);
            } else {
                paper.keywords = keywords;
            }
        }
        if (category) paper.category = category;
        if (coAuthors) {
            try {
                paper.coAuthors = typeof coAuthors === 'string'
                    ? JSON.parse(coAuthors)
                    : coAuthors;
            } catch (err) {
                // Ignore if parse fails
            }
        }

        // If a new PDF file is uploaded, update file fields and remove the old file
        if (req.file) {
            if (fs.existsSync(paper.filePath)) {
                fs.unlinkSync(paper.filePath);
            }
            paper.filename = req.file.filename;
            paper.originalName = req.file.originalname;
            paper.filePath = req.file.path;
            paper.fileSize = req.file.size;
            paper.mimeType = req.file.mimetype;

            // Note: Re-uploads are used for revisions and camera-ready.
            // When an author re-uploads a paper in 'revision_required', we update status back to 'submitted'
            // to indicate they handled the revision.
            if (paper.status === 'revision_required') {
                paper.status = 'submitted';

                // Also send a notification to the assigned reviewer (if any) or sub-editor?
                // Left out for brevity unless specifically needed.
            }
        }

        await paper.save();

        res.status(200).json({
            success: true,
            message: 'Paper updated successfully',
            data: {
                paper
            }
        });
    } catch (error) {
        console.error('Update paper error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating paper',
            error: error.message
        });
    }
};

// @desc    Delete paper
// @route   DELETE /api/papers/:id
// @access  Private (Author or Secretary)
const deletePaper = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);

        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Check if user is author or secretary
        const canDelete =
            paper.author.toString() === req.user._id.toString() ||
            req.user.role === 'Secretary';

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this paper'
            });
        }

        // Delete the file from filesystem
        if (fs.existsSync(paper.filePath)) {
            fs.unlinkSync(paper.filePath);
        }

        // Delete from database
        await Paper.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Paper deleted successfully'
        });
    } catch (error) {
        console.error('Delete paper error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting paper',
            error: error.message
        });
    }
};

// @desc    Download paper PDF
// @route   GET /api/papers/:id/download
// @access  Private
const downloadPaper = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);

        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        const isAssignedReviewer = paper.assignedReviewers && paper.assignedReviewers.some(
            reviewer => reviewer.toString() === req.user._id.toString()
        );

        // Check if user has permission to download
        const canDownload =
            paper.author.toString() === req.user._id.toString() ||
            isAssignedReviewer ||
            ['Secretary', 'Editor', 'Sub Editor'].includes(req.user.role);

        if (!canDownload) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to download this paper'
            });
        }

        // Check if file exists
        if (!fs.existsSync(paper.filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server'
            });
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${paper.originalName}"`);

        // Stream the file
        const fileStream = fs.createReadStream(paper.filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Download paper error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while downloading paper',
            error: error.message
        });
    }
};

// @desc    Get all users with Reviewer role
// @route   GET /api/papers/reviewers
// @access  Private (Secretary)
const getReviewers = async (req, res) => {
    try {
        const query = { role: 'Reviewer' };
        if (req.query.category) {
            query.professionalField = req.query.category;
        }
        const reviewers = await User.find(query).select('name email professionalField');

        res.status(200).json({
            success: true,
            count: reviewers.length,
            data: { reviewers }
        });
    } catch (error) {
        console.error('Get reviewers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching reviewers',
            error: error.message
        });
    }
};

// @desc    Assign a reviewer to a paper
// @route   PUT /api/papers/:id/assign-reviewer
// @access  Private (Secretary, Editor)
const assignReviewer = async (req, res) => {
    try {
        // Only Secretary and Editor can assign reviewers
        if (!['Secretary', 'Editor'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only the Secretary or Editor can assign reviewers'
            });
        }

        const { reviewerId } = req.body;
        if (!reviewerId) {
            return res.status(400).json({
                success: false,
                message: 'reviewerId is required'
            });
        }

        const paper = await Paper.findById(req.params.id);
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Validate that the reviewer exists and has the Reviewer role
        const reviewer = await User.findById(reviewerId).select('name email role professionalField');
        if (!reviewer || reviewer.role !== 'Reviewer') {
            return res.status(404).json({
                success: false,
                message: 'Reviewer not found or user does not have the Reviewer role'
            });
        }

        // Check if reviewer is already assigned
        if (paper.assignedReviewers.includes(reviewerId)) {
            return res.status(400).json({
                success: false,
                message: 'Reviewer is already assigned to this paper'
            });
        }

        // Push reviewer back to array
        paper.assignedReviewers.push(reviewerId);

        // Update status to under review if this is the first reviewer assigned and status is 'submitted'
        if (paper.status === 'submitted') {
            paper.status = 'under_review';
        }

        await paper.save();

        // Return populated paper
        const updatedPaper = await Paper.findById(paper._id)
            .populate('author', 'name email')
            .populate('assignedReviewers', 'name email')
            .select('-filePath');

        // Send email notification to reviewer asynchronously
        sendEmail({
            to: reviewer.email,
            subject: `Action Required: You have been assigned to review a paper`,
            text: `Hello ${reviewer.name},\n\nYou have been assigned to review the paper titled "${updatedPaper.title}".\n\nPlease log in to your dashboard to complete the review.\n\nThank you,\nCMT System`,
            html: `<p>Hello ${reviewer.name},</p><p>You have been assigned to review the paper titled <strong>"${updatedPaper.title}"</strong>.</p><p>Please log in to your dashboard to complete the review.</p><p>Thank you,<br/>CMT System</p>`
        });

        res.status(200).json({
            success: true,
            message: `Reviewer "${reviewer.name}" assigned to paper successfully`,
            data: { paper: updatedPaper }
        });
    } catch (error) {
        console.error('Assign reviewer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while assigning reviewer',
            error: error.message
        });
    }
};

// @desc    Unassign a reviewer from a paper
// @route   DELETE /api/papers/:id/assign-reviewer
// @access  Private (Secretary, Editor)
const unassignReviewer = async (req, res) => {
    try {
        // Only Secretary and Editor can unassign reviewers
        if (!['Secretary', 'Editor'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only the Secretary or Editor can unassign reviewers'
            });
        }

        const { reviewerId } = req.body;
        if (!reviewerId) {
            return res.status(400).json({
                success: false,
                message: 'reviewerId is required in the request body'
            });
        }

        const paper = await Paper.findById(req.params.id);
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        if (!paper.assignedReviewers || !paper.assignedReviewers.includes(reviewerId)) {
            return res.status(400).json({
                success: false,
                message: 'This reviewer is not assigned to this paper'
            });
        }

        // Filter out the reviewer
        paper.assignedReviewers = paper.assignedReviewers.filter(
            id => id.toString() !== reviewerId.toString()
        );

        // Revert status if there are no more reviewers
        if (paper.assignedReviewers.length === 0 && paper.status === 'under_review') {
            paper.status = 'submitted';
        }

        await paper.save();

        const updatedPaper = await Paper.findById(paper._id)
            .populate('author', 'name email')
            .populate('assignedReviewers', 'name email')
            .select('-filePath');

        res.status(200).json({
            success: true,
            message: 'Reviewer unassigned from paper successfully',
            data: { paper: updatedPaper }
        });
    } catch (error) {
        console.error('Unassign reviewer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while unassigning reviewer',
            error: error.message
        });
    }
};

// @desc    Update final decision status of a paper (Accept/Reject)
// @route   PUT /api/papers/:id/status
// @access  Private (Editor, Sub Editor)
const updatePaperStatus = async (req, res) => {
    try {
        if (!['Editor', 'Sub Editor'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only Editors and Sub Editors can change paper status'
            });
        }

        const { status } = req.body;
        const validStatuses = ['accepted', 'rejected', 'revision_required'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const paper = await Paper.findById(req.params.id).populate('author', 'name email');
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Sub Editor can only update papers in their category
        if (req.user.role === 'Sub Editor') {
            const field = await ProfessionalField.findOne({ name: paper.category, subEditor: req.user._id });
            if (!field) {
                return res.status(403).json({
                    success: false,
                    message: "You are not the assigned Sub Editor for this paper's category"
                });
            }
        }

        paper.status = status;
        await paper.save();

        // Send email to Author asynchronously
        sendEmail({
            to: paper.author.email,
            subject: `Update on your submission: ${paper.title}`,
            text: `Hello ${paper.author.name},\n\nThe status of your paper "${paper.title}" has been updated to: ${status.toUpperCase()}.\n\nPlease log in to the CMT Dashboard for more details.\n\nThank you,\nCMT System`,
            html: `<p>Hello ${paper.author.name},</p><p>The status of your paper <strong>"${paper.title}"</strong> has been updated to: <strong>${status.toUpperCase()}</strong>.</p><p>Please log in to the CMT Dashboard for more details.</p><p>Thank you,<br/>CMT System</p>`
        });

        res.status(200).json({
            success: true,
            message: 'Paper status updated and author notified successfully',
            data: { paper }
        });
    } catch (error) {
        console.error('Update paper status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating paper status',
            error: error.message
        });
    }
};

// @desc    Decline a review assignment
// @route   PUT /api/papers/:id/decline-review
// @access  Private (Reviewer)
const declineReview = async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);

        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Check if the current user is an assigned reviewer
        if (!paper.assignedReviewers || !paper.assignedReviewers.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'You are not an assigned reviewer for this paper'
            });
        }

        // Unassign by filtering them out of array
        paper.assignedReviewers = paper.assignedReviewers.filter(
            id => id.toString() !== req.user._id.toString()
        );

        if (paper.assignedReviewers.length === 0 && paper.status === 'under_review') {
            paper.status = 'submitted';
        }

        await paper.save();

        const updatedPaper = await Paper.findById(paper._id)
            .populate('author', 'name email')
            .select('-filePath');

        // Notify the Secretary that the review was declined
        try {
            const secretaries = await User.find({ role: 'Secretary' });
            for (const sec of secretaries) {
                sendEmail({
                    to: sec.email,
                    subject: `Review Assignment Declined: ${paper.title}`,
                    text: `Hello ${sec.name},\n\nAn assigned reviewer has declined to review the paper titled "${paper.title}".\n\nPlease assign a new reviewer.\n\nThank you,\nCMT System`,
                    html: `<p>Hello ${sec.name},</p><p>An assigned reviewer has declined to review the paper titled <strong>"${paper.title}"</strong>.</p><p>Please assign a new reviewer.</p><p>Thank you,<br/>CMT System</p>`
                });
            }
        } catch (mailErr) {
            console.error('Error sending decline notification:', mailErr);
        }

        res.status(200).json({
            success: true,
            message: 'You have successfully declined this review assignment',
            data: { paper: updatedPaper }
        });
    } catch (error) {
        console.error('Decline review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while declining review assignment',
            error: error.message
        });
    }
}

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
