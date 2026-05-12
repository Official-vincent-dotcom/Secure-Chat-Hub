require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const setupSocket = require('./config/socket');

// Import routes
const authRoutes = require('./routes/auth');
const messagesRoutes = require('./routes/messages');
const roomsRoutes = require('./routes/rooms');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100)
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static files
app.use(express.static('public'));

// Service Worker caching headers
app.get('/service-worker.js', (req, res) => {
  res.type('application/javascript');
  res.header('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
  express.static('public')(req, res);
});

// Manifest caching
app.get('/manifest.json', (req, res) => {
  res.header('Cache-Control', 'max-age=3600');
  res.sendFile(__dirname + '/public/manifest.json');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Socket.io setup
const io = setupSocket(server);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-chat-hub')
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🔐 Secure-Chat-Hub running on port ${PORT}`);
  console.log(`📱 Install as PWA: http://localhost:${PORT}`);
  console.log(`📝 Visit: http://localhost:${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
