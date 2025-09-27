import { useState, useEffect } from 'react';

const Timer = ({ laneId, socket, isAdmin, onStop, studentName, studentHouse }) => {
  const [elapsed, setElapsed] = useState(0); // display time
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null); // client-side start timestamp
  const [ack, setAck] = useState(true);

  // Listen for server events
  useEffect(() => {
    const handleStart = () => {
      const now = Date.now();
      setStartTime(now);
      setElapsed(0);
      setRunning(true);
      setAck(true);
    };

    const handleStopLane = ({ laneId: stoppedLaneId, elapsed: serverElapsed }) => {
      if (stoppedLaneId === laneId) {
        setElapsed(serverElapsed); // show server time
        setRunning(false);
        onStop?.(laneId, serverElapsed / 1000);
      }
    };

    const handleStopAll = ({ elapsed: allElapsed }) => {
      const serverTime = allElapsed[laneId - 1] || 0;
      setElapsed(serverTime); // show server time
      setRunning(false);
      onStop?.(laneId, serverTime / 1000);
    };

    const handleReset = () => {
      setElapsed(0);
      setStartTime(null);
      setRunning(false);
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
      setElapsed(diff > 0 ? diff : 0); // client-side elapsed
    }, 50);

    return () => clearInterval(interval);
  }, [running, startTime]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  };

  const handleStop = () => {
    if (!isAdmin) socket.emit('stop-timer', laneId, (ack) => {
      if (!ack.success){
        setAck(false);
      }
    });
    setRunning(false);
  };

  const handleRestop = () => {
    if(!isAdmin) socket.emit('restop-timer', laneId, elapsed, (ack)=>{
      if(ack.success){
        setAck(true);
      }
    });
  }

  const handleAdminStop = () => {
    if (isAdmin) socket.emit('admin-stop-lane', laneId);
    setRunning(false);
  };

  return (
    <div className={isAdmin ? "admin-Timer" : "Timer"}>
      {isAdmin ? (
        <h2>Lane {laneId} - {studentName || "Unselected"}</h2>
      ) : (
        <h1>Lane {laneId} - {studentName || "Unselected"}</h1>
      )}
      <p>{studentHouse || ""}</p>
      <p className="time">{formatTime(elapsed)}</p>
      <button
        className={running ? "stop-button-enable" : "stop-button-disable"}
        disabled={!running}
        onClick={isAdmin ? handleAdminStop : handleStop}
      >
        Stop
      </button>
      {(!isAdmin && !ack) &&
        <button
          disabled={!running}
          onClick={handleRestop}
        >
          Resend
        </button>
      }
    </div>
  );
};

export default Timer;