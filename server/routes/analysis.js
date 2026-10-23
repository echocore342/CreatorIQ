/**
 * Comment analysis route.
 * Uses Gemini to classify comments stored in a session.
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
        message: 'Provide the sessionId from the comment retrieval step',
      });
    }

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        message: 'The analysis session was not found. It may have expired. Please fetch comments again.',
      });
    }

    if (!session.comments || session.comments.length === 0) {
      return res.status(400).json({
        error: 'No comments to analyze',
        message: 'The session has no comments. Please fetch comments first.',
      });
    }

    // Classify comments
    const commentsToClassify = session.comments.map(c => ({
      commentId: c.commentId,
      text: c.text,
    }));

    const classificationResults = await geminiService.classifyComments(commentsToClassify);

    // Merge classification with comment data and store
    const mergedResults = session.comments.map(comment => {
      const classification = classificationResults.find(c => c.commentId === comment.commentId) || {
        category: 'neutral',
        sentiment: 'neutral',
        riskTags: [],
        confidence: 0,
        explanation: 'Not classified',
      };
      return {
        ...comment,
        ...classification,
        _text: comment.text, // keep original text for recommendations
      };
    });

    sessionService.updateSession(sessionId, {
      analysis: mergedResults,
      analytics: null, // Reset analytics so they get recalculated
    });

    res.json({
      sessionId,
      totalAnalyzed: mergedResults.length,
      results: mergedResults.map(r => ({
        commentId: r.commentId,
        text: r.text,
        authorDisplayName: r.authorDisplayName,
        publishedAt: r.publishedAt,
        likeCount: r.likeCount,
        category: r.category,
        sentiment: r.sentiment,
        riskTags: r.riskTags,
        confidence: r.confidence,
        explanation: r.explanation,
      })),
    });
  } catch (error) {
    console.error('Analysis error:', error.message);
    const status = error.message.includes('rate limit') ? 429 : 500;
    res.status(status).json({
      error: 'Analysis failed',
      message: error.message,
    });
  }
});

module.exports = router;
