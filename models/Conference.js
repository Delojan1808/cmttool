const mongoose = require('mongoose');

const conferenceSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Conference title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters']
        },
        professionalFields: {
            type: [String],
            required: [true, 'At least one professional field is required'],
            validate: {
                validator: function (v) {
                    return v && v.length > 0;
                },
                message: 'Please provide at least one professional field'
            }
        },
        submissionDeadline: {
            type: Date,
            required: [true, 'Submission deadline is required']
        },
        conferenceDate: {
            type: Date,
            required: [true, 'Conference date is required']
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
);

const Conference = mongoose.model('Conference', conferenceSchema);

module.exports = Conference;
