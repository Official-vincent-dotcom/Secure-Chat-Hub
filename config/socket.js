const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const GroupMessage = require('../models/GroupMessage');
const Group = require('../models/Group');
const User = require('../models/User');
const EncryptionService = require('../utils/encryption');

const setupSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.SOCKET_IO_CORS || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Track active users in groups
  const activeUsers = new Map();

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

    // ===== GROUP CHAT EVENTS =====

    // Join group
    socket.on('joinGroup', async (groupId) => {
      try {
        socket.join(`group-${groupId}`);
        
        // Track active user
        if (!activeUsers.has(groupId)) {
          activeUsers.set(groupId, new Set());
        }
        activeUsers.get(groupId).add(socket.userId);

        console.log(`User ${socket.userId} joined group ${groupId}`);

        // Notify others
        socket.broadcast.to(`group-${groupId}`).emit('userJoinedGroup', {
          userId: socket.userId,
          groupId,
          timestamp: new Date()
        });

        // Send active users count
        io.to(`group-${groupId}`).emit('activeUsersCount', {
          count: activeUsers.get(groupId).size
        });
      } catch (error) {
        console.error('Join group error:', error);
      }
    });

    // Send group message
    socket.on('sendGroupMessage', async (data) => {
      try {
        const { groupId, content, encryptionKey } = data;

        let encryptedContent = content;
        let isEncrypted = false;

        if (encryptionKey) {
          const encrypted = EncryptionService.encrypt(content, encryptionKey);
          encryptedContent = JSON.stringify(encrypted);
          isEncrypted = true;
        }

        const message = new GroupMessage({
          content: encryptedContent,
          sender: socket.userId,
          group: groupId,
          isEncrypted,
          encryptionKey: encryptionKey || null,
          readBy: [
            {
              user: socket.userId,
              readAt: new Date()
            }
          ]
        });

        await message.save();
        await message.populate('sender', 'username avatar');

        // Update group's lastMessageAt
        await Group.findByIdAndUpdate(groupId, { lastMessageAt: Date.now() });

        // Emit to all users in the group
        io.to(`group-${groupId}`).emit('newGroupMessage', {
          id: message._id,
          content: message.content,
          sender: message.sender,
          isEncrypted: message.isEncrypted,
          createdAt: message.createdAt,
          groupId
        });
      } catch (error) {
        console.error('Send group message error:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Group typing indicator
    socket.on('groupTyping', (data) => {
      const { groupId, username } = data;
      socket.broadcast.to(`group-${groupId}`).emit('userTypingGroup', {
        username,
        groupId,
        timestamp: new Date()
      });
    });

    // Stop group typing
    socket.on('stopGroupTyping', (groupId) => {
      socket.broadcast.to(`group-${groupId}`).emit('userStopTypingGroup', { groupId });
    });

    // Message reaction
    socket.on('groupMessageReaction', async (data) => {
      try {
        const { messageId, emoji, groupId } = data;
        const message = await GroupMessage.findById(messageId);

        if (message) {
          const existingReaction = message.reactions.find(
            r => r.user.toString() === socket.userId && r.emoji === emoji
          );

          if (existingReaction) {
            message.reactions = message.reactions.filter(
              r => !(r.user.toString() === socket.userId && r.emoji === emoji)
            );
          } else {
            message.reactions.push({
              user: socket.userId,
              emoji
            });
          }

          await message.save();

          io.to(`group-${groupId}`).emit('messageReactionUpdated', {
            messageId,
            reactions: message.reactions
          });
        }
      } catch (error) {
        console.error('Reaction error:', error);
      }
    });

    // Pin message
    socket.on('pinGroupMessage', async (data) => {
      try {
        const { messageId, groupId } = data;
        const message = await GroupMessage.findById(messageId);
        const group = await Group.findById(groupId);

        if (message && group) {
          const userMember = group.members.find(m => m.user.toString() === socket.userId);
          
          if (userMember && (userMember.role === 'admin' || userMember.role === 'moderator')) {
            message.isPinned = !message.isPinned;
            await message.save();

            if (message.isPinned) {
              group.pinnedMessages.push(message._id);
            } else {
              group.pinnedMessages = group.pinnedMessages.filter(
                m => m.toString() !== message._id.toString()
              );
            }

            await group.save();

            io.to(`group-${groupId}`).emit('messagePinned', {
              messageId,
              isPinned: message.isPinned
            });
          }
        }
      } catch (error) {
        console.error('Pin message error:', error);
      }
    });

    // Leave group
    socket.on('leaveGroup', (groupId) => {
      socket.leave(`group-${groupId}`);
      
      // Remove from active users
      if (activeUsers.has(groupId)) {
        activeUsers.get(groupId).delete(socket.userId);
        
        // Notify others
        io.to(`group-${groupId}`).emit('userLeftGroup', {
          userId: socket.userId,
          groupId,
          timestamp: new Date()
        });

        // Send updated active users count
        io.to(`group-${groupId}`).emit('activeUsersCount', {
          count: activeUsers.get(groupId).size
        });
      }
    });

    // ===== SINGLE CHAT EVENTS (EXISTING) =====

    // Join room
    socket.on('joinRoom', async (roomId) => {
      try {
        socket.join(`room-${roomId}`);
        console.log(`User ${socket.userId} joined room ${roomId}`);

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

        const Message = require('../models/Message');
        const message = new Message({
          content: encryptedContent,
          sender: socket.userId,
          room: roomId,
          isEncrypted,
          encryptionKey: encryptionKey || null
        });

        await message.save();
        await message.populate('sender', 'username avatar');

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
      
      // Clean up from active users
      activeUsers.forEach((users) => {
        users.delete(socket.userId);
      });
    });
  });

  return io;
};

module.exports = setupSocket;