const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const groupRoutes = require('./routes/groups');
const Group = require('./models/Group');
const Message = require('./models/Message');
const UserSession = require('./models/User');
const { compareGroupPassword } = require('./config/admin');

require('dotenv').config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// CORS configuration - simplified for production
app.use(cors({
    origin: true, // Allow all origins in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/groups', groupRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend for any unknown routes - FIXED: Use a proper catch-all
// app.use('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../frontend/index.html'));
// });

// Socket.io configuration
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket.io for real-time chat
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-group', async (data) => {
        try {
            const { groupName, password, username } = data;
            
            if (!groupName || !password || !username) {
                socket.emit('join-error', 'All fields are required');
                return;
            }

            const group = await Group.findOne({ name: groupName, isActive: true });
            
            if (group && await compareGroupPassword(password, group.password)) {
                // Join socket room
                socket.join(groupName);
                socket.groupName = groupName;
                socket.username = username;
                socket.groupId = group._id;

                // Store user session in database
                const userSession = new UserSession({
                    socketId: socket.id,
                    username: username,
                    group: group._id
                });
                await userSession.save();

                // Get last 50 messages for the group
                const messages = await Message.find({ group: group._id })
                    .sort({ timestamp: 1 })
                    .limit(50)
                    .select('username message timestamp');

                // Notify others in the group
                socket.to(groupName).emit('user-joined', {
                    username: username,
                    message: `${username} joined the chat`,
                    timestamp: new Date().toISOString()
                });

                // Send chat history to new user
                socket.emit('chat-history', messages);

                socket.emit('join-success', { 
                    groupName, 
                    username,
                    groupId: group._id 
                });
                
                console.log(`User ${username} joined group ${groupName}`);
            } else {
                socket.emit('join-error', 'Invalid group name or password');
            }
        } catch (error) {
            console.error('Error joining group:', error);
            socket.emit('join-error', 'Internal server error');
        }
    });

    socket.on('send-message', async (data) => {
        try {
            const { message } = data;
            
            if (!socket.groupId || !socket.username) {
                return;
            }

            const messageData = {
                username: socket.username,
                message: message.trim(),
                group: socket.groupId,
                timestamp: new Date()
            };

            // Save message to database
            const newMessage = new Message(messageData);
            await newMessage.save();

            // Prepare response data
            const responseData = {
                id: newMessage._id,
                username: newMessage.username,
                message: newMessage.message,
                timestamp: newMessage.timestamp.toISOString()
            };

            // Broadcast to group
            io.to(socket.groupName).emit('new-message', responseData);

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message-error', 'Failed to send message');
        }
    });

    socket.on('typing-start', () => {
        if (socket.groupName && socket.username) {
            socket.to(socket.groupName).emit('user-typing', {
                username: socket.username
            });
        }
    });

    socket.on('typing-stop', () => {
        if (socket.groupName) {
            socket.to(socket.groupName).emit('user-stop-typing', {
                username: socket.username
            });
        }
    });

    socket.on('disconnect', async () => {
        try {
            if (socket.groupName && socket.username) {
                // Notify others in the group
                socket.to(socket.groupName).emit('user-left', {
                    username: socket.username,
                    message: `${socket.username} left the chat`,
                    timestamp: new Date().toISOString()
                });

                // Remove user session from database
                await UserSession.findOneAndDelete({ socketId: socket.id });
                
                console.log(`User ${socket.username} left group ${socket.groupName}`);
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, '../frontend')}`);
});

module.exports = { app, io };
