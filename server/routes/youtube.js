/**
 * YouTube comment retrieval route.
 * Fetches comments using server-side API key. Never exposes credentials.
 */
const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');
const sessionService = require('../services/session');

router.post('/comments', async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'YouTube API key not configured',
        message: 'Set YOUTUBE_API_KEY in your .env file',
      });
    }

    const { videoUrl, maxComments = 100 } = req.body;
    if (!videoUrl) {
      return res.status(400).json({
        error: 'Missing videoUrl',
        message: 'Provide a YouTube video URL or video ID',
      });
    }

    const videoId = youtubeService.extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({
        error: 'Invalid video URL',
        message: 'Could not extract a valid YouTube video ID from the provided input',
      });
    }

    // Fetch video info
    const videoInfo = await youtubeService.getVideoInfo(videoId, apiKey);
    if (!videoInfo) {
      return res.status(404).json({
        error: 'Video not found',
        message: `No video found with ID: ${videoId}`,
      });
    }

    // Fetch comments with bounded limit
    const limit = Math.min(Math.max(parseInt(maxComments) || 100, 10), 500);
    const commentData = await youtubeService.fetchAllComments(videoId, apiKey, limit);

    // Create session for this analysis
    const session = sessionService.createSession(videoId, videoInfo.title, videoInfo.channelTitle);
    session.comments = commentData.comments;

    res.json({
      sessionId: session.id,
      videoInfo,
      comments: commentData.comments,
      totalFetched: commentData.totalFetched,
      hasMore: commentData.hasMore,
    });
  } catch (error) {
    console.error('YouTube comments error:', error.message);
    const status = error.message.includes('quota') ? 429
      : error.message.includes('disabled') ? 403
      : error.message.includes('not found') ? 404
      : 500;
    res.status(status).json({
      error: 'YouTube API error',
      message: error.message,
    });
  }
});

module.exports = router;
