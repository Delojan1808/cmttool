const Conference = require('../models/Conference');

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

        const conference = await Conference.create({
            title,
            professionalFields,
            submissionDeadline,
            conferenceDate,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            data: conference
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

        // Optional: Check if the user updating is the one who created it
        // if (conference.createdBy.toString() !== req.user._id.toString()) {
        //     return res.status(403).json({ success: false, message: 'Not authorized to update this conference' });
        // }

        conference = await Conference.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

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
