const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",  // Allow frontend to connect
    methods: ["GET", "POST"]
  }
});

app.use(cors());  // Enable CORS for all routes

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});

const roleAssignments = {}; // socketId: role
const roleLocks = new Set(); // roles in use

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('request-role', (role, callback) => {
        if (roleLocks.has(role)) {
            callback({ success: false, message: 'Role already taken' });
        } else {
            roleAssignments[socket.id] = role;
            roleLocks.add(role);
            callback({ success: true });
            console.log(`Role "${role}" assigned to ${socket.id}`);
        }
    });

    socket.on('start-timer', () => {
        if (roleAssignments[socket.id] === 'admin') {
            io.emit('start-timer');
            console.log('Admin started all timers');
        } else {
            console.log(`Unauthorized start attempt by ${socket.id}`);
        }
    });

    socket.on('stop-timer', (laneId) => {
        const expectedRole = `lane-${laneId}`;
        if (roleAssignments[socket.id] === expectedRole) {
            io.emit('stop-timer', laneId);
            console.log(`Lane ${laneId} stopped by ${socket.id}`);
        } else {
            console.log(`Unauthorized stop attempt for lane ${laneId} by ${socket.id}`);
        }
    });

    socket.on('disconnect', () => {
        const role = roleAssignments[socket.id];
        if (role) {
            roleLocks.delete(role);
            delete roleAssignments[socket.id];
            console.log(`Socket ${socket.id} disconnected, released role "${role}"`);
        }
    });
});
