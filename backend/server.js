const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(bodyParser.json());

let roleAssignments = {}; // socketId -> role
let roleLocks = new Set(); // roles in use
let startTimestamp = null; // timestamp for running timers
let laneElapsed = Array(8).fill(0); // stores elapsed time per lane in ms

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

  // Admin starts all timers
  socket.on('start-timer', () => {
    if (roleAssignments[socket.id] === 'admin') {
      startTimestamp = Date.now();
      laneElapsed = Array(8).fill(0);
      io.emit('start-timer', { startTimestamp });
      console.log('Admin started all timers');
    }
  });

  // Lane stops their own timer
  socket.on('stop-timer', (laneId, callback) => {
    const expectedRole = `lane-${laneId}`;
    if (roleAssignments[socket.id] === expectedRole) {
      const elapsed = Date.now() - startTimestamp;
      laneElapsed[laneId - 1] = elapsed;
      io.emit('stop-timer', { laneId, elapsed });
      if(callback) callback({success:true});
      console.log(`Lane ${laneId} stopped. Elapsed: ${elapsed}`);
    }
  });

  socket.on('restop-timer', (laneId, time, callback) =>{
    const expectedRole = `lane-${laneId}`;
    if(roleAssignments[socket.id]===expectedRole){
      laneElapsed[laneId - 1] = time;
      io.emit('restop-timer', { laneId, elapsed: time });
      if(callback) callback({success:true});
      console.log(`Lane ${laneId} time resent. Elapsed: ${time}`);
    }
  })

  // Admin stops any lane
  socket.on('admin-stop-lane', (laneId) => {
    if (roleAssignments[socket.id] === 'admin') {
      const elapsed = Date.now() - startTimestamp;
      laneElapsed[laneId - 1] = elapsed;
      io.emit('stop-timer', { laneId, elapsed });
      console.log(`Admin stopped lane ${laneId}. Elapsed: ${elapsed}`);
    }
  });

  // Admin stops all lanes
  socket.on('stop-all-timers', () => {
    const now = Date.now();
    laneElapsed = laneElapsed.map((time, i) =>
      time || now - startTimestamp
    );
    const elapsedCopy = [...laneElapsed];
    io.emit('stop-all-timers', { elapsed: elapsedCopy });
    console.log('Admin stopped all timers', elapsedCopy);
  });

  // Admin resets all timers
  socket.on('reset-all-timers', () => {
    startTimestamp = null;
    laneElapsed = Array(8).fill(0);
    io.emit('reset-all-timers');
    console.log('Admin reset all timers');
  });

  socket.on('assign-students', (lanes)=>{
    io.emit('assign-students',lanes);
  });

  socket.on('clear-students', ()=>{
    io.emit('clear-students');
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

server.listen(3001, () => {
  console.log('Server running on port 3001');
});