require('dotenv').config();
const supabase = require('./supabaseClient');

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

  socket.on('save-race-results', async ({ raceId, results }, callback) => {
    if (!isAdmin(socket)) {
      callback?.({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!raceId || !Array.isArray(results) || results.length === 0) {
      callback?.({
        success: false,
        message: 'Invalid race results',
      });
      return;
    }

    try {
      const validResults = results.filter(
        (result) =>
          Number.isInteger(result.lane) &&
          result.lane >= 1 &&
          result.lane <= 8 &&
          Number.isInteger(result.student_id)
      );

      if (validResults.length !== results.length) {
        callback?.({
          success: false,
          message: 'Invalid race result data',
        });
        return;
      }

      // Rank students who recorded a time.
      const finishedResults = validResults
        .filter(
          (result) =>
            !result.no_result &&
            typeof result.time === 'number' &&
            Number.isFinite(result.time) &&
            result.time >= 0
        )
        .sort((a, b) => a.time - b.time);

      const pointsByPlace = [40, 30, 20, 10, 5];

      const rows = validResults.map((result) => {
        if (result.no_result) {
          return {
            race_id: raceId,
            lane: result.lane,
            student_id: result.student_id,
            time: null,
            points: 0,
            no_result: true,
          };
        }

        const place = finishedResults.findIndex(
          (finished) =>
            finished.lane === result.lane &&
            finished.student_id === result.student_id
        );

        if (place === -1) {
          throw new Error('Invalid race time');
        }

        return {
          race_id: raceId,
          lane: result.lane,
          student_id: result.student_id,
          time: result.time,
          points: pointsByPlace[place] ?? 0,
          no_result: false,
        };
      });

      const { error } = await supabase
        .from('race_results')
        .upsert(rows, {
          onConflict: 'race_id,student_id',
        });

      if (error) {
        console.error('Supabase race result error:', error);

        callback?.({
          success: false,
          message: 'Unable to save race results',
        });

        return;
      }

      callback?.({
        success: true,
      });
    } catch (error) {
      console.error('Race result save error:', error);

      callback?.({
        success: false,
        message: 'Unable to save race results',
      });
    }
  });

  socket.on('save-field-result', async ({ fieldId, studentId, distance, noResult }, callback) => {
    if (!isAdmin(socket)) {
      callback?.({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (
      typeof fieldId !== 'string' ||
      fieldId.trim() === '' ||
      !Number.isInteger(studentId)
    ) {
      callback?.({
        success: false,
        message: 'Invalid field event result',
      });
      return;
    }

    if (
      !noResult &&
      (typeof distance !== 'number' ||
        !Number.isFinite(distance) ||
        distance < 0)
    ) {
      callback?.({
        success: false,
        message: 'Invalid distance',
      });
      return;
    }

    try {
      const { error: upsertError } = await supabase
        .from('field_results')
        .upsert(
          [{
            field_id: fieldId,
            student_id: studentId,
            distance: noResult ? null : distance,
            points: 0,
            no_result: !!noResult,
          }],
          {
            onConflict: 'field_id,student_id',
          }
        );

      if (upsertError) throw upsertError;

      const { data: results, error: resultsError } = await supabase
        .from('field_results')
        .select('student_id, distance, no_result')
        .eq('field_id', fieldId);

      if (resultsError) throw resultsError;

      const validResults = results
        .filter(
          (result) =>
            !result.no_result &&
            result.distance !== null
        )
        .sort((a, b) => b.distance - a.distance);

      const pointsByPlace = [40, 30, 20, 10, 5];

      const updatedResults = results.map((result) => {
        if (result.no_result || result.distance === null) {
          return {
            field_id: fieldId,
            student_id: result.student_id,
            distance: result.distance,
            no_result: result.no_result,
            points: 0,
          };
        }

        const place = validResults.findIndex(
          (validResult) =>
            validResult.student_id === result.student_id
        );

        return {
          field_id: fieldId,
          student_id: result.student_id,
          distance: result.distance,
          no_result: false,
          points: pointsByPlace[place] ?? 0,
        };
      });

      const { error: updateError } = await supabase
        .from('field_results')
        .upsert(updatedResults, {
          onConflict: 'field_id,student_id',
        });

      if (updateError) throw updateError;

      callback?.({ success: true });
    } catch (error) {
      console.error('Field result save error:', error);

      callback?.({
        success: false,
        message: 'Unable to save field result',
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});