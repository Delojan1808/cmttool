const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const NotificationSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: String,
        message: String,

        type: {
            type: String,
            enum: [
                "submission",
                "review_assignment",
                "decision",
                "deadline"
            ]
        },

        relatedPaper: {
            type: Schema.Types.ObjectId,
            ref: "Paper"
        },

        read: {
            type: Boolean,
            default: false
        },

        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

NotificationSchema.index({ user: 1, read: 1 });

const Notification = model("Notification", NotificationSchema);
module.exports = Notification;
