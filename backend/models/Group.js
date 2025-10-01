const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    createdBy: {
        type: String,
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for better performance
groupSchema.index({ name: 1 });
groupSchema.index({ isActive: 1 });

module.exports = mongoose.model('Group', groupSchema);