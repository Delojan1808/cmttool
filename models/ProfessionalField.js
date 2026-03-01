const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const ProfessionalFieldSchema = new Schema(
    {
        fieldName: {
            type: String,
            required: true,
            unique: true
        },

        description: String,

        subEditors: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }]
    },
    { timestamps: true }
);

const ProfessionalField = model("ProfessionalField", ProfessionalFieldSchema);
module.exports = ProfessionalField;
