import { useState, useEffect } from 'react';

const Timer = ({ laneId, socket, isAdmin, onStop, studentName, studentHouse, selectedRaceId }) => {
  const [elapsed, setElapsed] = useState(0); 
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedTime, setEditedTime] = useState("");

  // Listen for server events
  useEffect(() => {
    const handleStart = () => {
      const now = Date.now();
      setStartTime(now);
      setElapsed(0);
      setRunning(true);
    };

    const handleStopLane = ({ laneId: stoppedLaneId, elapsed: serverElapsed }) => {
      if (stoppedLaneId === laneId) {
        setElapsed(serverElapsed);
        setRunning(false);
        onStop?.(laneId, serverElapsed / 1000);
      }
    };

    const handleStopAll = ({ elapsed: allElapsed }) => {
      const serverTime = allElapsed[laneId - 1] || 0;
      setElapsed(serverTime);
      setRunning(false);
      onStop?.(laneId, serverTime / 1000);
    };

    const handleReset = () => {
      setElapsed(0);
      setStartTime(null);
      setRunning(false);
      setEditing(false);
    };

    socket.on('start-timer', handleStart);
    socket.on('stop-timer', handleStopLane);
    socket.on('restop-timer', handleStopLane);
    socket.on('stop-all-timers', handleStopAll);
    socket.on('reset-all-timers', handleReset);

    return () => {
      socket.off('start-timer', handleStart);
      socket.off('stop-timer', handleStopLane);
      socket.off('restop-timer', handleStopLane);
      socket.off('stop-all-timers', handleStopAll);
      socket.off('reset-all-timers', handleReset);
    };
  }, [socket, laneId, onStop]);

  // Update display while running
  useEffect(() => {
    if (!running || startTime === null) return;
    const interval = setInterval(() => {
      const diff = Date.now() - startTime;
      setElapsed(diff > 0 ? diff : 0); 
    }, 50);

    return () => clearInterval(interval);
  }, [running, startTime]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  };

  const handleStop = () => {
    if (!isAdmin) socket.emit('stop-timer', laneId);
    setRunning(false);
  };

  const handleRestop = () => {
    if (!isAdmin) socket.emit('restop-timer', laneId, elapsed);
  };

  const handleAdminStop = () => {
    if (isAdmin) socket.emit('admin-stop-lane', laneId);
    setRunning(false);
  };

  const handleSaveEdit = () => {
    const ms = parseFloat(editedTime) * 1000; // seconds → ms
    if (!isNaN(ms)) {
      setElapsed(ms);
      onStop?.(laneId, ms / 1000); // update parent
      setEditing(false);
    }
  };

  return (
    <div className={isAdmin ? "admin-Timer" : "Timer"}>
      {isAdmin ? (
        <h2>Lane {laneId} - {studentName || "Unselected"}</h2>
      ) : (
        <h1>Lane {laneId} - {studentName || "Unselected"}</h1>
      )}
      <p>{studentHouse || ""}</p>

      {!editing ? (
        <p className="time">{formatTime(elapsed)}</p>
      ) : (
        <div>
          <input
            type="number"
            step="0.001"
            value={editedTime}
            onChange={(e) => setEditedTime(e.target.value)}
            placeholder="Enter seconds"
          />
          <button onClick={handleSaveEdit}>Save</button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}

      <button
        className={running ? "stop-button-enable" : "stop-button-disable"}
        disabled={!running}
        onClick={isAdmin ? handleAdminStop : handleStop}
      >
        Stop
      </button>

      {(isAdmin && !running && !editing && !(selectedRaceId==null)) && (
        <button onClick={() => {
          setEditing(true);
          setEditedTime((elapsed / 1000).toFixed(3)); // preload current time
        }}>
          Edit Time
        </button>
      )}
    </div>
  );
};

export default Timer;