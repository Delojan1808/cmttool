const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
    answer: {
        type: Boolean,
        required: true // true = Yes, false = No
    },
    comment: {
        type: String,
        required: function () { return this.answer === false; } // Comment is strictly required if answer = No
    }
}, { _id: false });

const reviewSchema = new mongoose.Schema(
    {
        paper: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Paper',
            required: [true, 'Paper reference is required']
        },
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Reviewer reference is required']
        },
        evaluations: {
            q1_topicRelevant: evaluationSchema,
            q2_titleRelevant: evaluationSchema,
            q3_objectivesClear: evaluationSchema,
            q4_methodologyAppropriate: evaluationSchema,
            q5_resultsInterpreted: evaluationSchema,
            q6_conclusionTies: evaluationSchema,
            q7_grammarSpelling: evaluationSchema,
            q8_formattingAdheres: evaluationSchema,
            q9_noPlagiarism: evaluationSchema
        },
        recommendation: {
            type: String,
            required: [true, 'Recommendation is required'],
            enum: [
                'Accept',
                'Accept with minor revisions',
                'Reconsider after major revisions',
                'Reject'
            ]
        },
        suggestions: {
            type: String
        },
        otherComments: {
            type: String
        },
        reviewerInfo: {
            nameWithInitials: { type: String, required: true },
            designation: { type: String, required: true },
            institution: { type: String, required: true },
            email: {
                type: String,
                required: true,
                match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
            },
            contactNumber: { type: String, required: true },
            date: { type: Date, default: Date.now }
        }
    },
    {
        timestamps: true
    }
);

// A reviewer can only submit ONE review per paper
reviewSchema.index({ paper: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
