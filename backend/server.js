const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",  // Allow frontend to connect
    methods: ["GET", "POST"]
  }
});

app.use(cors());  // Enable CORS for all routes
app.use(bodyParser.json());

let roleAssignments = {}; // socketId: role
let roleLocks = new Set(); // roles in use

// Handling WebSocket connections
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

  socket.on('admin-stop-lane', (laneId) => {
    if (roleAssignments[socket.id] === 'admin') {
      io.emit('stop-timer', laneId);
      console.log(`Admin stopped lane ${laneId}`);
    }
  });

  socket.on('stop-all-timers', ()=>{
    io.emit('stop-all-timers');
    console.log('Admin stopped all timers');
  });

  socket.on('reset-all-timers', ()=>{
    io.emit('reset-all-timers');
    console.log('Admin resetted all tiemrs');
  })

  socket.on('disconnect', () => {
    const role = roleAssignments[socket.id];
    if (role) {
      roleLocks.delete(role);
      delete roleAssignments[socket.id];
      console.log(`Socket ${socket.id} disconnected, released role "${role}"`);
    }
  });
});

// Start the server
server.listen(3001, () => {
  console.log('Server is running on port 3001');
});