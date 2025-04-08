import { useState, useEffect } from 'react';

const Timer = ({ laneId, socket, isAdmin }) => {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    socket.on('start-timer', () => setRunning(true));
    socket.on('stop-timer', (stoppedLane) => {
      if (stoppedLane === laneId) setRunning(false);
    });

    return () => {
      socket.off('start-timer');
      socket.off('stop-timer');
    };
  }, [socket, laneId]);

  useEffect(() => {
    let interval;
    if (running) {
      interval = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [running]);

  const handleStart = () => {
    if (isAdmin) socket.emit('start-timer');
  };

  const handleStop = () => {
    if (!isAdmin) socket.emit('stop-timer', laneId);
  };

  return (
    <div>
      <h3>Lane {laneId}</h3>
      <p>Time: {time}s</p>
      {isAdmin ? (
        <button onClick={handleStart}>Start</button>
      ) : (
        <button onClick={handleStop}>Stop</button>
      )}
    </div>
  );
};

export default Timer;