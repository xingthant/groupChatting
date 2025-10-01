const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Message = require('../models/Message');
const { verifyAdmin, hashGroupPassword, compareGroupPassword } = require('../config/admin');

// Admin only - Create group
router.post('/create', verifyAdmin, async (req, res) => {
    try {
        const { groupName, password } = req.body;
        
        if (!groupName || !password) {
            return res.status(400).json({ error: 'Group name and password are required' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }
        
        const existingGroup = await Group.findOne({ name: groupName });
        if (existingGroup) {
            return res.status(400).json({ error: 'Group already exists' });
        }
        
        const hashedPassword = await hashGroupPassword(password);
        
        const newGroup = new Group({
            name: groupName,
            password: hashedPassword
        });
        
        await newGroup.save();
        
        res.json({ 
            message: 'Group created successfully', 
            group: { 
                name: newGroup.name, 
                createdAt: newGroup.createdAt 
            } 
        });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin only - Update group
router.put('/:groupName', verifyAdmin, async (req, res) => {
    try {
        const { groupName } = req.params;
        const { newGroupName, newPassword } = req.body;
        
        const group = await Group.findOne({ name: groupName });
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        if (newGroupName && newGroupName !== groupName) {
            const existingGroup = await Group.findOne({ name: newGroupName });
            if (existingGroup) {
                return res.status(400).json({ error: 'New group name already exists' });
            }
            group.name = newGroupName;
        }
        
        if (newPassword) {
            if (newPassword.length < 4) {
                return res.status(400).json({ error: 'Password must be at least 4 characters long' });
            }
            group.password = await hashGroupPassword(newPassword);
        }
        
        await group.save();
        
        res.json({ 
            message: 'Group updated successfully', 
            group: { 
                name: group.name, 
                updatedAt: group.updatedAt 
            } 
        });
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin only - Delete group
router.delete('/:groupName', verifyAdmin, async (req, res) => {
    try {
        const { groupName } = req.params;
        
        const group = await Group.findOne({ name: groupName });
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Delete all messages associated with the group
        await Message.deleteMany({ group: group._id });
        
        // Delete the group
        await Group.findByIdAndDelete(group._id);
        
        res.json({ message: 'Group and all associated messages deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all groups (admin only)
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const groups = await Group.find({ isActive: true })
            .select('name createdAt updatedAt')
            .sort({ createdAt: -1 });
            
        // Get message counts for each group
        const groupsWithStats = await Promise.all(
            groups.map(async (group) => {
                const messageCount = await Message.countDocuments({ group: group._id });
                return {
                    name: group.name,
                    createdAt: group.createdAt,
                    updatedAt: group.updatedAt,
                    messageCount: messageCount
                };
            })
        );
        
        res.json(groupsWithStats);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get group statistics (admin only)
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        const totalGroups = await Group.countDocuments();
        const totalMessages = await Message.countDocuments();
        const recentGroups = await Group.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name createdAt');
            
        res.json({
            totalGroups,
            totalMessages,
            recentGroups
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;