const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const cors = require('cors');
app.use(cors());

app.use(express.static('public'));

server.listen(3000, ()=>{
    console.log("Server is running on port 3000")
});

io.on('connection', (socket)=>{
    console.log("A user is connected");

    socket.on('start-timer', ()=>{
        console.log("Start timer broadcast");
        io.emit('start-timer');
    });

    socket.on('stop-timer', (laneId)=>{
        console.log(`Stop timer for ${laneId}`);
        io.emit('stop-timer', laneId);
    });

    socket.on('disconnect', ()=>{
        console.log("User disconnected");
    });
})

