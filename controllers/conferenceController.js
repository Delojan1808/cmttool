const Conference = require('../models/Conference');
const ProfessionalField = require('../models/ProfessionalField');
const mongoose = require('mongoose');

// @desc    Create a new conference
// @route   POST /api/conferences
// @access  Private (Secretary only)
exports.createConference = async (req, res) => {
    try {
        const { title, professionalFields, submissionDeadline, conferenceDate } = req.body;

        // Basic validation
        if (!title || !professionalFields || !submissionDeadline || !conferenceDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Resolve field names or IDs to ObjectIds
        const fieldArray = Array.isArray(professionalFields) ? professionalFields : [professionalFields];
        const fieldIds = [];
        for (const f of fieldArray) {
            if (mongoose.Types.ObjectId.isValid(f)) {
                fieldIds.push(new mongoose.Types.ObjectId(f));
            } else {
                const fieldDoc = await ProfessionalField.findOne({ name: f });
                if (!fieldDoc) {
                    return res.status(400).json({ success: false, message: `Professional field "${f}" not found` });
                }
                fieldIds.push(fieldDoc._id);
            }
        }

        // Validate dates
        const now = new Date();
        const subDeadline = new Date(submissionDeadline);
        const confDate = new Date(conferenceDate);

        if (subDeadline <= now) {
            return res.status(400).json({ success: false, message: 'Submission deadline must be a future date.' });
        }
        if (confDate <= now) {
            return res.status(400).json({ success: false, message: 'Conference date must be a future date.' });
        }
        if (confDate <= subDeadline) {
            return res.status(400).json({ success: false, message: 'Conference date must be after the submission deadline.' });
        }

        const conference = await Conference.create({
            title,
            professionalFields: fieldIds,
            submissionDeadline,
            conferenceDate,
            createdBy: req.user._id
        });

        // Return with populated fields
        const populated = await Conference.findById(conference._id)
            .populate('professionalFields', 'name')
            .populate('createdBy', 'name email');

        res.status(201).json({
            success: true,
            data: populated
        });
    } catch (error) {
        console.error('Error in createConference:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating conference',
            error: error.message
        });
    }
};

// @desc    Get all conferences
// @route   GET /api/conferences
// @access  Private
exports.getAllConferences = async (req, res) => {
    try {
        const conferences = await Conference.find()
            .populate('professionalFields', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: conferences.length,
            data: conferences
        });
    } catch (error) {
        console.error('Error in getAllConferences:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching conferences'
        });
    }
};

// @desc    Update a conference
// @route   PUT /api/conferences/:id
// @access  Private (Secretary only)
exports.updateConference = async (req, res) => {
    try {
        let conference = await Conference.findById(req.params.id);

        if (!conference) {
            return res.status(404).json({
                success: false,
                message: 'Conference not found'
            });
        }

        // If professionalFields is being updated, resolve names → ObjectIds
        if (req.body.professionalFields) {
            const fieldArray = Array.isArray(req.body.professionalFields)
                ? req.body.professionalFields
                : [req.body.professionalFields];
            const fieldIds = [];
            for (const f of fieldArray) {
                if (mongoose.Types.ObjectId.isValid(f)) {
                    fieldIds.push(new mongoose.Types.ObjectId(f));
                } else {
                    const fieldDoc = await ProfessionalField.findOne({ name: f });
                    if (!fieldDoc) {
                        return res.status(400).json({ success: false, message: `Professional field "${f}" not found` });
                    }
                    fieldIds.push(fieldDoc._id);
                }
            }
            req.body.professionalFields = fieldIds;
        }

        // Validate dates if they are being updated
        if (req.body.submissionDeadline || req.body.conferenceDate) {
            const subDeadline = new Date(req.body.submissionDeadline || conference.submissionDeadline);
            const confDate = new Date(req.body.conferenceDate || conference.conferenceDate);
            if (confDate <= subDeadline) {
                return res.status(400).json({ success: false, message: 'Conference date must be after the submission deadline.' });
            }
        }

        conference = await Conference.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate('professionalFields', 'name');

        res.status(200).json({
            success: true,
            data: conference
        });
    } catch (error) {
        console.error('Error in updateConference:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating conference',
            error: error.message
        });
    }
};

// @desc    Delete a conference
// @route   DELETE /api/conferences/:id
// @access  Private (Secretary only)
exports.deleteConference = async (req, res) => {
    try {
        const conference = await Conference.findById(req.params.id);

        if (!conference) {
            return res.status(404).json({
                success: false,
                message: 'Conference not found'
            });
        }

        await conference.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error('Error in deleteConference:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting conference',
            error: error.message
        });
    }
};

// @desc    Add a session to a conference
// @route   POST /api/conferences/:id/sessions
// @access  Private (Secretary only)
exports.addSession = async (req, res) => {
    try {
        const conference = await Conference.findById(req.params.id);
        if (!conference) {
            return res.status(404).json({ success: false, message: 'Conference not found' });
        }

        const { name, startTime, endTime } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Session name is required' });
        }

        conference.sessions.push({ name, startTime, endTime, papers: [] });
        await conference.save();

        res.status(201).json({ success: true, data: conference });
    } catch (error) {
        console.error('Error in addSession:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// @desc    Assign a paper to a session
// @route   PUT /api/conferences/:id/sessions/:sessionId/papers
// @access  Private (Secretary only)
exports.assignPaperToSession = async (req, res) => {
    try {
        const conference = await Conference.findById(req.params.id);
        if (!conference) {
            return res.status(404).json({ success: false, message: 'Conference not found' });
        }

        const session = conference.sessions.id(req.params.sessionId);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        const { paperId } = req.body;
        if (!paperId) {
            return res.status(400).json({ success: false, message: 'Paper ID is required' });
        }

        // Prevent duplicate paper assignment in the same session
        if (!session.papers.includes(paperId)) {
            session.papers.push(paperId);
            await conference.save();
        }

        res.status(200).json({ success: true, data: conference });
    } catch (error) {
        console.error('Error in assignPaperToSession:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
