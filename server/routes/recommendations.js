/**
 * Recommendations route.
 * Generates grounded AI content recommendations based on analyzed comments.
 */
const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const sessionService = require('../services/session');

router.post('/', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'Gemini API key not configured',
        message: 'Set GEMINI_API_KEY in your .env file',
      });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId',
        message: 'Provide the sessionId of the analyzed session',
      });
    }

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        message: 'The analysis session was not found.',
      });
    }

    if (!session.analysis || session.analysis.length === 0) {
      return res.status(400).json({
        error: 'No analysis available',
        message: 'Comments must be analyzed before generating recommendations.',
      });
    }

    // Return cached recommendations if already computed
    if (session.recommendations && session.recommendations.length > 0) {
      return res.json({
        sessionId,
        cached: true,
        recommendations: session.recommendations,
      });
    }

    const videoInfo = {
      title: session.videoTitle,
      channelTitle: session.channelTitle,
    };

    const recommendations = await geminiService.generateRecommendations(session.analysis, videoInfo);

    sessionService.updateSession(sessionId, { recommendations });

    res.json({
      sessionId,
      cached: false,
      recommendations,
    });
  } catch (error) {
    console.error('Recommendations error:', error.message);
    const status = error.message.includes('rate limit') ? 429 : 500;
    res.status(status).json({
      error: 'Failed to generate recommendations',
      message: error.message,
    });
  }
});

module.exports = router;
