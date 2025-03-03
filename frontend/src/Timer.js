import React, {useState, useEffect} from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

const Timer = ({laneId}) => {
    const [time, setTime] = useState(0);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        socket.on('start-timer', ()=>{
            setRunning(true);
        });

        socket.on('stop-timer', (laneIdToStop)=>{
            if(laneIdToStop === laneId){
                setRunning(false);
            }
        });

        return ()=>{
            socket.off('start-timer');
            socket.off('stop-timer');
        };
    },[laneId]);

    useEffect(()=>{
        let interval;
        if(running){
            interval = setInterval(()=>{
                setTime((prevTime)=>prevTime+1);
            }, 1000);
        } else{
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [running]);

    const handleStart = () => {
        socket.emit('start-timer');
    }

    const handleStop = () => {
        socket.emit('stop-timer');
    }

    return(
        <div>
            <h3>Lane {laneId}</h3>
            <p>Time: {time} seconds</p>
            <button onClick={handleStart}>Start</button>
            <button onClick={handleStop}>Stop</button>
        </div>
    );
};

export default Timer;