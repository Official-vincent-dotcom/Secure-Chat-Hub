const express = require('express');
const GroupMessage = require('../models/GroupMessage');
const Group = require('../models/Group');
const auth = require('../middleware/auth');
const EncryptionService = require('../utils/encryption');

const router = express.Router();

// @route   GET /api/group-messages/:groupId
// @desc    Get messages from a group
// @access  Private
router.get('/:groupId', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Check if user is member of group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isMember = group.members.some(m => m.user.toString() === req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const messages = await GroupMessage.find({ group: groupId })
      .populate('sender', 'username avatar')
      .populate('repliedTo')
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
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// @route   POST /api/group-messages
// @desc    Create a new message in group
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { content, groupId, encryptionKey, repliedTo } = req.body;

    if (!content || !groupId) {
      return res.status(400).json({ error: 'Content and groupId are required' });
    }

    // Verify user is in the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isMember = group.members.some(m => m.user.toString() === req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
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

    const message = new GroupMessage({
      content: encryptedContent,
      sender: req.userId,
      group: groupId,
      isEncrypted,
      encryptionKey: encryptionKey || null,
      repliedTo: repliedTo || null,
      readBy: [
        {
          user: req.userId,
          readAt: new Date()
        }
      ]
    });

    await message.save();
    await message.populate('sender', 'username avatar');
    await message.populate('repliedTo');

    // Update group's lastMessageAt
    group.lastMessageAt = Date.now();
    await group.save();

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Create group message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// @route   PUT /api/group-messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/:messageId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await GroupMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Can only edit your own messages' });
    }

    message.content = content;
    message.editedAt = Date.now();
    await message.save();
    await message.populate('sender', 'username avatar');

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// @route   DELETE /api/group-messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await GroupMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await GroupMessage.findByIdAndDelete(req.params.messageId);

    res.json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// @route   POST /api/group-messages/:messageId/reactions
// @desc    Add reaction to message
// @access  Private
router.post('/:messageId/reactions', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await GroupMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction if already exists
      message.reactions = message.reactions.filter(
        r => !(r.user.toString() === req.userId && r.emoji === emoji)
      );
    } else {
      // Add new reaction
      message.reactions.push({
        user: req.userId,
        emoji
      });
    }

    await message.save();
    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// @route   POST /api/group-messages/:messageId/pin
// @desc    Pin a message
// @access  Private
router.post('/:messageId/pin', auth, async (req, res) => {
  try {
    const message = await GroupMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const group = await Group.findById(message.group);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin/moderator
    const userMember = group.members.find(m => m.user.toString() === req.userId);
    if (!userMember || (userMember.role !== 'admin' && userMember.role !== 'moderator')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

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

    res.json({
      success: true,
      message,
      isPinned: message.isPinned
    });
  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// @route   PUT /api/group-messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.put('/:messageId/read', auth, async (req, res) => {
  try {
    const message = await GroupMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user already marked as read
    const alreadyRead = message.readBy.some(r => r.user.toString() === req.userId);

    if (!alreadyRead) {
      message.readBy.push({
        user: req.userId,
        readAt: new Date()
      });
      await message.save();
    }

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;