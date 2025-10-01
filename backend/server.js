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

// CORS configuration
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());

// Serve static files from frontend directory - THIS SERVES YOUR FRONTEND
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/groups', groupRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Server is running successfully'
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Socket.io configuration
const io = socketIo(server, {
    cors: {
        origin: "*",
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
                socket.join(groupName);
                socket.groupName = groupName;
                socket.username = username;
                socket.groupId = group._id;

                // Store user session
                const userSession = new UserSession({
                    socketId: socket.id,
                    username: username,
                    group: group._id
                });
                await userSession.save();

                // Get messages
                const messages = await Message.find({ group: group._id })
                    .sort({ timestamp: 1 })
                    .limit(50)
                    .select('username message timestamp');

                // Notify others
                socket.to(groupName).emit('user-joined', {
                    username: username,
                    message: `${username} joined the chat`,
                    timestamp: new Date().toISOString()
                });

                // Send history
                socket.emit('chat-history', messages);
                socket.emit('join-success', { groupName, username, groupId: group._id });
                
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
            
            if (!socket.groupId || !socket.username) return;

            const messageData = {
                username: socket.username,
                message: message.trim(),
                group: socket.groupId,
                timestamp: new Date()
            };

            const newMessage = new Message(messageData);
            await newMessage.save();

            const responseData = {
                id: newMessage._id,
                username: newMessage.username,
                message: newMessage.message,
                timestamp: newMessage.timestamp.toISOString()
            };

            io.to(socket.groupName).emit('new-message', responseData);

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message-error', 'Failed to send message');
        }
    });

    socket.on('disconnect', async () => {
        try {
            if (socket.groupName && socket.username) {
                socket.to(socket.groupName).emit('user-left', {
                    username: socket.username,
                    message: `${socket.username} left the chat`,
                    timestamp: new Date().toISOString()
                });

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
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Frontend served from: ${path.join(__dirname, '../frontend')}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, io };
