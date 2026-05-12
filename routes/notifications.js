const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Store subscriptions in memory (use database in production)
const subscriptions = new Map();

// @route   POST /api/notifications/subscribe
// @desc    Subscribe to push notifications
// @access  Private
router.post('/subscribe', auth, async (req, res) => {
  try {
    const subscription = req.body;
    const userId = req.userId;

    if (!subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    // Store subscription (in production, save to database)
    subscriptions.set(userId, subscription);

    res.json({
      success: true,
      message: 'Subscription saved'
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// @route   POST /api/notifications/send
// @desc    Send push notification (internal use)
// @access  Private
router.post('/send', auth, async (req, res) => {
  try {
    const { userId, title, body, roomId } = req.body;

    const subscription = subscriptions.get(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // In production, use web-push library:
    // const webpush = require('web-push');
    // await webpush.sendNotification(subscription, JSON.stringify({
    //   title,
    //   body,
    //   roomId
    // }));

    res.json({
      success: true,
      message: 'Notification queued'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// @route   POST /api/notifications/unsubscribe
// @desc    Unsubscribe from push notifications
// @access  Private
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const userId = req.userId;
    subscriptions.delete(userId);

    res.json({
      success: true,
      message: 'Unsubscribed from notifications'
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
