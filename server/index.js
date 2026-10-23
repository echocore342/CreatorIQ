/**
 * CreatorIQ — AI-powered YouTube Comment Analytics and Moderation Server
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const geminiService = require('./services/gemini');

// Initialize Gemini if key is provided
if (process.env.GEMINI_API_KEY) {
  try {
    geminiService.initGemini(process.env.GEMINI_API_KEY);
    console.log('✓ Gemini AI Service initialized');
  } catch (err) {
    console.warn('! Gemini init warning:', err.message);
  }
} else {
  console.log('ℹ GEMINI_API_KEY not set yet. Live AI features will require key or sample demo.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*.ytimg.com', 'https://*.googleusercontent.com', 'https://images.unsplash.com'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', generalLimiter);

// Specific Rate Limiter for Gemini AI calls
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'AI request limit reached. Please wait a minute.' },
});
app.use('/api/analysis', aiLimiter);
app.use('/api/recommendations', aiLimiter);

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/youtube', require('./routes/youtube'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api/demo', require('./routes/demo'));

// 404 Handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Fallback to index.html for SPA/dashboard navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 CreatorIQ Server running at: http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 YouTube API: ${process.env.YOUTUBE_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🤖 Gemini AI:   ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`===============================================`);
});

module.exports = app;
