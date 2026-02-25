const Paper = require('../models/Paper');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

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
        const { title, abstract, keywords, category, coAuthors } = req.body;

        // Validate required fields
        if (!title || !abstract || !category) {
            // Delete uploaded file if validation fails
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Title, abstract, and category are required'
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
            filename: req.file.filename,
            originalName: req.file.originalname,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });

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

        const papers = await Paper.find(filter)
            .populate('author', 'name email')
            .populate('reviewer', 'name email')
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
            .populate('reviewer', 'name email');

        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        // Check if user has permission to view
        const canView =
            paper.author._id.toString() === req.user._id.toString() ||
            (paper.reviewer && paper.reviewer._id.toString() === req.user._id.toString()) ||
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
        if (keywords) paper.keywords = keywords;
        if (category) paper.category = category;
        if (coAuthors) paper.coAuthors = coAuthors;

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

        // Check if user has permission to download
        const canDownload =
            paper.author.toString() === req.user._id.toString() ||
            (paper.reviewer && paper.reviewer.toString() === req.user._id.toString()) ||
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
        const reviewers = await User.find({ role: 'Reviewer' }).select('name email professionalField');

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
// @access  Private (Secretary)
const assignReviewer = async (req, res) => {
    try {
        // Only Secretary can assign reviewers
        if (req.user.role !== 'Secretary') {
            return res.status(403).json({
                success: false,
                message: 'Only Secretaries can assign reviewers'
            });
        }

        const { reviewerId } = req.body;
        if (!reviewerId) {
            return res.status(400).json({
                success: false,
                message: 'reviewerId is required'
            });
        }

        // Validate that the reviewer exists and has the Reviewer role
        const reviewer = await User.findById(reviewerId).select('name email role');
        if (!reviewer || reviewer.role !== 'Reviewer') {
            return res.status(404).json({
                success: false,
                message: 'Reviewer not found or user does not have the Reviewer role'
            });
        }

        const paper = await Paper.findById(req.params.id);
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        paper.reviewer = reviewerId;
        paper.status = 'under_review';
        await paper.save();

        // Return populated paper
        const updatedPaper = await Paper.findById(paper._id)
            .populate('author', 'name email')
            .populate('reviewer', 'name email')
            .select('-filePath');

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
// @access  Private (Secretary)
const unassignReviewer = async (req, res) => {
    try {
        // Only Secretary can unassign reviewers
        if (req.user.role !== 'Secretary') {
            return res.status(403).json({
                success: false,
                message: 'Only Secretaries can unassign reviewers'
            });
        }

        const paper = await Paper.findById(req.params.id);
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        if (!paper.reviewer) {
            return res.status(400).json({
                success: false,
                message: 'This paper does not have a reviewer assigned'
            });
        }

        paper.reviewer = undefined;
        paper.status = 'submitted';
        await paper.save();

        const updatedPaper = await Paper.findById(paper._id)
            .populate('author', 'name email')
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

module.exports = {
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
};
