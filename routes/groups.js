const express = require('express');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const User = require('../models/User');
const auth = require('../middleware/auth');
const Validators = require('../utils/validators');
const EncryptionService = require('../utils/encryption');

const router = express.Router();

// @route   GET /api/groups
// @desc    Get all groups for the user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({
      'members.user': req.userId
    })
      .populate('owner', 'username avatar')
      .populate('members.user', 'username avatar status')
      .sort({ lastMessageAt: -1 });

    res.json({
      success: true,
      count: groups.length,
      groups
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPrivate, maxMembers } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!Validators.validateRoomName(name)) {
      return res.status(400).json({ error: 'Invalid group name' });
    }

    const group = new Group({
      name: Validators.sanitizeString(name),
      description: Validators.sanitizeString(description || ''),
      isPrivate: isPrivate || false,
      maxMembers: maxMembers || 100,
      owner: req.userId,
      members: [
        {
          user: req.userId,
          role: 'admin'
        }
      ]
    });

    await group.save();
    await group.populate('owner', 'username avatar');
    await group.populate('members.user', 'username avatar status');

    res.status(201).json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// @route   GET /api/groups/:groupId
// @desc    Get a specific group
// @access  Private
router.get('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('owner', 'username avatar')
      .populate('members.user', 'username avatar status')
      .populate('pinnedMessages');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is member
    const isMember = group.members.some(m => m.user._id.toString() === req.userId);
    if (!isMember && !group.isPrivate) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// @route   POST /api/groups/:groupId/invite
// @desc    Invite user to group
// @access  Private
router.post('/:groupId/invite', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const { groupId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin or owner
    const userMember = group.members.find(m => m.user.toString() === req.userId);
    if (!userMember || (userMember.role !== 'admin' && userMember.role !== 'moderator')) {
      return res.status(403).json({ error: 'Only admins can invite members' });
    }

    // Check if user already in group
    if (group.members.some(m => m.user.toString() === userId)) {
      return res.status(400).json({ error: 'User already in group' });
    }

    // Check max members
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    group.members.push({
      user: userId,
      role: 'member'
    });

    await group.save();
    await group.populate('members.user', 'username avatar status');

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// @route   POST /api/groups/:groupId/join
// @desc    Join a public group
// @access  Private
router.post('/:groupId/join', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.isPrivate) {
      return res.status(403).json({ error: 'Cannot join private group' });
    }

    if (group.members.some(m => m.user.toString() === req.userId)) {
      return res.status(400).json({ error: 'Already in this group' });
    }

    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    group.members.push({
      user: req.userId,
      role: 'member'
    });

    await group.save();
    await group.populate('members.user', 'username avatar status');

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// @route   DELETE /api/groups/:groupId/leave
// @desc    Leave a group
// @access  Private
router.delete('/:groupId/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is owner
    if (group.owner.toString() === req.userId) {
      return res.status(400).json({ error: 'Owner cannot leave group' });
    }

    group.members = group.members.filter(m => m.user.toString() !== req.userId);
    await group.save();

    res.json({
      success: true,
      message: 'Left group successfully'
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// @route   PUT /api/groups/:groupId
// @desc    Update group details
// @access  Private
router.put('/:groupId', auth, async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is owner
    if (group.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only owner can update group' });
    }

    if (name) {
      if (!Validators.validateRoomName(name)) {
        return res.status(400).json({ error: 'Invalid group name' });
      }
      group.name = Validators.sanitizeString(name);
    }

    if (description) {
      group.description = Validators.sanitizeString(description);
    }

    if (avatar) {
      group.avatar = avatar;
    }

    group.updatedAt = Date.now();
    await group.save();
    await group.populate('members.user', 'username avatar status');

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// @route   DELETE /api/groups/:groupId
// @desc    Delete a group
// @access  Private
router.delete('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only owner can delete group' });
    }

    // Delete all messages in the group
    await GroupMessage.deleteMany({ group: req.params.groupId });
    await Group.findByIdAndDelete(req.params.groupId);

    res.json({
      success: true,
      message: 'Group deleted'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// @route   POST /api/groups/:groupId/members/:memberId
// @desc    Change member role
// @access  Private
router.put('/:groupId/members/:memberId', auth, async (req, res) => {
  try {
    const { role } = req.body;
    const { groupId, memberId } = req.params;

    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only owner can change roles' });
    }

    const member = group.members.find(m => m.user.toString() === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    member.role = role;
    await group.save();
    await group.populate('members.user', 'username avatar status');

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: 'Failed to change member role' });
  }
});

// @route   DELETE /api/groups/:groupId/members/:memberId
// @desc    Remove member from group
// @access  Private
router.delete('/:groupId/members/:memberId', auth, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is owner or moderator
    const userMember = group.members.find(m => m.user.toString() === req.userId);
    if (!userMember || (userMember.role !== 'admin' && userMember.role !== 'moderator')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    group.members = group.members.filter(m => m.user.toString() !== memberId);
    await group.save();
    await group.populate('members.user', 'username avatar status');

    res.json({
      success: true,
      group
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;