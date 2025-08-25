import { useState, useEffect } from 'react';

const Timer = ({ laneId, socket, isAdmin }) => {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // Listen for global start
    socket.on('start-timer', () => setRunning(true));

    // Listen for lane-specific stop
    socket.on('stop-timer', (stoppedLane) => {
      if (stoppedLane === laneId) setRunning(false);
    });

    socket.on('stop-all-timers', () => setRunning(false));

    socket.on('reset-all-timers', () => {
      setRunning(false);
      setTime(0);
    });

    return () => {
      socket.off('start-timer');
      socket.off('stop-timer');
      socket.off('stop-all-timers');
      socket.off('reset-all-timers');
    };
  }, [socket, laneId]);

  useEffect(() => {
    let interval;
    if (running) {
      interval = setInterval(() => setTime((t) => t + 10), 1);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [running]);

  // Lane user stops their own lane
  const handleStop = () => {
    if (!isAdmin) socket.emit('stop-timer', laneId);
    setRunning(false);
  };

  // Admin emergency stops any lane
  const handleAdminStop = () => {
    if (isAdmin) socket.emit('admin-stop-lane', laneId);
    setRunning(false);
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  };

  return (
    <div>
      <h3>Lane {laneId}</h3>
      <p>Time: {formatTime(time)}</p>

      {(isAdmin && running) && (
        <div>
          <button onClick={handleAdminStop}>Stop</button>
        </div>
      )}

      {(!isAdmin && running) && (
        // Lane user stop
        <button onClick={handleStop}>Stop</button>
      )}
    </div>
  );
};

export default Timer;