const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const ConferenceSchema = new Schema(
    {
        title: { type: String, required: true },
        acronym: String,
        description: String,

        startDate: Date,
        endDate: Date,

        submissionDeadline: Date,
        reviewDeadline: Date,

        fields: [{
            type: Schema.Types.ObjectId,
            ref: "ProfessionalField"
        }],

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },

        status: {
            type: String,
            enum: [
                "upcoming",
                "submission_open",
                "reviewing",
                "decision_made",
                "completed"
            ],
            default: "upcoming"
        },

        sessions: [{
            title: String,
            scheduledTime: Date,
            papers: [{
                type: Schema.Types.ObjectId,
                ref: "Paper"
            }]
        }]
    },
    { timestamps: true }
);

const Conference = model("Conference", ConferenceSchema);
module.exports = Conference;
