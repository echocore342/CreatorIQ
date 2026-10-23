/**
 * YouTube Data API v3 service.
 * Retrieves publicly available comments using a server-side API key.
 * Does NOT perform any moderation actions without proper OAuth.
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Extract video ID from various YouTube URL formats.
 * @param {string} input - URL or video ID
 * @returns {string|null}
 */
function extractVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Direct video ID (11 characters, alphanumeric + dash + underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    // youtube.com/watch?v=ID
    if (url.hostname.includes('youtube.com') && url.searchParams.has('v')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    }
    // youtu.be/ID
    if (url.hostname === 'youtu.be') {
      const path = url.pathname.slice(1);
      if (/^[a-zA-Z0-9_-]{11}$/.test(path)) return path;
    }
    // youtube.com/embed/ID
    if (url.hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/embed/')[1]?.split(/[/?]/)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    // youtube.com/shorts/ID
    if (url.hostname.includes('youtube.com') && url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/shorts/')[1]?.split(/[/?]/)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // Not a valid URL — already checked direct ID above
  }

  return null;
}

/**
 * Fetch video metadata.
 * @param {string} videoId
 * @param {string} apiKey
 * @returns {Promise<object|null>}
 */
async function getVideoInfo(videoId, apiKey) {
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: videoId,
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`YouTube API error: ${response.status} — ${error?.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  return {
    videoId: item.id,
    title: item.snippet?.title || '',
    channelTitle: item.snippet?.channelTitle || '',
    channelId: item.snippet?.channelId || '',
    publishedAt: item.snippet?.publishedAt || '',
    description: item.snippet?.description?.substring(0, 500) || '',
    thumbnails: item.snippet?.thumbnails || {},
    viewCount: parseInt(item.statistics?.viewCount || '0', 10),
    likeCount: parseInt(item.statistics?.likeCount || '0', 10),
    commentCount: parseInt(item.statistics?.commentCount || '0', 10),
  };
}

/**
 * Fetch comment threads for a video.
 * @param {string} videoId
 * @param {string} apiKey
 * @param {object} options
 * @param {number} options.maxResults - Per page, max 100
 * @param {string} options.pageToken - Pagination token
 * @param {string} options.order - 'relevance' or 'time'
 * @returns {Promise<{comments: Array, nextPageToken: string|null, totalResults: number}>}
 */
async function getCommentThreads(videoId, apiKey, options = {}) {
  const { maxResults = 50, pageToken = null, order = 'relevance' } = options;

  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    maxResults: Math.min(maxResults, 100).toString(),
    order,
    textFormat: 'plainText',
    key: apiKey,
  });
  if (pageToken) params.set('pageToken', pageToken);

  const response = await fetch(`${YOUTUBE_API_BASE}/commentThreads?${params}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const status = response.status;
    if (status === 403) {
      const reason = error?.error?.errors?.[0]?.reason || '';
      if (reason === 'commentsDisabled') {
        throw new Error('Comments are disabled for this video.');
      }
      if (reason === 'quotaExceeded') {
        throw new Error('YouTube API quota exceeded. Please try again later.');
      }
      throw new Error(`YouTube API forbidden: ${error?.error?.message || reason}`);
    }
    if (status === 404) {
      throw new Error('Video not found or comments unavailable.');
    }
    throw new Error(`YouTube API error: ${status} — ${error?.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const comments = (data.items || []).map(item => {
    const snippet = item.snippet?.topLevelComment?.snippet;
    return {
      commentId: item.snippet?.topLevelComment?.id || item.id,
      text: snippet?.textDisplay || '',
      authorDisplayName: snippet?.authorDisplayName || 'Anonymous',
      authorProfileImageUrl: snippet?.authorProfileImageUrl || '',
      likeCount: snippet?.likeCount || 0,
      publishedAt: snippet?.publishedAt || '',
      updatedAt: snippet?.updatedAt || '',
      replyCount: item.snippet?.totalReplyCount || 0,
    };
  });

  return {
    comments,
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || comments.length,
  };
}

/**
 * Fetch multiple pages of comments up to a limit.
 * @param {string} videoId
 * @param {string} apiKey
 * @param {number} maxComments - Total comment limit
 * @returns {Promise<{comments: Array, totalFetched: number, hasMore: boolean}>}
 */
async function fetchAllComments(videoId, apiKey, maxComments = 200) {
  const allComments = [];
  let pageToken = null;
  const perPage = Math.min(maxComments, 100);

  while (allComments.length < maxComments) {
    const result = await getCommentThreads(videoId, apiKey, {
      maxResults: perPage,
      pageToken,
    });

    allComments.push(...result.comments);
    pageToken = result.nextPageToken;

    if (!pageToken || allComments.length >= maxComments) break;
  }

  const trimmed = allComments.slice(0, maxComments);
  return {
    comments: trimmed,
    totalFetched: trimmed.length,
    hasMore: !!pageToken,
  };
}

/**
 * Set moderation status for a comment (requires OAuth, not API key).
 * This function documents the YouTube API contract but will fail in demo mode
 * because an API key does not authorize moderation.
 */
async function setModerationStatus(commentId, moderationStatus, apiKey) {
  // YouTube moderation requires OAuth 2.0 authorization from the channel owner.
  // An API key alone cannot moderate comments.
  // This returns a clear error explaining the limitation.
  return {
    success: false,
    commentId,
    requestedStatus: moderationStatus,
    error: 'Moderation requires OAuth 2.0 authorization from the YouTube channel owner. ' +
           'An API key alone cannot modify comment moderation status. ' +
           'This feature requires implementing the full OAuth flow in a future release.',
  };
}

module.exports = {
  extractVideoId,
  getVideoInfo,
  getCommentThreads,
  fetchAllComments,
  setModerationStatus,
};
