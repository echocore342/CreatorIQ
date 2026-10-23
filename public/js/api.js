/**
 * CreatorIQ — API Client Module
 */
const API = {
  baseUrl: '/api',

  async getHealth() {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  },

  async fetchComments(videoUrl, maxComments = 100) {
    const res = await fetch(`${this.baseUrl}/youtube/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, maxComments }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to fetch comments');
    return data;
  },

  async runAnalysis(sessionId) {
    const res = await fetch(`${this.baseUrl}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Analysis failed');
    return data;
  },

  async getAnalytics(sessionId) {
    const res = await fetch(`${this.baseUrl}/analytics/${sessionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to load analytics');
    return data;
  },

  async getRecommendations(sessionId) {
    const res = await fetch(`${this.baseUrl}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to generate recommendations');
    return data;
  },

  async getModeration(sessionId, tag = '') {
    const url = tag ? `${this.baseUrl}/moderation/${sessionId}?tag=${encodeURIComponent(tag)}` : `${this.baseUrl}/moderation/${sessionId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to fetch moderation data');
    return data;
  },

  async takeModerationAction(sessionId, commentId, action) {
    const res = await fetch(`${this.baseUrl}/moderation/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, commentId, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Moderation action failed');
    return data;
  },

  async loadDemoData() {
    const res = await fetch(`${this.baseUrl}/demo/load-sample`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to load demo');
    return data;
  },
};

window.API = API;
