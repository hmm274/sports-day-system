import React, { useState, useEffect } from 'react';
import Timer from './Timer';
import io from 'socket.io-client';
import Admin from './Admin';
import Races from './Races';
import { supabase } from './supabaseClient';
import AdminManageTimer from './AdminManageTimer';
import HousePoints from './HousePoints';
import FieldManager from './FieldManager';
import './App.css';

const socket = io('http://localhost:3001');

const ROLE_PASSCODES = {
  admin: 'admin123',
  field: 'field123',
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
  const [points, setPoints] = useState(false);
  const [studentInfo, setStudentInfo] = useState({ name: null, house: null });

  const handleLogin = () => {
    if (ROLE_PASSCODES[role] !== passcode) {
      alert('Incorrect passcode');
      return;
    }

    if (role!=="field"){
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
    }else{
      setAuthenticated(true);
      setField(true);
    }
  };

  const handleStart = () => {
    socket.emit('start-timer');
  }
  const handleStop = () => {
    socket.emit('stop-all-timers');
  }
  const handleSave = async (selectedRaceId, timers, fetchRaces, fetchLaneStudents, noResult) => {
    try {
      // Convert timers to results array
      let results = Object.entries(timers).map(([lane, data]) => ({
        race_id: selectedRaceId,
        student_id: data.studentId,
        lane: parseInt(lane),
        time: data.time,
        no_result: !!noResult[lane]
      }));

      // Sort results by time (ascending = fastest first)
      results.sort((a, b) => {
        if (a.no_result && !b.no_result) return 1;
        if (!a.no_result && b.no_result) return -1;
        return a.time - b.time
      });

      // Assign points based on placement
      results = results.map((res, index) => {
        if (res.no_result){
          return {...res, points: 0}
        }

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

  useEffect(() => {
    socket.on("assign-students", (laneStudents) => {
      const laneNum = parseInt(role.split('-')[1]);
      const assigned = laneStudents[laneNum - 1];
      if (assigned) {
        setStudentInfo({ name: assigned.first_name, house: assigned.house });
      }
    });

    socket.on("clear-students",()=>{
      setStudentInfo({ name: null, house: null });
    })

    return () => {
      socket.off("assign-students");
      socket.off("clear-students");
    };
  }, [role]);



  const handleLogout = () => {
    socket.disconnect();
    setAuthenticated(false);
    setAdminAction('none');
    setField(false);
  }

  const handleUndo = () => {
    setPoints(false);
    setAdminAction("none");
  }

  if (!authenticated) {
    if (points){
      return(
        <div>
          <HousePoints />
          <button onClick={handleUndo}>Back</button>
        </div>
      );
    } else{
      return (
        <div className="Login">
          <div className="box">
            <h1>Sports Day</h1>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select Role</option>
              <option value="admin">Admin</option>
              <option value="field">Field</option>
              {[...Array(8)].map((_, i) => (
                <option key={i} value={`lane-${i + 1}`}>Lane {i + 1}</option>
              ))}
            </select><br />
            <input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            /><br />
            <button onClick={handleLogin}>Login</button><br /><br />
            <button onClick={()=>{setPoints(true)}}>View House Points</button>
          </div>
        </div>
      );
    }
  }

  if(field){
    return(
      <div>
        <FieldManager />
        <button className="button-logout" onClick={handleLogout}>Log out</button>
      </div>
    );
  }

  return (
    <div className="App">
      {role === 'admin' ? (
        <div>
        {adminAction==='none' ?
          <div>
            <div className="menu">
              <button onClick={()=>setAdminAction('set')}>Set Races</button>
              <button onClick={()=>setAdminAction('manage')}>Timer</button>
            </div>
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
          studentName={studentInfo.name}
          studentHouse={studentInfo.house}
        />
      )}
      <div className="button-logout">
        {(adminAction!=="none" && !field) && <button className="button-logout-1" onClick={handleUndo}>Back</button>}
        <button onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}

export default App;