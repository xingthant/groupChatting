const socket = io();

// DOM Elements
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const chatSection = document.getElementById('chat-section');
const loginForm = document.getElementById('login-form');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const groupDisplay = document.getElementById('group-display');

let currentGroup = '';
let currentUsername = '';
let typingTimer;

// Socket event listeners
socket.on('join-success', (data) => {
    currentGroup = data.groupName;
    currentUsername = data.username;
    groupDisplay.textContent = currentGroup;
    showSection(chatSection);
    clearError('login-error');
});

socket.on('join-error', (message) => {
    showError('login-error', message);
});

socket.on('chat-history', (messages) => {
    chatMessages.innerHTML = '';
    messages.forEach(message => {
        addMessageToChat(message);
    });
});

socket.on('new-message', (message) => {
    addMessageToChat(message);
});

socket.on('user-joined', (data) => {
    addSystemMessage(data.message);
});

socket.on('user-left', (data) => {
    addSystemMessage(data.message);
});

socket.on('user-typing', (data) => {
    showTypingIndicator(data.username);
});

socket.on('user-stop-typing', (data) => {
    hideTypingIndicator(data.username);
});

socket.on('message-error', (message) => {
    showError('chat-error', message);
});

// Form submission
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const groupName = document.getElementById('group-name').value;
    const password = document.getElementById('group-password').value;
    const username = document.getElementById('username').value;
    
    if (!groupName || !password || !username) {
        showError('login-error', 'All fields are required');
        return;
    }
    
    socket.emit('join-group', {
        groupName: groupName.trim(),
        password: password,
        username: username.trim()
    });
});

// Message sending
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('send-message', { message });
        messageInput.value = '';
        socket.emit('typing-stop');
    }
}

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Typing indicators
messageInput.addEventListener('input', () => {
    socket.emit('typing-start');
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing-stop');
    }, 1000);
});

// Admin functions (remain the same as previous version)
async function createGroup() {
    const adminPassword = document.getElementById('admin-password').value;
    const groupName = document.getElementById('new-group-name').value;
    const groupPassword = document.getElementById('new-group-password').value;
    
    if (!adminPassword || !groupName || !groupPassword) {
        showAdminMessage('All fields are required', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/groups/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'admin-password': adminPassword
            },
            body: JSON.stringify({ groupName, password: groupPassword })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminMessage('Group created successfully!', 'success');
            document.getElementById('new-group-name').value = '';
            document.getElementById('new-group-password').value = '';
        } else {
            showAdminMessage(result.error, 'error');
        }
    } catch (error) {
        showAdminMessage('Error creating group', 'error');
    }
}

async function updateGroup() {
    const adminPassword = document.getElementById('admin-password').value;
    const groupName = document.getElementById('update-group-name').value;
    const newName = document.getElementById('updated-name').value;
    const newPassword = document.getElementById('updated-password').value;
    
    if (!adminPassword || !groupName) {
        showAdminMessage('Admin password and group name are required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${encodeURIComponent(groupName)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'admin-password': adminPassword
            },
            body: JSON.stringify({ 
                newGroupName: newName || undefined, 
                newPassword: newPassword || undefined 
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminMessage('Group updated successfully!', 'success');
            document.getElementById('update-group-name').value = '';
            document.getElementById('updated-name').value = '';
            document.getElementById('updated-password').value = '';
        } else {
            showAdminMessage(result.error, 'error');
        }
    } catch (error) {
        showAdminMessage('Error updating group', 'error');
    }
}

async function deleteGroup() {
    const adminPassword = document.getElementById('admin-password').value;
    const groupName = document.getElementById('delete-group-name').value;
    
    if (!adminPassword || !groupName) {
        showAdminMessage('Admin password and group name are required', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete group "${groupName}"? This will also delete all messages in this group.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${encodeURIComponent(groupName)}`, {
            method: 'DELETE',
            headers: {
                'admin-password': adminPassword
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminMessage('Group deleted successfully!', 'success');
            document.getElementById('delete-group-name').value = '';
        } else {
            showAdminMessage(result.error, 'error');
        }
    } catch (error) {
        showAdminMessage('Error deleting group', 'error');
    }
}

// New: Get group statistics
async function getGroupStats() {
    const adminPassword = document.getElementById('admin-password').value;
    
    if (!adminPassword) {
        showAdminMessage('Admin password required', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/groups/stats', {
            headers: {
                'admin-password': adminPassword
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminMessage(`Stats: ${result.totalGroups} groups, ${result.totalMessages} total messages`, 'success');
        } else {
            showAdminMessage(result.error, 'error');
        }
    } catch (error) {
        showAdminMessage('Error fetching stats', 'error');
    }
}

// UI Helper functions
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    section.classList.add('active');
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}

function showAdminMessage(message, type) {
    const messageElement = document.getElementById('admin-message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }, 5000);
}

function addMessageToChat(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message-item ${message.username === currentUsername ? 'own' : ''}`;
    
    messageElement.innerHTML = `
        <div class="message-meta">
            <strong>${escapeHtml(message.username)}</strong> 
            <span>${new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="message-content">${escapeHtml(message.message)}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.textContent = message;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator(username) {
    // Remove existing typing indicator
    hideTypingIndicator();
    
    const typingElement = document.createElement('div');
    typingElement.id = 'typing-indicator';
    typingElement.className = 'typing-indicator';
    typingElement.textContent = `${username} is typing...`;
    
    chatMessages.appendChild(typingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const existingIndicator = document.getElementById('typing-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showAdminPanel() {
    showSection(adminSection);
}

function hideAdminPanel() {
    showSection(loginSection);
}

function leaveChat() {
    socket.disconnect();
    socket.connect();
    currentGroup = '';
    currentUsername = '';
    showSection(loginSection);
    chatMessages.innerHTML = '';
    hideTypingIndicator();
}