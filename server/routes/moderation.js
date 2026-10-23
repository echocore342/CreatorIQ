/**
 * Comment moderation route.
 * Handles risk-based moderation workflow and transparent OAuth status reporting.
 */
const express = require('express');
const router = express.Router();
const sessionService = require('../services/session');
const youtubeService = require('../services/youtube');

/**
 * GET /api/moderation/:sessionId
 * List flagged comments with optional risk tag filter
 */
router.get('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tag, status } = req.query;

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        message: 'Analysis session not found. Please analyze a video first.',
      });
    }

    let flagged = (session.analysis || []).filter(c => Array.isArray(c.riskTags) && c.riskTags.length > 0);

    if (tag) {
      flagged = flagged.filter(c => c.riskTags.includes(tag));
    }

    if (status) {
      flagged = flagged.filter(c => (c.moderationStatus || 'pending') === status);
    }

    res.json({
      sessionId,
      totalFlagged: flagged.length,
      comments: flagged.map(c => ({
        commentId: c.commentId,
        author: c.authorDisplayName,
        text: c.text,
        publishedAt: c.publishedAt,
        likeCount: c.likeCount,
        category: c.category,
        sentiment: c.sentiment,
        riskTags: c.riskTags,
        confidence: c.confidence,
        explanation: c.explanation,
        moderationStatus: c.moderationStatus || 'pending',
      })),
    });
  } catch (error) {
    console.error('Moderation fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch flagged comments',
      message: error.message,
    });
  }
});

/**
 * POST /api/moderation/action
 * Perform moderation action (heldForReview, published, rejected)
 * Transparently handles demo / OAuth mode constraints
 */
router.post('/action', async (req, res) => {
  try {
    const { sessionId, commentId, action } = req.body;

    if (!sessionId || !commentId || !action) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Provide sessionId, commentId, and action (reject, hold, approve)',
      });
    }

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
      });
    }

    const comment = (session.analysis || []).find(c => c.commentId === commentId);
    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found in session',
      });
    }

    // Try live YouTube moderation API call if API key present
    const apiKey = process.env.YOUTUBE_API_KEY;
    const liveResult = await youtubeService.setModerationStatus(commentId, action, apiKey);

    // Record the status in session for local interactive demo state
    const mappedStatus = action === 'reject' ? 'rejected' : action === 'hold' ? 'held_for_review' : 'approved';
    comment.moderationStatus = mappedStatus;
    sessionService.updateSession(sessionId, { analysis: session.analysis });

    res.json({
      success: true,
      commentId,
      actionAppliedLocally: mappedStatus,
      apiNotice: liveResult.error,
      message: `Comment marked as ${mappedStatus} in session dashboard. Note: Direct YouTube API moderation requires Channel Owner OAuth2 tokens.`,
    });
  } catch (error) {
    console.error('Moderation action error:', error);
    res.status(500).json({
      error: 'Failed to apply moderation action',
      message: error.message,
    });
  }
});

module.exports = router;
