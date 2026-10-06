const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enable Socket.io with CORS & polling/websocket transports
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route to serve index.html for root requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-Memory Storage: Room Code -> { users: Array<{ id, joinedAt }>, createdAt }
const rooms = new Map();

/**
 * Generate a random 6-digit numeric room code
 */
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

/**
 * Clean up empty rooms from memory
 */
function cleanupRoom(code) {
  const room = rooms.get(code);
  if (room && room.users.length === 0) {
    rooms.delete(code);
    console.log(`[PURGED] Room ${code} purged from server memory.`);
  }
}

io.on('connection', (socket) => {
  console.log(`[CONNECTED] Socket ${socket.id}`);

  // Create a new chat room
  socket.on('create-room', (callback) => {
    const code = generateRoomCode();
    rooms.set(code, {
      code,
      users: [{ id: socket.id, joinedAt: Date.now() }],
      createdAt: Date.now()
    });

    socket.join(`room:${code}`);
    socket.currentRoom = code;

    console.log(`[ROOM CREATED] ${code} by ${socket.id}`);
    if (typeof callback === 'function') {
      callback({ success: true, code });
    }
  });

  // Join an existing room
  socket.on('join-room', ({ code }, callback) => {
    const formattedCode = (code || '').trim();
    const room = rooms.get(formattedCode);

    if (!room) {
      if (typeof callback === 'function') {
        return callback({ success: false, message: 'Invalid or expired room code.' });
      }
      return socket.emit('error-message', 'Invalid or expired room code.');
    }

    // Strict 2-user capacity limit check
    if (room.users.length >= 2) {
      if (typeof callback === 'function') {
        return callback({ success: false, message: 'Room is full (Max 2 participants allowed).' });
      }
      return socket.emit('error-message', 'Room is full (Max 2 participants allowed).');
    }

    // Add user to room
    room.users.push({ id: socket.id, joinedAt: Date.now() });
    socket.join(`room:${formattedCode}`);
    socket.currentRoom = formattedCode;

    console.log(`[USER JOINED] ${socket.id} joined room ${formattedCode}`);

    if (typeof callback === 'function') {
      callback({ success: true, code: formattedCode });
    }

    // Notify both sockets in the room that partner has connected
    io.to(`room:${formattedCode}`).emit('partner-joined', {
      userCount: room.users.length
    });
  });

  // Relay chat message
  socket.on('send-message', ({ content, tempId, timestamp }) => {
    const roomCode = socket.currentRoom;
    if (!roomCode || !rooms.has(roomCode)) return;

    const messageData = {
      id: tempId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: socket.id,
      content,
      timestamp: timestamp || new Date().toISOString()
    };

    // Broadcast to counterpart in room
    socket.to(`room:${roomCode}`).emit('receive-message', messageData);

    // Acknowledge delivery back to sender if partner is present
    const room = rooms.get(roomCode);
    if (room && room.users.length === 2) {
      socket.emit('message-delivered', { id: messageData.id });
    }
  });

  // Typing indicators
  socket.on('typing', () => {
    if (socket.currentRoom) {
      socket.to(`room:${socket.currentRoom}`).emit('partner-typing');
    }
  });

  socket.on('stop-typing', () => {
    if (socket.currentRoom) {
      socket.to(`room:${socket.currentRoom}`).emit('partner-stop-typing');
    }
  });

  // Explicit leave room action
  socket.on('leave-room', () => {
    const code = socket.currentRoom;
    if (!code || !rooms.has(code)) return;

    const room = rooms.get(code);
    room.users = room.users.filter(u => u.id !== socket.id);
    socket.leave(`room:${code}`);
    socket.currentRoom = null;

    console.log(`[USER LEFT] ${socket.id} left room ${code}`);

    // Notify counterpart
    socket.to(`room:${code}`).emit('partner-left');

    // Self cleaning if empty
    cleanupRoom(code);
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    console.log(`[DISCONNECTED] Socket ${socket.id}`);
    const code = socket.currentRoom;
    if (code && rooms.has(code)) {
      const room = rooms.get(code);
      room.users = room.users.filter(u => u.id !== socket.id);

      // Notify counterpart
      socket.to(`room:${code}`).emit('partner-left');

      // Purge room if both users disconnected
      cleanupRoom(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Chatling Ephemeral Chat Server Running `);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Environment: Zero DB / Volatile In-Memory Storage `);
  console.log(`==================================================`);
});

module.exports = server;
