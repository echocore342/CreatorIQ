/**
 * In-memory session manager for temporary analysis results.
 * Each analysis run creates a session with an expiration time.
 * Sessions are isolated and auto-cleaned.
 */
const { v4: uuidv4 } = require('uuid');

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 50;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, {id: string, videoId: string, videoTitle: string, channelTitle: string, comments: Array, analysis: Array, analytics: object|null, recommendations: Array, createdAt: number, expiresAt: number}>} */
const sessions = new Map();

function createSession(videoId, videoTitle, channelTitle) {
  cleanExpiredSessions();

  if (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) sessions.delete(oldest[0]);
  }

  const id = uuidv4();
  const now = Date.now();
  const session = {
    id,
    videoId,
    videoTitle: videoTitle || '',
    channelTitle: channelTitle || '',
    comments: [],
    analysis: [],
    analytics: null,
    recommendations: [],
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(id, session);
  return session;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function updateSession(sessionId, updates) {
  const session = getSession(sessionId);
  if (!session) return null;
  Object.assign(session, updates);
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

function listSessions() {
  cleanExpiredSessions();
  return [...sessions.values()].map(s => ({
    id: s.id,
    videoId: s.videoId,
    videoTitle: s.videoTitle,
    commentCount: s.comments.length,
    analysisCount: s.analysis.length,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }));
}

function clearAllSessions() {
  const count = sessions.size;
  sessions.clear();
  return count;
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
}

// Periodic cleanup
setInterval(cleanExpiredSessions, CLEANUP_INTERVAL_MS);

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  listSessions,
  clearAllSessions,
};
