const express = require('express');
const Message = require('../models/Message');
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const EncryptionService = require('../utils/encryption');

const router = express.Router();

// @route   GET /api/messages/:roomId
// @desc    Get messages from a room
// @access  Private
router.get('/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await Message.find({ room: roomId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .exec();

    res.json({
      success: true,
      count: messages.length,
      messages: messages.reverse()
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// @route   POST /api/messages
// @desc    Create a new message
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { content, roomId, encryptionKey } = req.body;

    if (!content || !roomId) {
      return res.status(400).json({ error: 'Content and roomId are required' });
    }

    // Verify user is in the room
    const room = await Room.findById(roomId);
    if (!room || !room.members.includes(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to post in this room' });
    }

    let encryptedContent = content;
    let isEncrypted = false;

    if (encryptionKey) {
      try {
        const encrypted = EncryptionService.encrypt(content, encryptionKey);
        encryptedContent = JSON.stringify(encrypted);
        isEncrypted = true;
      } catch (error) {
        console.error('Encryption failed:', error);
      }
    }

    const message = new Message({
      content: encryptedContent,
      sender: req.userId,
      room: roomId,
      isEncrypted,
      encryptionKey: encryptionKey || null
    });

    await message.save();
    await message.populate('sender', 'username avatar');

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(req.params.messageId);

    res.json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;