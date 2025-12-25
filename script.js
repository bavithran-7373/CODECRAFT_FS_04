const socket = io();
let currentUser = '';
let currentRoom = 'general';
let currentPrivateChat = null;


const loginContainer = document.getElementById('loginContainer');
const chatContainer = document.getElementById('chatContainer');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const currentUserDisplay = document.getElementById('currentUser');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const roomList = document.getElementById('roomList');
const privateList = document.getElementById('privateList');
const userList = document.getElementById('userList');
const privateUserInput = document.getElementById('privateUserInput');
const startPrivateBtn = document.getElementById('startPrivateBtn');
const currentRoomDisplay = document.getElementById('currentRoom');
const onlineCount = document.getElementById('onlineCount');
const roomUserCount = document.getElementById('roomUserCount');
const typingIndicator = document.getElementById('typingIndicator');


joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUser = username;
        socket.emit('join', username);
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        currentUserDisplay.textContent = username;
        socket.emit('joinRoom', currentRoom);
    }
});


sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        const data = { message };
        if (currentPrivateChat) {
            data.to = currentPrivateChat;
        } else {
            data.room = currentRoom;
        }
        socket.emit('sendMessage', data);
        messageInput.value = '';
        socket.emit('typing', { isTyping: false, room: currentRoom, to: currentPrivateChat });
    }
}


fileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            const data = {
                fileName: file.name,
                fileData: reader.result
            };
            if (currentPrivateChat) {
                data.to = currentPrivateChat;
            } else {
                data.room = currentRoom;
            }
            socket.emit('sendFile', data);
        };
        reader.readAsDataURL(file);
    }
});


roomList.addEventListener('click', (e) => {
    if (e.target.classList.contains('room-item')) {
        const roomName = e.target.dataset.room;
        switchRoom(roomName);
    }
});

function switchRoom(roomName) {
    socket.emit('leaveRoom', currentRoom);
    currentRoom = roomName;
    currentPrivateChat = null;
    currentRoomDisplay.textContent = roomName;
    messages.innerHTML = '';
    socket.emit('joinRoom', roomName);

    
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-room="${roomName}"]`).classList.add('active');

    
    document.querySelectorAll('.private-item').forEach(item => {
        item.classList.remove('active');
    });
}


startPrivateBtn.addEventListener('click', () => {
    const username = privateUserInput.value.trim();
    if (username && username !== currentUser) {
        startPrivateChat(username);
        privateUserInput.value = '';
    }
});

privateList.addEventListener('click', (e) => {
    if (e.target.classList.contains('private-item')) {
        const username = e.target.dataset.user;
        startPrivateChat(username);
    }
});

function startPrivateChat(username) {
    currentPrivateChat = username;
    currentRoom = null;
    currentRoomDisplay.textContent = `Private chat with ${username}`;
    messages.innerHTML = '';
    socket.emit('getPrivateHistory', username);

    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.private-item').forEach(item => {
        item.classList.remove('active');
    });
    const privateItem = document.querySelector(`[data-user="${username}"]`);
    if (privateItem) {
        privateItem.classList.add('active');
    } else {

        const li = document.createElement('li');
        li.className = 'private-item active';
        li.dataset.user = username;
        li.textContent = username;
        privateList.appendChild(li);
    }
}


let typingTimer;
messageInput.addEventListener('input', () => {
    socket.emit('typing', { isTyping: true, room: currentRoom, to: currentPrivateChat });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing', { isTyping: false, room: currentRoom, to: currentPrivateChat });
    }, 1000);
});

socket.on('message', (data) => {
    displayMessage(data, false);
});

socket.on('privateMessage', (data) => {
    if (data.from === currentPrivateChat || data.to === currentPrivateChat) {
        displayMessage(data, data.from === currentUser);
    }
    if (data.from !== currentUser && (data.from !== currentPrivateChat && data.to !== currentPrivateChat)) {
        showNotification(`New private message from ${data.from}`);
    }
});

socket.on('fileMessage', (data) => {
    displayFileMessage(data, false);
});

socket.on('privateFile', (data) => {
    if (data.username === currentPrivateChat || data.username === currentUser) {
        displayFileMessage(data, data.username === currentUser);
    }
});

socket.on('chatHistory', (history) => {
    messages.innerHTML = '';
    history.forEach(item => {
        if (item.type === 'file') {
            displayFileMessage(item, item.username === currentUser);
        } else {
            displayMessage(item, item.username === currentUser);
        }
    });
});

socket.on('privateHistory', (history) => {
    history.forEach(item => {
        if (item.type === 'file') {
            displayFileMessage(item, item.from === currentUser);
        } else {
            displayMessage(item, item.from === currentUser);
        }
    });
});

socket.on('userJoined', (data) => {
    updateUserList();
    if (data.username !== currentUser) {
        showNotification(`${data.username} joined the chat`);
    }
});

socket.on('userLeft', (data) => {
    updateUserList();
    showNotification(`${data.username} left the chat`);
});

socket.on('updateUsers', (users) => {
    onlineCount.textContent = users.length;
    updateUserList(users);
});

socket.on('userJoinedRoom', (data) => {
    if (data.room === currentRoom) {
        updateRoomUsers();
        showNotification(`${data.username} joined ${data.room}`);
    }
});

socket.on('userLeftRoom', (data) => {
    if (data.room === currentRoom) {
        updateRoomUsers();
        showNotification(`${data.username} left ${data.room}`);
    }
});

socket.on('userTyping', (data) => {
    if ((data.username !== currentUser) &&
        ((currentRoom && !currentPrivateChat) || (currentPrivateChat === data.username))) {
        typingIndicator.textContent = `${data.username} is typing...`;
        setTimeout(() => {
            typingIndicator.textContent = '';
        }, 2000);
    }
});

function displayMessage(data, isOwn) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    messageDiv.innerHTML = `
        <div class="username">${data.username || data.from}</div>
        <div>${data.message}</div>
        <div class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</div>
    `;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function displayFileMessage(data, isOwn) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message file-message ${isOwn ? 'own' : 'other'}`;
    messageDiv.innerHTML = `
        <div class="username">${data.username}</div>
        <div><a href="${data.fileData}" download="${data.fileName}">📎 ${data.fileName}</a></div>
        <div class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</div>
    `;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function updateUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.textContent = user;
        li.addEventListener('click', () => {
            privateUserInput.value = user;
        });
        userList.appendChild(li);
    });
}

function updateRoomUsers() {
    roomUserCount.textContent = onlineCount.textContent;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    messages.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

