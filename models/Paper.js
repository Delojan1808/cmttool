const mongoose = require('mongoose');

const paperSchema = new mongoose.Schema(
    {
        // Metadata
        title: {
            type: String,
            required: [true, 'Paper title is required'],
            trim: true,
            maxlength: [300, 'Title cannot exceed 300 characters']
        },
        abstract: {
            type: String,
            required: [true, 'Abstract is required'],
            maxlength: [2000, 'Abstract cannot exceed 2000 characters']
        },
        keywords: {
            type: [String],
            validate: {
                validator: function (v) {
                    return v && v.length > 0 && v.length <= 10;
                },
                message: 'Please provide 1-10 keywords'
            }
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProfessionalField',
            required: [true, 'Professional field (category) is required']
        },

        conference: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conference',
            required: [true, 'A paper must belong to a conference']
        },

        // Author Information
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        coAuthors: [
            {
                name: {
                    type: String,
                    required: true
                },
                email: {
                    type: String,
                    match: [
                        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                        'Please provide a valid email address'
                    ]
                },
                affiliation: String
            }
        ],

        // File Information
        filename: {
            type: String,
            required: true
        },
        originalName: {
            type: String,
            required: true
        },
        filePath: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        mimeType: {
            type: String,
            default: 'application/pdf'
        },

        // Status and Workflow
        status: {
            type: String,
            enum: ['draft', 'submitted', 'under_review', 'reviewed', 'accepted', 'rejected', 'revision_required'],
            default: 'submitted'
        },

        // Review Information
        assignedReviewers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        ],
        reviewDeadline: {
            type: Date
        },
        reviewComments: {
            type: String,
            maxlength: [5000, 'Review comments cannot exceed 5000 characters']
        },
        reviewedAt: {
            type: Date
        },

        // Submission metadata
        submittedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Index for efficient queries
paperSchema.index({ author: 1, createdAt: -1 });
paperSchema.index({ status: 1 });
paperSchema.index({ category: 1 });

// Virtual for author's full name (when populated)
paperSchema.virtual('authorName').get(function () {
    return this.author && this.author.name ? this.author.name : 'Unknown';
});

// Method to check if user can edit this paper
paperSchema.methods.canEdit = function (userId) {
    return this.author.toString() === userId.toString();
};

const Paper = mongoose.model('Paper', paperSchema);

module.exports = Paper;
