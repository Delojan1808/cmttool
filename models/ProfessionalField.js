const mongoose = require('mongoose');

const professionalFieldSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Field name is required'],
            unique: true,
            trim: true,
            maxlength: [100, 'Field name cannot exceed 100 characters']
        }
    },
    {
        timestamps: true
    }
);

const ProfessionalField = mongoose.model('ProfessionalField', professionalFieldSchema);

module.exports = ProfessionalField;
