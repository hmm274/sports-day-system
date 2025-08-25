import { useState } from 'react';
import Timer from './Timer';
import io from 'socket.io-client';

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
  const [start, setStart] = useState(false);
  const [finish, setFinish] = useState(false);

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
    setStart(true);
  }
  const handleStop = () => {
    socket.emit('stop-all-timers');
    setFinish(true);
  }
  const handleSave = () => {
    socket.emit('reset-all-timers');
    setFinish(false);
    setStart(false);
  }

  const handleLogout = () => {
    socket.disconnect();
    setAuthenticated(false);
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
          {finish ? 
            <button onClick={handleSave}>Save</button> : 
            (start ? <button onClick={handleStop}>Stop All</button> : <button onClick={handleStart}>Start</button>)
          }
          {
            [...Array(8)].map((_, i) => (
              <Timer key={i} laneId={i + 1} socket={socket} isAdmin={true} />
            ))
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