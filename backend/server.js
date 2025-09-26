// server.js
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

// role management
let roleAssignments = {}; // socketId -> role
let roleLocks = new Set(); // roles in use

// timer state
let startTimestamp = null;              // server start time (ms)
let laneElapsed = Array(8).fill(null);  // per-lane elapsed (ms) or null if not stopped

const parseLane = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
};

io.on('connection', (socket) => {
  console.log(`[io] connected: ${socket.id}`);

  socket.on('request-role', (role, callback) => {
    if (roleLocks.has(role)) {
      callback({ success: false, message: 'Role already taken' });
    } else {
      roleAssignments[socket.id] = role;
      roleLocks.add(role);
      callback({ success: true });
      console.log(`[io] role "${role}" assigned to ${socket.id}`);
    }
  });

  // Admin starts all timers
  socket.on('start-timer', () => {
    if (roleAssignments[socket.id] === 'admin') {
      startTimestamp = Date.now();
      laneElapsed = Array(8).fill(null);
      io.emit('start-timer', { startTimestamp });
      console.log('[io] Admin started all timers at', startTimestamp);
    } else {
      console.log('[io] Unauthorized start attempt by', socket.id);
    }
  });

  // Lane stops their own timer.
  // Accepts either: stop-timer(laneId)  OR  stop-timer({ laneId, stopTime })
  socket.on('stop-timer', (payload) => {
    let laneId = null;
    let clientStopTime = null;

    if (payload && typeof payload === 'object') {
      laneId = parseLane(payload.laneId);
      clientStopTime = typeof payload.stopTime === 'number' ? payload.stopTime : null;
    } else {
      laneId = parseLane(payload);
    }
    if (!laneId) return;

    const expectedRole = `lane-${laneId}`;
    if (roleAssignments[socket.id] !== expectedRole) {
      console.log(`[io] Unauthorized stop attempt for lane ${laneId} by ${socket.id}`);
      return;
    }

    // If lane already has a recorded stop, inform the sender (no overwrite)
    if (laneElapsed[laneId - 1] != null) {
      socket.emit('stop-ignored', { laneId, elapsed: laneElapsed[laneId - 1] });
      console.log(`[io] stop ignored for lane ${laneId} (already recorded)`);
      return;
    }

    // Compute elapsed:
    let elapsed = null;
    if (clientStopTime != null && startTimestamp != null) {
      elapsed = clientStopTime - startTimestamp;
    } else if (startTimestamp != null) {
      elapsed = Date.now() - startTimestamp;
    } else if (clientStopTime != null) {
      // we have a client stopTime but no server startTimestamp:
      // can't compute a reliable elapsed — fallback to 0 (caller may handle this)
      elapsed = 0;
    } else {
      // no start recorded and no client stop time -> fallback to 0
      elapsed = 0;
    }

    if (typeof elapsed !== 'number' || isNaN(elapsed) || elapsed < 0) elapsed = 0;

    laneElapsed[laneId - 1] = elapsed;
    io.emit('stop-timer', { laneId, elapsed });
    socket.emit('stop-ack', { laneId, elapsed });
    console.log(`[io] Lane ${laneId} stopped by lane client. Elapsed: ${elapsed}`);
  });

  // Admin stops a single lane (overrides any previous)
  socket.on('admin-stop-lane', (rawLaneId) => {
    const laneId = parseLane(rawLaneId);
    if (!laneId) return;

    if (roleAssignments[socket.id] === 'admin') {
      if (!startTimestamp) {
        socket.emit('stop-ignored', { laneId, reason: 'no_active_race' });
        return;
      }
      const elapsed = Date.now() - startTimestamp;
      laneElapsed[laneId - 1] = elapsed;
      io.emit('stop-timer', { laneId, elapsed, by: 'admin' });
      console.log(`[io] Admin stopped lane ${laneId}. Elapsed: ${elapsed}`);
    } else {
      console.log(`[io] Unauthorized admin-stop by ${socket.id}`);
    }
  });

  // Admin stops all lanes
  socket.on('stop-all-timers', () => {
    if (roleAssignments[socket.id] !== 'admin') {
      console.log(`[io] Unauthorized stop-all attempt by ${socket.id}`);
      return;
    }
    if (!startTimestamp) {
      socket.emit('stop-all-ignored', { reason: 'no_active_race' });
      return;
    }

    const now = Date.now();
    laneElapsed = laneElapsed.map((time) => (time == null ? now - startTimestamp : time));
    const elapsedCopy = [...laneElapsed];
    io.emit('stop-all-timers', { elapsed: elapsedCopy });
    console.log('[io] Admin stopped all timers', elapsedCopy);
  });

  // Admin resets all timers
  socket.on('reset-all-timers', () => {
    if (roleAssignments[socket.id] !== 'admin') {
      console.log(`[io] Unauthorized reset attempt by ${socket.id}`);
      return;
    }
    startTimestamp = null;
    laneElapsed = Array(8).fill(null);
    io.emit('reset-all-timers');
    console.log('[io] Admin reset all timers');
  });

  // Broadcast assigned students to lanes (admin UI -> server -> all clients)
  socket.on('assign-students', (lanes) => {
    io.emit('assign-students', lanes);
  });

  socket.on('clear-students', () => {
    io.emit('clear-students');
  });

  socket.on('disconnect', () => {
    const role = roleAssignments[socket.id];
    if (role) {
      roleLocks.delete(role);
      delete roleAssignments[socket.id];
      console.log(`[io] socket ${socket.id} disconnected, released role "${role}"`);
    } else {
      console.log(`[io] socket ${socket.id} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[io] Server running on port ${PORT}`);
});