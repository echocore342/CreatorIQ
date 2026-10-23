/**
 * CreatorIQ — Frontend Application Controller
 */

// Application State
const state = {
  currentSessionId: null,
  videoInfo: null,
  comments: [],
  analytics: null,
  recommendations: [],
  activeTab: 'overview',
  activeFilter: 'all',
  activeModTag: 'all',
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  initNavigation();
  initEventHandlers();
});

// Check backend health and display indicator
async function initHealthCheck() {
  const indicator = document.getElementById('health-indicator');
  const text = document.getElementById('health-text');
  try {
    const health = await API.getHealth();
    if (health.status === 'ok') {
      indicator.classList.add('online');
      const yt = health.services?.youtube ? 'YT: Ready' : 'YT: Mock/Key Needed';
      const ai = health.services?.gemini ? 'AI: Ready' : 'AI: Key Needed';
      text.textContent = `${yt} | ${ai}`;
    }
  } catch (err) {
    indicator.classList.remove('online');
    text.textContent = 'Server Offline';
  }
}

// Navigation between sidebar tabs
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  // Update nav item active classes
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });

  // Update tab panel visibility
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabId}`);
  });

  // Update topbar title
  const titles = {
    overview: 'Overview & Comment Stream',
    analytics: 'Sentiment & Threat Intelligence',
    moderation: 'Risk Moderation Hub',
    advisor: 'AI Content Strategy Advisor',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl && titles[tabId]) {
    titleEl.textContent = titles[tabId];
  }

  // Lazy render tab specifics if session exists
  if (state.currentSessionId) {
    if (tabId === 'analytics') renderAnalyticsView();
    if (tabId === 'moderation') loadModerationView();
    if (tabId === 'advisor') loadAdvisorView();
  }
}

// Event handlers for actions
function initEventHandlers() {
  // Fetch / Analyze Button
  const analyzeBtn = document.getElementById('btn-analyze');
  const videoInput = document.getElementById('video-url-input');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      const url = videoInput.value.trim();
      if (!url) {
        showToast('Please enter a valid YouTube video URL or ID.', 'error');
        return;
      }
      await runFullPipeline(url);
    });
  }

  // Load Demo Data Button
  const demoBtn = document.getElementById('btn-load-demo');
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      try {
        setLoading(demoBtn, true, 'Loading Demo...');
        const demo = await API.loadDemoData();
        state.currentSessionId = demo.sessionId;
        state.videoInfo = demo.videoInfo;
        state.recommendations = demo.recommendations || [];
        showToast('Demo dataset loaded with real Indonesian comments & judol detections!', 'success');
        await refreshAllData();
        if (state.recommendations.length > 0) {
          renderRecommendations(state.recommendations);
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(demoBtn, false, 'Load Sample Demo');
      }
    });
  }

  // Filter buttons on comment stream
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.getAttribute('data-filter');
      renderCommentList();
    });
  });

  // Filter tags in Moderation hub
  document.querySelectorAll('.mod-filter-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mod-filter-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeModTag = btn.getAttribute('data-tag');
      loadModerationView();
    });
  });

  // Generate Recommendations Button
  const genRecsBtn = document.getElementById('btn-gen-recs');
  if (genRecsBtn) {
    genRecsBtn.addEventListener('click', async () => {
      if (!state.currentSessionId) {
        showToast('No active session. Please analyze comments first.', 'error');
        return;
      }
      try {
        setLoading(genRecsBtn, true, 'Generating with Gemini...');
        const res = await API.getRecommendations(state.currentSessionId);
        state.recommendations = res.recommendations;
        renderRecommendations(state.recommendations);
        showToast('AI Recommendations generated!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(genRecsBtn, false, 'Generate AI Insights');
      }
    });
  }
}

// Run the full pipeline: Fetch YouTube Comments -> Run Gemini Classification
async function runFullPipeline(videoUrl) {
  const analyzeBtn = document.getElementById('btn-analyze');
  try {
    setLoading(analyzeBtn, true, 'Fetching Comments...');
    const ytData = await API.fetchComments(videoUrl, 100);
    state.currentSessionId = ytData.sessionId;
    state.videoInfo = ytData.videoInfo;

    showToast(`Fetched ${ytData.totalFetched} comments from YouTube. Now classifying with Gemini...`, 'info');

    setLoading(analyzeBtn, true, 'Analyzing with AI...');
    const analysisData = await API.runAnalysis(state.currentSessionId);
    state.comments = analysisData.results;

    showToast(`Classified ${analysisData.totalAnalyzed} comments successfully!`, 'success');
    await refreshAllData();

    // Prefetch AI Content Recommendations
    try {
      const recData = await API.getRecommendations(state.currentSessionId);
      state.recommendations = recData.recommendations || [];
      if (state.activeTab === 'advisor') {
        renderRecommendations(state.recommendations);
      }
    } catch (recErr) {
      console.warn('AI recommendation prefetch notice:', recErr.message);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(analyzeBtn, false, 'Analyze Comments');
  }
}

// Refresh all views after new session or data update
async function refreshAllData() {
  if (!state.currentSessionId) return;

  // Render Video Info Card
  renderVideoInfo(state.videoInfo);

  // Fetch Analytics
  try {
    state.analytics = await API.getAnalytics(state.currentSessionId);
    renderMetrics(state.analytics);
    if (state.activeTab === 'analytics') renderAnalyticsView();
  } catch (e) {
    console.error('Error fetching analytics:', e);
  }

  // Render Comment List in Overview
  if (state.comments && state.comments.length > 0) {
    renderCommentList();
  } else if (state.analytics && state.analytics.topLiked) {
    state.comments = state.analytics.flaggedComments || [];
    renderCommentList();
  }

  // Update Moderation Badge Count
  const flaggedCount = state.analytics?.flaggedCommentsCount || 0;
  const badgeEl = document.getElementById('mod-badge');
  if (badgeEl) {
    badgeEl.textContent = flaggedCount;
    badgeEl.style.display = flaggedCount > 0 ? 'inline-block' : 'none';
  }
}

// Render Video Information Card
function renderVideoInfo(info) {
  const container = document.getElementById('video-info-container');
  if (!container || !info) return;

  const thumbUrl = info.thumbnails?.high?.url || info.thumbnails?.medium?.url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400';
  container.innerHTML = `
    <div class="video-card">
      <img src="${thumbUrl}" alt="Thumbnail" class="video-thumb" />
      <div class="video-details">
        <h3>${escapeHtml(info.title || 'YouTube Video')}</h3>
        <p><strong>Channel:</strong> ${escapeHtml(info.channelTitle || 'Unknown')} • <strong>Views:</strong> ${(info.viewCount || 0).toLocaleString()} • <strong>Likes:</strong> ${(info.likeCount || 0).toLocaleString()}</p>
        <p style="margin-top: 0.5rem; color: #64748b; font-size: 0.78rem;">Session ID: <code>${state.currentSessionId}</code></p>
      </div>
    </div>
  `;
}

// Render Top Quick Metrics
function renderMetrics(analytics) {
  if (!analytics) return;
  document.getElementById('metric-total').textContent = analytics.totalComments || 0;
  document.getElementById('metric-positive').textContent = `${analytics.sentimentPercentages?.positive || 0}%`;
  document.getElementById('metric-flagged').textContent = analytics.flaggedCommentsCount || 0;
  document.getElementById('metric-judol').textContent = analytics.riskTagCounts?.judol || 0;
}

// Render Filterable Comment Stream in Overview
function renderCommentList() {
  const container = document.getElementById('comments-tbody');
  if (!container) return;

  let list = state.comments || [];
  if (state.activeFilter === 'positive') list = list.filter(c => c.sentiment === 'positive');
  if (state.activeFilter === 'negative') list = list.filter(c => c.sentiment === 'negative');
  if (state.activeFilter === 'question') list = list.filter(c => c.category === 'question');
  if (state.activeFilter === 'risk') list = list.filter(c => Array.isArray(c.riskTags) && c.riskTags.length > 0);

  if (list.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="empty-state">No comments match this filter.</td></tr>`;
    return;
  }

  container.innerHTML = list.map(c => `
    <tr>
      <td style="width: 220px;">
        <div class="comment-author">${escapeHtml(c.author || c.authorDisplayName || 'Anonymous')}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(c.publishedAt)} • 👍 ${c.likeCount || 0}</div>
      </td>
      <td>
        <div class="comment-text">${escapeHtml(c.text || '')}</div>
        ${c.explanation ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem; font-style: italic;">AI: ${escapeHtml(c.explanation)}</div>` : ''}
      </td>
      <td style="width: 140px;">
        <span class="badge badge-${c.sentiment || 'neutral'}">${c.sentiment || 'neutral'}</span>
        ${c.category ? `<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.25rem;">Type: ${c.category}</div>` : ''}
      </td>
      <td style="width: 180px;">
        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
          ${(c.riskTags || []).map(tag => `<span class="badge badge-${tag}">${tag}</span>`).join('') || '<span style="color: #64748b; font-size: 0.75rem;">Clean</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

// Render Analytics Tab
function renderAnalyticsView() {
  if (!state.analytics) return;
  const a = state.analytics;

  // Sentiment Bar
  const posBar = document.getElementById('bar-pos');
  const neuBar = document.getElementById('bar-neu');
  const negBar = document.getElementById('bar-neg');

  if (posBar) posBar.style.width = `${a.sentimentPercentages.positive}%`;
  if (neuBar) neuBar.style.width = `${a.sentimentPercentages.neutral}%`;
  if (negBar) negBar.style.width = `${a.sentimentPercentages.negative}%`;

  document.getElementById('lbl-pos').textContent = `Positive: ${a.sentimentPercentages.positive}% (${a.sentimentCounts.positive})`;
  document.getElementById('lbl-neu').textContent = `Neutral: ${a.sentimentPercentages.neutral}% (${a.sentimentCounts.neutral})`;
  document.getElementById('lbl-neg').textContent = `Negative: ${a.sentimentPercentages.negative}% (${a.sentimentCounts.negative})`;

  // Risk Breakdown
  const riskGrid = document.getElementById('risk-tag-breakdown');
  if (riskGrid) {
    const tags = [
      { key: 'judol', label: 'Online Gambling (Judol)', count: a.riskTagCounts.judol || 0, color: '#f43f5e' },
      { key: 'spam', label: 'Commercial / Bot Spam', count: a.riskTagCounts.spam || 0, color: '#f59e0b' },
      { key: 'toxic', label: 'Toxic & Insults', count: a.riskTagCounts.toxic || 0, color: '#ef4444' },
      { key: 'inappropriate', label: 'Inappropriate Content', count: a.riskTagCounts.inappropriate || 0, color: '#d946ef' },
      { key: 'harassment', label: 'Targeted Harassment', count: a.riskTagCounts.harassment || 0, color: '#ec4899' },
    ];

    riskGrid.innerHTML = tags.map(t => `
      <div style="background-color: var(--bg-card); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-size: 0.85rem; font-weight: 600; color: ${t.color}">${t.label}</span>
          <span style="font-size: 1.1rem; font-weight: 700;">${t.count}</span>
        </div>
        <div style="height: 6px; background-color: var(--border-subtle); border-radius: 9999px; overflow: hidden;">
          <div style="width: ${Math.min(100, (t.count / (a.totalComments || 1)) * 100 * 3)}%; height: 100%; background-color: ${t.color};"></div>
        </div>
      </div>
    `).join('');
  }
}

// Load and Render Moderation View
async function loadModerationView() {
  if (!state.currentSessionId) return;
  const container = document.getElementById('moderation-tbody');
  if (!container) return;

  try {
    const filterTag = state.activeModTag === 'all' ? '' : state.activeModTag;
    const res = await API.getModeration(state.currentSessionId, filterTag);
    const comments = res.comments || [];

    if (comments.length === 0) {
      container.innerHTML = `<tr><td colspan="4" class="empty-state">No risk comments found for this filter. Clean inbox!</td></tr>`;
      return;
    }

    container.innerHTML = comments.map(c => `
      <tr>
        <td style="width: 220px;">
          <div class="comment-author">${escapeHtml(c.author)}</div>
          <div style="margin-top: 0.35rem;">
            ${(c.riskTags || []).map(tag => `<span class="badge badge-${tag}">${tag}</span>`).join(' ')}
          </div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.25rem;">Status: <strong>${c.moderationStatus}</strong></div>
        </td>
        <td>
          <div class="comment-text">${escapeHtml(c.text)}</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.4rem;"><strong>Reason:</strong> ${escapeHtml(c.explanation || 'Detected by AI guardrails')}</div>
        </td>
        <td style="width: 120px;">
          <span style="font-size: 0.85rem; font-weight: 600; color: ${c.confidence > 0.8 ? '#f43f5e' : '#f59e0b'};">
            ${Math.round((c.confidence || 0) * 100)}%
          </span>
        </td>
        <td style="width: 200px;">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-sm btn-danger" onclick="executeModAction('${c.commentId}', 'reject')">Delete/Reject</button>
            <button class="btn btn-sm btn-secondary" onclick="executeModAction('${c.commentId}', 'hold')">Hold</button>
            <button class="btn btn-sm btn-secondary" onclick="executeModAction('${c.commentId}', 'approve')">Approve</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Moderation Action Handler
window.executeModAction = async function(commentId, action) {
  try {
    const res = await API.takeModerationAction(state.currentSessionId, commentId, action);
    showToast(res.message, 'info');
    await loadModerationView();
    // Refresh stats
    state.analytics = await API.getAnalytics(state.currentSessionId);
    renderMetrics(state.analytics);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Render Recommendations in Advisor View
function renderRecommendations(recs) {
  const container = document.getElementById('recommendations-container');
  if (!container) return;

  if (!recs || recs.length === 0) {
    container.innerHTML = `<div class="empty-state">Click "Generate AI Insights" above to analyze audience comments and recommend high-engagement content ideas.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="rec-grid">
      ${recs.map(r => `
        <div class="rec-card">
          <div class="rec-header">
            <span class="badge ${r.priority === 'high' ? 'badge-negative' : 'badge-positive'}">${r.priority} Priority</span>
            <span style="font-size: 0.75rem; color: #94a3b8;">${r.relevantCommentCount || 0} comments backed</span>
          </div>
          <h4 class="rec-title">${escapeHtml(r.title)}</h4>
          <p class="rec-reason"><strong>Why:</strong> ${escapeHtml(r.reason)}</p>
          <div class="rec-outline">
            <h5>Suggested Video Outline</h5>
            <ul>
              ${(r.outline || []).map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
            </ul>
          </div>
          <div style="margin-top: auto; display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${(r.audienceTopics || []).map(t => `<span class="status-pill">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadAdvisorView() {
  const container = document.getElementById('recommendations-container');
  if (state.recommendations && state.recommendations.length > 0) {
    renderRecommendations(state.recommendations);
    return;
  }

  if (state.currentSessionId && (!state.recommendations || state.recommendations.length === 0)) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="spinner" style="margin: 0 auto 1rem auto; width: 36px; height: 36px; border-width: 3px;"></div>
          <p>Analyzing audience feedback & synthesizing strategic video recommendations with Gemini AI...</p>
        </div>
      `;
    }
    try {
      const res = await API.getRecommendations(state.currentSessionId);
      state.recommendations = res.recommendations || [];
      renderRecommendations(state.recommendations);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <p>Could not generate recommendations: ${escapeHtml(err.message)}</p>
            <button class="btn btn-primary" style="margin-top: 1rem;" onclick="document.getElementById('btn-gen-recs').click()">Retry AI Analysis</button>
          </div>
        `;
      }
    }
  }
}

// Utilities
function setLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> ${text}`;
  } else {
    button.innerHTML = text || button.dataset.originalText || 'Submit';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoStr;
  }
}
