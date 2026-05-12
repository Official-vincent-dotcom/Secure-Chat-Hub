const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const Validators = require('../utils/validators');

const router = express.Router();

// @route   GET /api/rooms
// @desc    Get all rooms for the user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.userId })
      .populate('owner', 'username avatar')
      .populate('members', 'username avatar')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: rooms.length,
      rooms
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// @route   POST /api/rooms
// @desc    Create a new room
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    if (!Validators.validateRoomName(name)) {
      return res.status(400).json({ error: 'Invalid room name' });
    }

    const room = new Room({
      name: Validators.sanitizeString(name),
      description: Validators.sanitizeString(description || ''),
      isPrivate: isPrivate || false,
      owner: req.userId,
      members: [req.userId]
    });

    await room.save();
    await room.populate('owner', 'username avatar');

    res.status(201).json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// @route   GET /api/rooms/:roomId
// @desc    Get a specific room
// @access  Private
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('owner', 'username avatar')
      .populate('members', 'username avatar status');

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// @route   POST /api/rooms/:roomId/join
// @desc    Join a room
// @access  Private
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.members.includes(req.userId)) {
      return res.status(400).json({ error: 'Already in this room' });
    }

    room.members.push(req.userId);
    await room.save();
    await room.populate('owner', 'username avatar');
    await room.populate('members', 'username avatar');

    res.json({
      success: true,
      room
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// @route   DELETE /api/rooms/:roomId
// @desc    Delete a room
// @access  Private
router.delete('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only room owner can delete' });
    }

    // Delete all messages in the room
    await Message.deleteMany({ room: req.params.roomId });
    await Room.findByIdAndDelete(req.params.roomId);

    res.json({
      success: true,
      message: 'Room deleted'
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

module.exports = router;