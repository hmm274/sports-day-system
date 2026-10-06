require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const PORT = process.env.PORT || 3001;

const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: CLIENT_URL
}));

app.use(express.json());

const ROLE_PASSCODES = {
  admin: process.env.ADMIN_PASSCODE,
  'lane-1': process.env.LANE_1_PASSCODE,
  'lane-2': process.env.LANE_2_PASSCODE,
  'lane-3': process.env.LANE_3_PASSCODE,
  'lane-4': process.env.LANE_4_PASSCODE,
  'lane-5': process.env.LANE_5_PASSCODE,
  'lane-6': process.env.LANE_6_PASSCODE,
  'lane-7': process.env.LANE_7_PASSCODE,
  'lane-8': process.env.LANE_8_PASSCODE
};

let roleAssignments = {};
let roleLocks = new Set();
let startTimestamp = null;
let laneElapsed = Array(8).fill(0);

const isAdmin = (socket) => {
  return roleAssignments[socket.id] === 'admin';
};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('request-role', ({ role, passcode }, callback) => {
    if (!ROLE_PASSCODES[role]) {
      callback({ success: false, message: 'Invalid role' });
      return;
    }

    if (ROLE_PASSCODES[role] !== passcode) {
      callback({ success: false, message: 'Incorrect passcode' });
      return;
    }

    if (roleLocks.has(role)) {
      callback({ success: false, message: 'Role already taken' });
      return;
    }

    roleAssignments[socket.id] = role;
    roleLocks.add(role);

    callback({ success: true });

    console.log(`Role "${role}" assigned to ${socket.id}`);
  });

  socket.on('start-timer', () => {
    if (!isAdmin(socket)) return;

    startTimestamp = Date.now();
    laneElapsed = Array(8).fill(0);

    io.emit('start-timer', { startTimestamp });

    console.log('Admin started all timers');
  });

  socket.on('stop-timer', (laneId, callback) => {
    const expectedRole = `lane-${laneId}`;

    if (roleAssignments[socket.id] !== expectedRole) {
      if (callback) {
        callback({
          success: false,
          message: 'Unauthorized'
        });
      }
      return;
    }

    if (startTimestamp === null) {
      if (callback) {
        callback({
          success: false,
          message: 'Timer has not been started'
        });
      }
      return;
    }

    const elapsed = Date.now() - startTimestamp;

    laneElapsed[laneId - 1] = elapsed;

    io.emit('stop-timer', {
      laneId,
      elapsed
    });

    if (callback) {
      callback({ success: true });
    }

    console.log(`Lane ${laneId} stopped. Elapsed: ${elapsed}`);
  });

  socket.on('admin-stop-lane', (laneId) => {
    if (!isAdmin(socket)) return;
    if (startTimestamp === null) return;

    const elapsed = Date.now() - startTimestamp;

    laneElapsed[laneId - 1] = elapsed;

    io.emit('stop-timer', {
      laneId,
      elapsed
    });

    console.log(`Admin stopped lane ${laneId}. Elapsed: ${elapsed}`);
  });

  socket.on('stop-all-timers', () => {
    if (!isAdmin(socket)) return;
    if (startTimestamp === null) return;

    const now = Date.now();

    laneElapsed = laneElapsed.map((time) =>
      time || now - startTimestamp
    );

    const elapsedCopy = [...laneElapsed];

    io.emit('stop-all-timers', {
      elapsed: elapsedCopy
    });

    console.log('Admin stopped all timers', elapsedCopy);
  });

  socket.on('reset-all-timers', () => {
    if (!isAdmin(socket)) return;

    startTimestamp = null;
    laneElapsed = Array(8).fill(0);

    io.emit('reset-all-timers');

    console.log('Admin reset all timers');
  });

  socket.on('assign-students', (lanes) => {
    if (!isAdmin(socket)) return;

    io.emit('assign-students', lanes);
  });

  socket.on('clear-students', () => {
    if (!isAdmin(socket)) return;

    io.emit('clear-students');
  });

  socket.on('disconnect', () => {
    const role = roleAssignments[socket.id];

    if (role) {
      roleLocks.delete(role);
      delete roleAssignments[socket.id];

      console.log(
        `Socket ${socket.id} disconnected, released role "${role}"`
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});