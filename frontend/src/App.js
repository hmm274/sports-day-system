import React, { useState, useEffect } from 'react';
import Timer from './Timer';
import io from 'socket.io-client';
import Admin from './Admin';
import Races from './Races';
import { supabase } from './supabaseClient';

const socket = io('http://localhost:3001');

const ROLE_PASSCODES = {
  admin: 'admin123',
  'lane-1': 'lane1pass',
  'lane-2': 'lane2pass',
  'lane-3': 'lane3pass',
  'lane-4': 'lane4pass',
  'lane-5': 'lane5pass',
  'lane-6': 'lane6pass',
  'lane-7': 'lane7pass',
  'lane-8': 'lane8pass',
};

const AdminManageTimer = ({handleStart, handleStop, handleSave}) => {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [laneStudents, setLaneStudents] = useState([]); // array of student objects per lane
  const [timers, setTimers] = useState({});

  const fetchRaces = async () => {
    const { data: raceData, error: raceError } = await supabase
      .from('races')
      .select('*')
      .order('race_id', { ascending: true });

    if (raceError) {
      console.error('Error fetching races:', raceError);
      return;
    }

    // Fetch students for each race to display in dropdown
    const racesWithNames = await Promise.all(
      raceData.map(async (race) => {
        const { data: resultsData } = await supabase
          .from('race_results')
          .select(`
            student:student_id (
              first_name
            )
          `)
          .is('time',null)
          .eq('race_id', race.race_id);

        const names = resultsData?.map((r) => r.student.first_name).join(', ') || '';
        return { ...race, studentNames: names };
      })
    );

    setRaces(racesWithNames.filter(r => r.studentNames !== ''));
  };

  // Fetch all races along with student names for dropdown display
  useEffect(() => {
    fetchRaces();
  }, []);

  // Fetch lane students whenever a race is selected
  const fetchLaneStudents = async () => {
    if (!selectedRaceId) {
      setLaneStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from('race_results')
      .select(`
        lane,
        student:student_id (
          student_id,
          first_name,
          last_name,
          house
        )
      `)
      .eq('race_id', selectedRaceId)
      .is('time',null)
      .order('lane', { ascending: true });

    if (error) {
      console.error('Error fetching lane students:', error);
      setLaneStudents([]);
    } else {
      const lanes = Array(8).fill(null);
      data.forEach((entry) => {
        lanes[entry.lane - 1] = entry.student;
      });
      setLaneStudents(lanes);
    }
  };

  useEffect(() => {
    fetchLaneStudents();
  }, [selectedRaceId]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Manage Timers</h2>

      <div style={{ marginBottom: '15px' }}>
        <label>Select Race: </label>
        <select
          value={selectedRaceId || ''}
          onChange={(e) => setSelectedRaceId(e.target.value)}
        >
          <option value="">-- Select Race --</option>
          {races.map((race) => (
            <option key={race.race_id} value={race.race_id}>
              {race.race_event} ({race.studentNames})
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: '15px' }}>
        <button onClick={handleStart}>Start All</button>
        <button onClick={handleStop}>Stop All</button>
        <button onClick={()=>handleSave(selectedRaceId, timers, fetchRaces, fetchLaneStudents)}>Reset / Save</button>
      </div>
      <div>
        {[...Array(8)].map((_, i) => {
          const student = laneStudents[i];
          return (
            <div key={i}>
              <h4>
                Lane {i + 1}{' '}
                {student ? `- ${student.first_name} ${student.last_name} (${student.house})` : ''}
              </h4>
              <Timer
                laneId={i + 1}
                socket={socket}
                isAdmin={true}
                selectedRaceId={selectedRaceId}
                studentId={student?.student_id || null}
                onStop={(lane, time) => {
                  setTimers((prev) => ({ ...prev, [lane]: { studentId: student?.student_id, time } }));
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [role, setRole] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [adminAction, setAdminAction] = useState('none');

  const handleLogin = () => {
    if (ROLE_PASSCODES[role] !== passcode) {
      alert('Incorrect passcode');
      return;
    }

    if(socket.disconnected){
      socket.connect();
    }

    socket.emit('request-role', role, (response) => {
      if (response.success) {
        setAuthenticated(true);
      } else {
        alert(response.message);
      }
    });
  };

  const handleStart = () => {
    socket.emit('start-timer');
  }
  const handleStop = () => {
    socket.emit('stop-all-timers');
  }
  const handleSave = async (selectedRaceId, timers, fetchRaces, fetchLaneStudents) => {
    try {
      // Convert timers to results array
      let results = Object.entries(timers).map(([lane, data]) => ({
        race_id: selectedRaceId,
        student_id: data.studentId,
        lane: parseInt(lane),
        time: data.time
      }));

      // Sort results by time (ascending = fastest first)
      results.sort((a, b) => a.time - b.time);

      // Assign points based on placement
      results = results.map((res, index) => {
        let points = 5; // default for 5th place and under
        if (index === 0) points = 40;
        else if (index === 1) points = 30;
        else if (index === 2) points = 20;
        else if (index === 3) points = 10;

        return { ...res, points };
      });

      console.log("Saving results:", results);

      // Upsert into race_results with points
      const { data, error } = await supabase
        .from('race_results')
        .upsert(results, { onConflict: ['race_id', 'student_id'] });

      if (error) {
        console.error("Error saving results:", error);
        alert("Failed to save results");
      } else {
        console.log(data);
        alert("Results saved!");
        if (fetchRaces) {
          await fetchRaces();
        }
        if (fetchLaneStudents) {
          await fetchLaneStudents();
        }
        socket.emit("reset-all-timers");
      }
    } catch (err) {
      console.error("Unexpected error saving results:", err);
    }
  };


  const handleLogout = () => {
    socket.disconnect();
    setAuthenticated(false);
    setAdminAction('none');
  }

  if (!authenticated) {
    return (
      <div className="App">
        <h1>Race Timer Login</h1>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Select Role</option>
          <option value="admin">Admin</option>
          {[...Array(8)].map((_, i) => (
            <option key={i} value={`lane-${i + 1}`}>Lane {i + 1}</option>
          ))}
        </select>
        <input
          type="password"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
        />
        <button onClick={handleLogin}>Login</button>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Race Timer ({role})</h1>
      {role === 'admin' ? (
        <div>
        {adminAction==='none' ?
          <div>
            <button onClick={()=>setAdminAction('set')}>Set Races</button>
            <button onClick={()=>setAdminAction('manage')}>Manage Timer</button>
            <Races />
          </div> :
          <div>
            {adminAction==='set' ?
              <div>
                <Admin />
              </div> :
              <div>
                <AdminManageTimer handleStart={handleStart} handleStop={handleStop} handleSave={handleSave} />
              </div>
            }
          </div>
        }
        </div>
      ) : (
        <Timer
          laneId={parseInt(role.split('-')[1])}
          socket={socket}
          isAdmin={false}
        />
      )}
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}

export default App;