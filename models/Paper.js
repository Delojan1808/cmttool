const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const PaperSchema = new Schema(
    {
        title: { type: String, required: true },

        abstract: String,

        keywords: [String],

        authors: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }],

        conference: {
            type: Schema.Types.ObjectId,
            ref: "Conference",
            required: true
        },

        field: {
            type: Schema.Types.ObjectId,
            ref: "ProfessionalField"
        },

        fileUrl: String,
        fileName: String,

        submissionDate: {
            type: Date,
            default: Date.now
        },

        status: {
            type: String,
            enum: [
                "submitted",
                "under_review",
                "reviewed",
                "revision_required",
                "accepted",
                "rejected"
            ],
            default: "submitted"
        },

        finalDecision: String,

        decisionBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },

        decisionDate: Date
    },
    { timestamps: true }
);

PaperSchema.index({ conference: 1 });
PaperSchema.index({ authors: 1 });
PaperSchema.index({ status: 1 });

const Paper = model("Paper", PaperSchema);
module.exports = Paper;
