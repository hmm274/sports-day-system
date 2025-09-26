import { useState, useEffect } from 'react';

const Timer = ({ laneId, socket, isAdmin, onStop, studentName, studentHouse }) => {
  const [elapsed, setElapsed] = useState(0); // milliseconds
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);

  // Listen for server events
  useEffect(() => {
    // Start all timers
    const handleStart = ({ startTimestamp }) => {
      setStartTime(startTimestamp);
      setRunning(true);
    };

    // Stop a specific lane
    const handleStopLane = ({ laneId: stoppedLaneId, elapsed }) => {
      if (stoppedLaneId === laneId) {
        setElapsed(elapsed);
        setRunning(false);
        if (onStop){
          onStop(laneId,(elapsed/1000))
        };
      }
    };

    // Stop all timers
    const handleStopAll = ({ elapsed: allElapsed }) => {
      const laneTime=(allElapsed[laneId-1]||0);
      setElapsed(laneTime);
      setRunning(false);
      if(onStop){
        onStop(laneId,(laneTime/1000))
      };
    };

    // Reset all timers
    const handleReset = () => {
      setElapsed(0);
      setStartTime(null);
      setRunning(false);
    };

    socket.on('start-timer', handleStart);
    socket.on('stop-timer', handleStopLane);
    socket.on('stop-all-timers', handleStopAll);
    socket.on('reset-all-timers', handleReset);

    return () => {
      socket.off('start-timer', handleStart);
      socket.off('stop-timer', handleStopLane);
      socket.off('stop-all-timers', handleStopAll);
      socket.off('reset-all-timers', handleReset);
    };
  }, [socket, laneId, onStop]);

  // Update elapsed time continuously using wall-clock
  useEffect(() => {
    let interval;
    if (running && startTime !== null) {
      interval = setInterval(() => {
        setElapsed(Math.max(0, Date.now() - startTime));
      }, 50); // 50ms is enough for smooth display
    }
    return () => clearInterval(interval);
  }, [running, startTime]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  };

  // Lane stops their own timer
  const handleStop = () => {
    if (!isAdmin) socket.emit('stop-timer', laneId);
    setRunning(false);
  };

  // Admin stops this lane
  const handleAdminStop = () => {
    if (isAdmin) socket.emit('admin-stop-lane', laneId);
    setRunning(false);
  };

  return (
    <div className={isAdmin ? "admin-Timer" : "Timer"}>
      {isAdmin ?
        <h2>Lane {laneId} - {studentName ? studentName : "Unselected"}</h2>
        :
        <h1>Lane {laneId} - {studentName ? studentName : "Unselected"}</h1>
      }
      <p>{studentHouse ? studentHouse : ""}</p>
      <p className="time">{formatTime(elapsed)}</p>
      <button className={running ? "stop-button-enable" : "stop-button-disable"} disabled={!running} onClick={isAdmin ? handleAdminStop : handleStop}>Stop</button>
    </div>
  );
};

export default Timer;