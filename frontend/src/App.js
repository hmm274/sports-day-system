import React, { useState } from 'react';
import Timer from './Timer';
import io from 'socket.io-client';
import Admin from './Admin';
import Races from './Races';
import { supabase } from './supabaseClient';
import AdminManageTimer from './AdminManageTimer';
import HousePoints from './HousePoints';
import FieldManager from './FieldManager';

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

function App() {
  const [role, setRole] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [adminAction, setAdminAction] = useState('none');
  const [field, setField] = useState(false);

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

  const goToField = () =>{
    setField(true);
  }

  if (!authenticated) {
    if (field) {
      return <FieldManager />
    } else {
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
          <button onClick={goToField}>Field Event</button>
          <HousePoints />
        </div>
      );
    }
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
                <AdminManageTimer handleStart={handleStart} handleStop={handleStop} handleSave={handleSave} socket={socket} />
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