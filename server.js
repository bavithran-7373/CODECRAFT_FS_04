const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '/')));

let users = {};
let chatHistory = {};
let privateChats = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User joins
    socket.on('join', (username) => {
        users[socket.id] = username;
        socket.username = username;
        io.emit('userJoined', { username, id: socket.id });
        io.emit('updateUsers', Object.values(users));
        console.log(`${username} joined the chat`);
    });

    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        if (!chatHistory[roomName]) {
            chatHistory[roomName] = [];
        }
        socket.emit('chatHistory', chatHistory[roomName]);
        socket.to(roomName).emit('userJoinedRoom', { username: socket.username, room: roomName });
    });

    socket.on('leaveRoom', (roomName) => {
        socket.leave(roomName);
        socket.to(roomName).emit('userLeftRoom', { username: socket.username, room: roomName });
    });

    socket.on('sendMessage', (data) => {
        const message = {
            username: socket.username,
            message: data.message,
            timestamp: new Date().toISOString(),
            type: 'message'
        };

        if (data.room) {
            chatHistory[data.room].push(message);
            io.to(data.room).emit('message', message);
        } else {
            const recipientSocket = Object.keys(users).find(key => users[key] === data.to);
            if (recipientSocket) {
                const privateMessage = { ...message, to: data.to, from: socket.username };
                io.to(recipientSocket).emit('privateMessage', privateMessage);
                socket.emit('privateMessage', privateMessage);

                const chatKey = [socket.username, data.to].sort().join('-');
                if (!privateChats[chatKey]) {
                    privateChats[chatKey] = [];
                }
                privateChats[chatKey].push(privateMessage);
            }
        }
    });

    socket.on('sendFile', (data) => {
        const fileMessage = {
            username: socket.username,
            fileName: data.fileName,
            fileData: data.fileData,
            timestamp: new Date().toISOString(),
            type: 'file'
        };

        if (data.room) {
            chatHistory[data.room].push(fileMessage);
            io.to(data.room).emit('fileMessage', fileMessage);
        } else {
            const recipientSocket = Object.keys(users).find(key => users[key] === data.to);
            if (recipientSocket) {
                io.to(recipientSocket).emit('privateFile', fileMessage);
                socket.emit('privateFile', fileMessage);
            }
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.room || data.to).emit('userTyping', { username: socket.username, isTyping: data.isTyping });
    });

    socket.on('getPrivateHistory', (withUser) => {
        const chatKey = [socket.username, withUser].sort().join('-');
        socket.emit('privateHistory', privateChats[chatKey] || []);
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const username = users[socket.id];
            delete users[socket.id];
            io.emit('userLeft', { username, id: socket.id });
            io.emit('updateUsers', Object.values(users));
            console.log(`${username} left the chat`);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

