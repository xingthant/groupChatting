// Backend URL
const BACKEND_URL = 'https://group-chat-backend-zmm4.onrender.com';
const socket = io(BACKEND_URL);

// DOM Elements - moved to top and initialized properly
let loginSection, adminSection, chatSection, loginForm, chatMessages, messageInput, groupDisplay;

// Initialize DOM elements when page loads
document.addEventListener('DOMContentLoaded', function() {
    loginSection = document.getElementById('login-section');
    adminSection = document.getElementById('admin-section');
    chatSection = document.getElementById('chat-section');
    loginForm = document.getElementById('login-form');
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    groupDisplay = document.getElementById('group-display');
    
    initializeEventListeners();
});

let currentGroup = '';
let currentUsername = '';
let typingTimer;

function initializeEventListeners() {
    // Form submission
    if (loginForm) {
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
    }

    // Message sending
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
}

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server:', BACKEND_URL);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    showError('login-error', 'Cannot connect to server. Please try again.');
});

socket.on('join-success', (data) => {
    currentGroup = data.groupName;
    currentUsername = data.username;
    if (groupDisplay) groupDisplay.textContent = currentGroup;
    showSection(chatSection);
    clearError('login-error');
});

socket.on('join-error', (message) => {
    showError('login-error', message);
});

socket.on('chat-history', (messages) => {
    if (chatMessages) {
        chatMessages.innerHTML = '';
        messages.forEach(message => {
            addMessageToChat(message);
        });
    }
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

socket.on('message-error', (message) => {
    showError('chat-error', message);
});

// Message sending
function sendMessage() {
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    if (message && currentGroup) {
        socket.emit('send-message', { message });
        messageInput.value = '';
    }
}

// Admin functions
async function createGroup() {
    const adminPassword = document.getElementById('admin-password')?.value;
    const groupName = document.getElementById('new-group-name')?.value;
    const groupPassword = document.getElementById('new-group-password')?.value;
    
    if (!adminPassword || !groupName || !groupPassword) {
        showAdminMessage('All fields are required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/groups/create`, {
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
        showAdminMessage('Error creating group. Check backend connection.', 'error');
    }
}

async function updateGroup() {
    const adminPassword = document.getElementById('admin-password')?.value;
    const groupName = document.getElementById('update-group-name')?.value;
    const newName = document.getElementById('updated-name')?.value;
    const newPassword = document.getElementById('updated-password')?.value;
    
    if (!adminPassword || !groupName) {
        showAdminMessage('Admin password and group name are required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/groups/${encodeURIComponent(groupName)}`, {
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
        showAdminMessage('Error updating group. Check backend connection.', 'error');
    }
}

async function deleteGroup() {
    const adminPassword = document.getElementById('admin-password')?.value;
    const groupName = document.getElementById('delete-group-name')?.value;
    
    if (!adminPassword || !groupName) {
        showAdminMessage('Admin password and group name are required', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete group "${groupName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/groups/${encodeURIComponent(groupName)}`, {
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
        showAdminMessage('Error deleting group. Check backend connection.', 'error');
    }
}

// UI Helper functions
function showSection(section) {
    if (!loginSection || !adminSection || !chatSection) return;
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    section.classList.add('active');
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

function showAdminMessage(message, type) {
    const messageElement = document.getElementById('admin-message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'message';
        }, 5000);
    }
}

function addMessageToChat(message) {
    if (!chatMessages) return;
    
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
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.textContent = message;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
    if (chatMessages) chatMessages.innerHTML = '';
}
