const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
      origin: "http://localhost:3000", // React frontend
      methods: ["GET", "POST"]
    }
  });
  

const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:3000', // React dev server
  methods: ['GET', 'POST'],
}));

app.use(express.static('public'));

server.listen(3001, ()=>{
    console.log("Server is running on port 3001")
});

io.on('connection', (socket)=>{
    console.log("A user is connected");
    socket.on('start-timer', ()=>{
        console.log("Start timer broadcast");
        io.emit('start-timer');
    });

    socket.on('stop-timer', (laneId) => {
        console.log(`Stop timer for lane ${laneId}`);
        io.emit('stop-timer', laneId); // Send stop event to all clients
    });    

    socket.on('disconnect', ()=>{
        console.log("User disconnected");
    });
})

