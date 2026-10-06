import React, { useState, useEffect } from 'react';
import Timer from './Timer';
import socket from "./socket";
import Admin from './Admin';
import Races from './Races';
import AdminManageTimer from './AdminManageTimer';
import HousePoints from './HousePoints';
import FieldManager from './FieldManager';
import './App.css';

function App() {
  const [role, setRole] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [adminAction, setAdminAction] = useState('none');
  const [points, setPoints] = useState(false);
  const [studentInfo, setStudentInfo] = useState({ name: null, house: null });

  const handleLogin = () => {
    if (!role) {
      alert('Please select a role');
      return;
    }

    if (!passcode) {
      alert('Please enter a passcode');
      return;
    }

    if (socket.disconnected) {
      socket.connect();
    }

    socket.emit(
      'request-role',
      {
        role,
        passcode
      },
      (response) => {
        if (response.success) {
          setAuthenticated(true);
          setPasscode('');
        } else {
          alert(response.message);
        }
      }
    );
  };

  const handleStart = () => {
    socket.emit('start-timer');
  }
  const handleStop = () => {
    socket.emit('stop-all-timers');
  }
  const handleSave = async (
    selectedRaceId,
    timers,
    fetchRaces,
    fetchLaneStudents,
    noResult
  ) => {
    try {
      const results = Object.entries(timers).map(([lane, data]) => ({
        lane: parseInt(lane),
        student_id: data.studentId,
        time: data.time,
        no_result: !!noResult[lane]
      }));

      console.log("Sending results:", results);

      socket.emit(
        'save-race-results',
        {
          raceId: selectedRaceId,
          results
        },
        async (response) => {
          if (!response.success) {
            console.error("Error saving results:", response.message);
            alert(response.message || "Failed to save results");
            return;
          }

          alert("Results saved!");

          if (fetchRaces) {
            await fetchRaces();
          }

          if (fetchLaneStudents) {
            await fetchLaneStudents();
          }

          socket.emit("reset-all-timers");
        }
      );
    } catch (err) {
      console.error("Unexpected error saving results:", err);
      alert("Failed to save results");
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

  return (
    <div className="App">
      {role === 'admin' ? (
        <div>
        {adminAction==='none' ?
          <div>
            <div className="menu">
              <button onClick={()=>setAdminAction('set')}>Set Races</button>
              <button onClick={()=>setAdminAction('manage')}>Timer</button>
              <button onClick={()=>setAdminAction('field')}>Field</button>
            </div>
            <Races />
          </div> :
          <div>
            {adminAction==='set' ?
              <div>
                <Admin />
              </div> :
              <div>
                {adminAction==='field' ?
                  <div>
                    <FieldManager />
                  </div> :
                  <div>
                    <AdminManageTimer handleStart={handleStart} handleStop={handleStop} handleSave={handleSave} socket={socket} />
                  </div>
                }
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
        {(adminAction!=="none") && <button className="button-logout-1" onClick={handleUndo}>Back</button>}
        <button onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}

export default App;