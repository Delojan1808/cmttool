const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const ReviewSchema = new Schema(
    {
        paper: {
            type: Schema.Types.ObjectId,
            ref: "Paper",
            required: true
        },

        reviewer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        recommendation: {
            type: String,
            enum: [
                "strong_accept",
                "accept",
                "minor_revision",
                "major_revision",
                "reject"
            ]
        },

        score: Number,

        commentsToAuthor: String,
        confidentialComments: String,

        status: {
            type: String,
            enum: ["assigned", "submitted"],
            default: "assigned"
        },

        submittedAt: Date
    },
    { timestamps: true }
);

/* One reviewer → one review per paper */
ReviewSchema.index(
    { paper: 1, reviewer: 1 },
    { unique: true }
);

const Review = model("Review", ReviewSchema);
module.exports = Review;
