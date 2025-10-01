const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient querying
messageSchema.index({ group: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);