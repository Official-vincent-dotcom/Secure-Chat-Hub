const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a group name'],
    trim: true,
    minlength: [2, 'Group name must be at least 2 characters'],
    maxlength: [50, 'Group name cannot exceed 50 characters']
  },
  description: {
    type: String,
    default: '',
    maxlength: [250, 'Description cannot exceed 250 characters']
  },
  avatar: {
    type: String,
    default: 'https://via.placeholder.com/150?text=Group'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxMembers: {
    type: Number,
    default: 100,
    min: 2,
    max: 1000
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  settings: {
    allowInvites: {
      type: Boolean,
      default: true
    },
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    muteNotifications: {
      type: Boolean,
      default: false
    },
    archiveMessages: {
      type: Boolean,
      default: true
    }
  },
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupMessage'
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ owner: 1 });
groupSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Group', groupSchema);