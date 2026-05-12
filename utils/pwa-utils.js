/**
 * PWA Utilities for sending notifications and managing offline functionality
 */

const notificationManager = {
  /**
   * Send notification to user
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {object} options - Additional options
   */
  sendNotification: async (userId, title, body, options = {}) => {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title,
          body,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      return await response.json();
    } catch (error) {
      console.error('Notification error:', error);
    }
  },

  /**
   * Send notification for new message
   * @param {string} userId - User ID
   * @param {string} senderName - Sender's username
   * @param {string} roomName - Room name
   * @param {string} messagePreview - Message content preview
   * @param {string} roomId - Room ID
   */
  sendMessageNotification: async (userId, senderName, roomName, messagePreview, roomId) => {
    return notificationManager.sendNotification(
      userId,
      `📨 New message from ${senderName}`,
      `${roomName}: ${messagePreview.substring(0, 50)}...`,
      { roomId }
    );
  },

  /**
   * Send notification for user joined room
   * @param {string} userId - User ID
   * @param {string} username - Username who joined
   * @param {string} roomName - Room name
   */
  sendUserJoinedNotification: async (userId, username, roomName) => {
    return notificationManager.sendNotification(
      userId,
      `👋 User joined`,
      `${username} joined ${roomName}`
    );
  },

  /**
   * Send notification for new room invitation
   * @param {string} userId - User ID
   * @param {string} roomName - Room name
   * @param {string} inviterName - Who invited
   * @param {string} roomId - Room ID
   */
  sendRoomInviteNotification: async (userId, roomName, inviterName, roomId) => {
    return notificationManager.sendNotification(
      userId,
      `🎉 Invited to room`,
      `${inviterName} invited you to ${roomName}`,
      { roomId }
    );
  }
};

module.exports = notificationManager;
