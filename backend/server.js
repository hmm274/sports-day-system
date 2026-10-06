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

  socket.on(
    'create-race',
    async ({ event, grade, studentIds }, callback) => {
      // Only the admin can create races
      if (!isAdmin(socket)) {
        callback?.({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const validEvents = ['50m', '100m', '200m', '400m'];

      const validGrades =
        event === '50m' || event === '200m'
          ? ['G1', 'G2', 'G3', 'G4', 'G5']
          : ['G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

      // Validate request data
      if (
        !validEvents.includes(event) ||
        !validGrades.includes(grade) ||
        !Array.isArray(studentIds) ||
        studentIds.length === 0 ||
        studentIds.length > 8 ||
        !studentIds.every(Number.isInteger) ||
        new Set(studentIds).size !== studentIds.length
      ) {
        callback?.({
          success: false,
          message: 'Invalid race data',
        });
        return;
      }

      try {
        // Make sure all selected students actually exist
        // and belong to the selected grade
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('student_id, grade')
          .in('student_id', studentIds);

        if (studentsError) throw studentsError;

        if (
          students.length !== studentIds.length ||
          students.some((student) => student.grade !== grade)
        ) {
          callback?.({
            success: false,
            message: 'Invalid students selected',
          });
          return;
        }

        // Find all existing races for this event
        const { data: existingRaces, error: existingRacesError } =
          await supabase
            .from('races')
            .select('race_id')
            .eq('race_event', event);

        if (existingRacesError) throw existingRacesError;

        // Make sure none of these students are already entered
        // in another race for this event
        if (existingRaces.length > 0) {
          const raceIds = existingRaces.map((race) => race.race_id);

          const { data: existingResults, error: existingResultsError } =
            await supabase
              .from('race_results')
              .select('student_id')
              .in('race_id', raceIds)
              .in('student_id', studentIds);

          if (existingResultsError) throw existingResultsError;

          if (existingResults.length > 0) {
            callback?.({
              success: false,
              message:
                'One or more students are already entered in this event',
            });
            return;
          }
        }

        // Create the race
        const { data: raceData, error: raceError } = await supabase
          .from('races')
          .insert([
            {
              race_event: event,
            },
          ])
          .select('race_id')
          .single();

        if (raceError) throw raceError;

        // Assign selected students to lanes
        const results = studentIds.map((studentId, index) => ({
          race_id: raceData.race_id,
          student_id: studentId,
          lane: index + 1,
          time: null,
          points: 0,
          no_result: false,
        }));

        const { error: resultsError } = await supabase
          .from('race_results')
          .insert(results);

        if (resultsError) {
          // Remove the race if creating its results failed
          await supabase
            .from('races')
            .delete()
            .eq('race_id', raceData.race_id);

          throw resultsError;
        }

        callback?.({
          success: true,
          raceId: raceData.race_id,
        });
      } catch (error) {
        console.error('Create race error:', error);

        callback?.({
          success: false,
          message: 'Unable to create race',
        });
      }
    }
  );
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});