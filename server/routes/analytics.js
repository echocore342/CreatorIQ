/**
 * Analytics route.
 * Aggregates statistics, sentiment breakdowns, and risk metrics for a session.
 */
const express = require('express');
const router = express.Router();
const sessionService = require('../services/session');

router.get('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        message: 'The analysis session was not found. Please run analysis first.',
      });
    }

    const analysis = session.analysis || [];
    const total = analysis.length;

    if (total === 0) {
      return res.status(400).json({
        error: 'No analysis data',
        message: 'This session has not been analyzed yet. Run analysis first.',
      });
    }

    // Sentiment count
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const categoryCounts = { positive: 0, neutral: 0, negative: 0, question: 0, suggestion: 0 };
    const riskTagCounts = {
      judol: 0,
      spam: 0,
      toxic: 0,
      inappropriate: 0,
      harassment: 0,
      hate_speech: 0,
    };

    let totalLikes = 0;
    let highRiskCount = 0;

    analysis.forEach(c => {
      // Sentiments
      if (sentimentCounts[c.sentiment] !== undefined) {
        sentimentCounts[c.sentiment]++;
      } else {
        sentimentCounts.neutral++;
      }

      // Categories
      if (categoryCounts[c.category] !== undefined) {
        categoryCounts[c.category]++;
      }

      // Risk tags
      if (Array.isArray(c.riskTags)) {
        if (c.riskTags.length > 0) highRiskCount++;
        c.riskTags.forEach(tag => {
          if (riskTagCounts[tag] !== undefined) {
            riskTagCounts[tag]++;
          } else {
            riskTagCounts[tag] = 1;
          }
        });
      }

      totalLikes += (c.likeCount || 0);
    });

    const sentimentPercentages = {
      positive: total ? Math.round((sentimentCounts.positive / total) * 100) : 0,
      neutral: total ? Math.round((sentimentCounts.neutral / total) * 100) : 0,
      negative: total ? Math.round((sentimentCounts.negative / total) * 100) : 0,
    };

    // Top liked comments
    const topLiked = [...analysis]
      .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
      .slice(0, 5)
      .map(c => ({
        commentId: c.commentId,
        author: c.authorDisplayName,
        text: c.text,
        likeCount: c.likeCount,
        sentiment: c.sentiment,
        category: c.category,
      }));

    // Most flagged comments
    const flaggedComments = analysis
      .filter(c => Array.isArray(c.riskTags) && c.riskTags.length > 0)
      .slice(0, 10)
      .map(c => ({
        commentId: c.commentId,
        author: c.authorDisplayName,
        text: c.text,
        riskTags: c.riskTags,
        confidence: c.confidence,
        explanation: c.explanation,
      }));

    const analytics = {
      sessionId,
      videoId: session.videoId,
      videoTitle: session.videoTitle,
      channelTitle: session.channelTitle,
      totalComments: total,
      totalLikes,
      flaggedCommentsCount: highRiskCount,
      sentimentCounts,
      sentimentPercentages,
      categoryCounts,
      riskTagCounts,
      topLiked,
      flaggedComments,
    };

    sessionService.updateSession(sessionId, { analytics });

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      error: 'Failed to calculate analytics',
      message: error.message,
    });
  }
});

module.exports = router;
