import io from "socket.io-client";

const socket = io(
  process.env.REACT_APP_BACKEND_URL || "http://localhost:3001"
);

export default socket;