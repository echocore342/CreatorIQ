/**
 * Health check route.
 * Returns backend status and API key configuration status (never the keys).
 */
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const youtubeConfigured = !!process.env.YOUTUBE_API_KEY;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      gemini: {
        configured: geminiConfigured,
        status: geminiConfigured ? 'ready' : 'missing_api_key',
      },
      youtube: {
        configured: youtubeConfigured,
        status: youtubeConfigured ? 'ready' : 'missing_api_key',
      },
    },
    demo: true,
    version: '1.0.0',
  });
});

module.exports = router;
