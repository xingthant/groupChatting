const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
    socketId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

userSessionSchema.index({ socketId: 1 });
userSessionSchema.index({ group: 1 });

module.exports = mongoose.model('UserSession', userSessionSchema);