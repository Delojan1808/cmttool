const ProfessionalField = require('../models/ProfessionalField');
const { validationResult } = require('express-validator');

// @desc    Get all professional fields
// @route   GET /api/fields
// @access  Public (so users can select them during registration)
const getFields = async (req, res) => {
    try {
        const fields = await ProfessionalField.find({})
            .populate('subEditor', 'name email')
            .sort('name');
        res.status(200).json({
            success: true,
            count: fields.length,
            data: { fields }
        });
    } catch (error) {
        console.error('Get fields error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching fields',
            error: error.message
        });
    }
};

// @desc    Create a new professional field
// @route   POST /api/fields
// @access  Private (Secretary only)
const createField = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name } = req.body;

        // Ensure uniqueness
        const fieldExists = await ProfessionalField.findOne({ name: new RegExp('^' + name + '$', 'i') });
        if (fieldExists) {
            return res.status(400).json({
                success: false,
                message: 'A field with this name already exists'
            });
        }

        const field = await ProfessionalField.create({ name });

        res.status(201).json({
            success: true,
            data: { field }
        });
    } catch (error) {
        console.error('Create field error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating field',
            error: error.message
        });
    }
};

// @desc    Update a professional field
// @route   PUT /api/fields/:id
// @access  Private (Secretary only)
const updateField = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name } = req.body;
        let field = await ProfessionalField.findById(req.params.id);

        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Field not found'
            });
        }

        // Check for duplicate name
        const duplicate = await ProfessionalField.findOne({ name: new RegExp('^' + name + '$', 'i') });
        if (duplicate && duplicate._id.toString() !== req.params.id) {
            return res.status(400).json({
                success: false,
                message: 'Another field with this name already exists'
            });
        }

        field.name = name;
        await field.save();

        res.status(200).json({
            success: true,
            data: { field }
        });
    } catch (error) {
        console.error('Update field error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating field',
            error: error.message
        });
    }
};

// @desc    Delete a professional field
// @route   DELETE /api/fields/:id
// @access  Private (Secretary only)
const deleteField = async (req, res) => {
    try {
        const field = await ProfessionalField.findById(req.params.id);

        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Field not found'
            });
        }

        // Ideally, we might check if any users are currently assigned 'field.name' before deleting
        // but for simplicity in CRUD, we will just delete the field.

        await field.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Field deleted successfully'
        });
    } catch (error) {
        console.error('Delete field error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting field',
            error: error.message
        });
    }
};

// @desc    Assign a Sub-Editor to a professional field
// @route   PUT /api/fields/:id/subeditor
// @access  Private (Editor only)
const assignSubEditor = async (req, res) => {
    try {
        const { subEditorId } = req.body;

        let field = await ProfessionalField.findById(req.params.id);
        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Field not found'
            });
        }

        // Allow null assignment (unassign) or a valid ID
        field.subEditor = subEditorId || null;
        await field.save();

        // Populate so caller gets updated details
        field = await ProfessionalField.findById(field._id).populate('subEditor', 'name email');

        res.status(200).json({
            success: true,
            message: 'Sub-Editor assigned successfully',
            data: { field }
        });
    } catch (error) {
        console.error('Assign sub-editor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while assigning sub-editor',
            error: error.message
        });
    }
};

module.exports = {
    getFields,
    createField,
    updateField,
    deleteField,
    assignSubEditor
};
