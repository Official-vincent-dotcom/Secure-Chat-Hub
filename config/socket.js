const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const EncryptionService = require('../utils/encryption');

const setupSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.SOCKET_IO_CORS || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Middleware to authenticate socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection events
  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected with socket ${socket.id}`);

    // Update user status to online
    User.findByIdAndUpdate(socket.userId, { status: 'online' }).catch(console.error);

    // Join room
    socket.on('joinRoom', async (roomId) => {
      try {
        socket.join(`room-${roomId}`);
        console.log(`User ${socket.userId} joined room ${roomId}`);

        // Notify others
        socket.broadcast.to(`room-${roomId}`).emit('userJoined', {
          userId: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Join room error:', error);
      }
    });

    // Send message
    socket.on('sendMessage', async (data) => {
      try {
        const { roomId, content, encryptionKey } = data;

        let encryptedContent = content;
        let isEncrypted = false;

        if (encryptionKey) {
          const encrypted = EncryptionService.encrypt(content, encryptionKey);
          encryptedContent = JSON.stringify(encrypted);
          isEncrypted = true;
        }

        const message = new Message({
          content: encryptedContent,
          sender: socket.userId,
          room: roomId,
          isEncrypted,
          encryptionKey: encryptionKey || null
        });

        await message.save();
        await message.populate('sender', 'username avatar');

        // Emit to all users in the room
        io.to(`room-${roomId}`).emit('newMessage', {
          id: message._id,
          content: message.content,
          sender: message.sender,
          isEncrypted: message.isEncrypted,
          createdAt: message.createdAt
        });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { roomId, username } = data;
      socket.broadcast.to(`room-${roomId}`).emit('userTyping', {
        username,
        timestamp: new Date()
      });
    });

    // Stop typing
    socket.on('stopTyping', (roomId) => {
      socket.broadcast.to(`room-${roomId}`).emit('userStopTyping');
    });

    // Leave room
    socket.on('leaveRoom', (roomId) => {
      socket.leave(`room-${roomId}`);
      socket.broadcast.to(`room-${roomId}`).emit('userLeft', {
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.userId} disconnected`);
      await User.findByIdAndUpdate(socket.userId, { status: 'offline' }).catch(console.error);
    });
  });

  return io;
};

module.exports = setupSocket;