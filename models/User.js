const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema, model } = mongoose;

const UserSchema = new Schema(
    {
        name: { type: String, required: true },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email address'
            ]
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        roles: [{
            type: String,
            enum: [
                "Author",
                "Reviewer",
                "Editor",
                "Secretary",
                "SubEditor",
                "Sub Editor"   // alias — normalised to SubEditor by pre-save hook
            ]
        }],

        professionalFields: [{
            type: Schema.Types.ObjectId,
            ref: "ProfessionalField"
        }],

        affiliation: String,
        country: String,

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);




// Normalise role aliases before saving ('Sub Editor' → 'SubEditor')
UserSchema.pre('save', function (next) {
    if (this.isModified('roles')) {
        this.roles = this.roles.map(r => r === 'Sub Editor' ? 'SubEditor' : r);
    }
    next();
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare entered password with hashed password
UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get user data without password
UserSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

const User = model("User", UserSchema);
module.exports = User;
