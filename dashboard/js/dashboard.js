// MAJU Command Center — Dashboard Controller
// Orchestrates all agents from a single bird's-eye view

// --- Auth Gate ---
// SHA-256 hash of the access code. To change the password:
// 1. Open browser console
// 2. Run: crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD')).then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')))
// 3. Replace the hash below
const ACCESS_CODE_HASH = '4208e138fc6b28af24bcf6d55046108bdc7183924ae71fc0e138cdea287d48d0'; // maju2026

async function hashCode(code) {
  const data = new TextEncoder().encode(code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function handleLogin(e) {
  e.preventDefault();
  const input = document.getElementById('authPassword');
  const error = document.getElementById('authError');
  const hash = await hashCode(input.value);

  if (hash === ACCESS_CODE_HASH) {
    sessionStorage.setItem('maju_auth', '1');
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('dashboardApp').style.display = 'block';
    initDashboard();
  } else {
    error.textContent = 'Invalid access code';
    input.value = '';
    input.focus();
  }
  return false;
}

function handleLogout() {
  sessionStorage.removeItem('maju_auth');
  document.getElementById('authGate').style.display = 'flex';
  document.getElementById('dashboardApp').style.display = 'none';
}

function checkAuth() {
  if (sessionStorage.getItem('maju_auth') === '1') {
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('dashboardApp').style.display = 'block';
    initDashboard();
  }
}

const DASHBOARD_CONFIG = {
  // Agent API endpoints — update these with actual backend URLs
  agents: {
    'ig-research': {
      name: 'IG Research Agent',
      apiBase: '/api/ig-research',
      status: 'idle',
    },
    'video-launchpad': {
      name: 'AI Video Launchpad',
      apiBase: '/api/video',
      appUrl: '../index.html',
      status: 'idle',
    },
    'animal-stash': {
      name: 'Animal Stash Pipeline',
      apiBase: null,
      status: 'idle',
    },
  },
  refreshInterval: 30000, // 30s auto-refresh
};

// --- State ---
let agentStates = {};
let logEntries = [];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

function initDashboard() {
  updateTimestamp();
  loadDashboardData();
  setInterval(updateTimestamp, 1000);
  setInterval(loadDashboardData, DASHBOARD_CONFIG.refreshInterval);
}

function updateTimestamp() {
  const el = document.getElementById('lastUpdated');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

// --- Data Loading ---
async function loadDashboardData() {
  try {
    // Try to load IG Research Agent data
    const igData = await fetchAgentData('ig-research', 'get_dashboard_data');
    if (igData) {
      updateIGResearchCard(igData);
      updateInsights(igData);
    }
  } catch (err) {
    // Agent not running or not connected — that's ok
    console.log('Dashboard data load:', err.message);
  }

  // Check video launchpad backend
  checkVideoBackend();

  // Load Animal Stash data
  loadAnimalStashData();
}

async function fetchAgentData(agentId, tool, args = {}) {
  const agent = DASHBOARD_CONFIG.agents[agentId];
  if (!agent) return null;

  try {
    const resp = await fetch(`${agent.apiBase}/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// --- IG Research Agent Updates ---
function updateIGResearchCard(data) {
  if (!data || !data.overview) return;
  const o = data.overview;

  document.getElementById('igPostCount').textContent = formatNumber(o.totalPosts);
  document.getElementById('igHookCount').textContent = formatNumber(o.totalHooks);
  document.getElementById('igPatternCount').textContent = formatNumber(o.totalPatterns);
  document.getElementById('igBriefCount').textContent = formatNumber(o.totalBriefs);

  if (o.lastCycle) {
    const status = o.lastCycle.status;
    const badge = document.querySelector('#igStatus .status-badge');
    badge.className = `status-badge ${status === 'running' ? 'running' : status === 'completed' ? 'success' : 'idle'}`;
    badge.textContent = status === 'running' ? 'Running' : status === 'completed' ? 'Ready' : 'Idle';
    document.getElementById('igLastCycle').textContent = formatDate(o.lastCycle.completed_at || o.lastCycle.started_at);
  }
}

function updateInsights(data) {
  // Top Hooks
  if (data.topHooks && data.topHooks.length) {
    const el = document.getElementById('topHooksList');
    el.innerHTML = data.topHooks.map(h => `
      <div class="insight-item">
        <div class="insight-item-title">
          "${truncate(h.hook_text, 80)}"
          <span class="insight-item-score">${h.effectiveness_score}/10</span>
        </div>
        <div class="insight-item-meta">
          ${h.hook_type} · @${h.owner_username} · ${h.post_engagement}% eng
        </div>
      </div>
    `).join('');
  }

  // Patterns
  if (data.topPatterns && data.topPatterns.length) {
    const el = document.getElementById('patternsList');
    el.innerHTML = data.topPatterns.map(p => `
      <div class="insight-item">
        <div class="insight-item-title">
          ${p.pattern_name}
          <span class="insight-item-score">${p.avg_engagement_rate}% eng</span>
        </div>
        <div class="insight-item-meta">${p.pattern_type} · seen ${p.frequency}x</div>
      </div>
    `).join('');
  }

  // Briefs
  if (data.pendingBriefs && data.pendingBriefs.length) {
    const el = document.getElementById('briefsList');
    el.innerHTML = data.pendingBriefs.map(b => `
      <div class="insight-item">
        <div class="insight-item-title">
          ${b.title}
          <span class="insight-item-score">P${b.priority_score}</span>
        </div>
        <div class="insight-item-meta">${b.format} · ${b.hook ? truncate(b.hook, 50) : 'No hook'}</div>
      </div>
    `).join('');
  }

  // Competitors
  if (data.competitorLandscape && data.competitorLandscape.length) {
    const el = document.getElementById('competitorList');
    el.innerHTML = data.competitorLandscape.map(c => `
      <div class="insight-item">
        <div class="insight-item-title">
          @${c.owner_username}
          <span class="insight-item-score">${c.avg_engagement?.toFixed(1)}% avg</span>
        </div>
        <div class="insight-item-meta">
          ${c.total_posts} posts · ${Math.round(c.avg_likes)} avg likes · ${Math.round(c.avg_views || 0)} avg views
        </div>
      </div>
    `).join('');
  }
}

// --- Video Launchpad ---
async function checkVideoBackend() {
  try {
    const resp = await fetch('/health');
    if (resp.ok) {
      const health = await resp.json();

      // Update Video Launchpad status
      document.getElementById('videoBackendStatus').textContent = 'Online';
      document.getElementById('videoBackendStatus').style.color = '#34d399';
      loadVideoStats();

      // Update IG Research Agent live status from health endpoint
      if (health.agents?.['ig-research']) {
        const ig = health.agents['ig-research'];
        const badge = document.querySelector('#igStatus .status-badge');
        if (ig.status === 'online') {
          badge.className = 'status-badge success';
          badge.textContent = 'Online';
        } else if (ig.status === 'no-data') {
          badge.className = 'status-badge idle';
          badge.textContent = 'No Data';
        } else {
          badge.className = 'status-badge error';
          badge.textContent = 'Offline';
        }
      }

      // Update system status
      const allOnline = Object.values(health.agents || {}).every(a => a.status === 'online');
      document.getElementById('systemStatusText').textContent = allOnline ? 'All Systems Online' : 'Partial';
    } else {
      throw new Error('not ok');
    }
  } catch {
    document.getElementById('videoBackendStatus').textContent = 'Offline';
    document.getElementById('videoBackendStatus').style.color = '#f87171';
    document.getElementById('systemStatusText').textContent = 'Backend Offline';
  }
}

async function loadVideoStats() {
  try {
    const resp = await fetch('/api/jobs');
    if (!resp.ok) return;
    const jobs = await resp.json();
    if (!Array.isArray(jobs)) return;

    const totalJobs = jobs.length;
    const totalClips = jobs.reduce((sum, j) => sum + (j.clipCount || j.clips?.length || 0), 0);
    const queued = jobs.filter(j => j.status === 'queued' || j.status === 'pending' || j.status === 'processing').length;
    const published = jobs.filter(j => j.status === 'published' || j.status === 'completed' || j.status === 'done').length;

    document.getElementById('videoJobCount').textContent = formatNumber(totalJobs);
    document.getElementById('videoClipCount').textContent = formatNumber(totalClips);
    document.getElementById('videoQueueCount').textContent = formatNumber(queued);
    document.getElementById('videoPublished').textContent = formatNumber(published);
  } catch {
    // Keep existing values if fetch fails
  }
}

function openVideoLaunchpad() {
  const agent = DASHBOARD_CONFIG.agents['video-launchpad'];
  window.open(agent.appUrl || '../index.html', '_blank');
}

// --- Command Console ---
function addLog(message, type = 'info') {
  const log = document.getElementById('consoleLog');
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const ts = new Date().toLocaleTimeString();
  entry.textContent = `[${ts}] ${message}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
  logEntries.push({ message, type, ts });
}

function clearLog() {
  document.getElementById('consoleLog').innerHTML =
    '<div class="log-entry log-system">Console cleared.</div>';
  logEntries = [];
}

async function sendCommand() {
  const input = document.getElementById('commandInput');
  const agentSelect = document.getElementById('agentSelect');
  const command = input.value.trim();
  if (!command) return;

  const agentId = agentSelect.value;
  const agentName = DASHBOARD_CONFIG.agents[agentId]?.name || agentId;

  addLog(`> ${command}`, 'command');
  input.value = '';

  // Direct tool commands — these hit the IG Research API directly
  const directToolMap = {
    'run research': 'run_research_cycle',
    'research cycle': 'run_research_cycle',
    'generate briefs': 'generate_briefs',
    'status': 'get_research_status',
  };

  const directTool = directToolMap[command.toLowerCase()];
  if (directTool) {
    await runCommand(agentId, directTool);
    return;
  }

  // Everything else goes through the smart console endpoint
  await sendConsoleMessage(command);
}

async function sendConsoleMessage(message) {
  addLog('Thinking...', 'info');
  try {
    // Send Claude API key from localStorage if available (same key the Video Launchpad uses)
    const headers = { 'Content-Type': 'application/json' };
    try {
      const keys = JSON.parse(localStorage.getItem('maju_api_keys') || '{}');
      if (keys.claude) headers['x-api-key-value'] = keys.claude;
    } catch { /* no keys */ }

    const resp = await fetch('/api/console', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
    });
    if (!resp.ok) {
      addLog(`Error: ${resp.statusText}`, 'error');
      return;
    }
    const data = await resp.json();
    const lines = (data.response || 'No response').split('\n');
    lines.forEach(line => {
      if (line.startsWith('CONTENT') || line.startsWith('TOP') || line.startsWith('COMPETITOR') || line.startsWith('AVAILABLE')) {
        addLog(line, 'success');
      } else if (line.trim().startsWith('>') || line.trim().match(/^\d+\./)) {
        addLog(line, 'command');
      } else {
        addLog(line, 'info');
      }
    });
    if (data.type === 'ai') {
      addLog('[Powered by Claude AI]', 'system');
    }
  } catch {
    addLog('Console unavailable — backend may be offline', 'error');
  }
}

async function runCommand(agentId, tool, args = {}) {
  const agentName = DASHBOARD_CONFIG.agents[agentId]?.name || agentId;
  setAgentStatus(agentId, 'running');
  addLog(`Executing ${tool} on ${agentName}...`, 'info');

  try {
    const result = await fetchAgentData(agentId, tool, args);
    if (result) {
      addLog(`${tool} completed successfully`, 'success');
      if (typeof result === 'object') {
        addLog(JSON.stringify(result, null, 2).slice(0, 500), 'info');
      }
      setAgentStatus(agentId, 'success');
      // Refresh dashboard data
      loadDashboardData();
    } else {
      addLog(`${tool}: No response from agent (may not be running)`, 'error');
      setAgentStatus(agentId, 'idle');
    }
  } catch (err) {
    addLog(`${tool} failed: ${err.message}`, 'error');
    setAgentStatus(agentId, 'error');
  }
}

function setAgentStatus(agentId, status) {
  const statusMap = {
    'ig-research': 'igStatus',
    'video-launchpad': 'videoStatus',
  };
  const el = document.querySelector(`#${statusMap[agentId]} .status-badge`);
  if (!el) return;

  el.className = `status-badge ${status}`;
  const labels = { idle: 'Idle', running: 'Running...', success: 'Ready', error: 'Error' };
  el.textContent = labels[status] || status;
}

// --- Detail Panel ---
function showAgentDetail(agentId) {
  const panel = document.getElementById('detailPanel');
  const title = document.getElementById('detailTitle');
  const content = document.getElementById('detailContent');
  const agentName = DASHBOARD_CONFIG.agents[agentId]?.name || agentId;

  title.textContent = `${agentName} — Details`;
  panel.style.display = 'block';

  if (agentId === 'ig-research') {
    content.innerHTML = `
      <p style="color: var(--text-secondary); margin-bottom: 16px;">
        Loading IG Research Agent data...
      </p>
    `;
    fetchAgentData(agentId, 'get_research_status').then(data => {
      if (data) {
        content.innerHTML = `<pre style="white-space: pre-wrap; color: var(--text-secondary);">${JSON.stringify(data, null, 2)}</pre>`;
      } else {
        content.innerHTML = `<p style="color: var(--text-muted);">Agent not connected. Start the MCP server to see details.</p>`;
      }
    });
  } else if (agentId === 'animal-stash') {
    if (animalStashData && animalStashData.projects) {
      const p = animalStashData.projects;
      const inProg = p.filter(x => x.status === 'in_progress').length;
      const done = p.filter(x => x.status === 'completed').length;
      const q = p.filter(x => x.status === 'queued').length;
      content.innerHTML = `
        <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.8;">
          <p><strong>Pipeline:</strong> Brief &rarr; Statics &rarr; Animate &rarr; Stitch &rarr; PostProd &rarr; Publish</p>
          <p><strong>Total projects:</strong> ${p.length} (${inProg} in progress, ${done} completed, ${q} queued)</p>
          <p><strong>Total frames generated:</strong> ${p.reduce((s, x) => s + (x.statics_count || 0), 0)}</p>
          <p><strong>Total clips generated:</strong> ${p.reduce((s, x) => s + (x.clips_count || 0), 0)}</p>
          <p><strong>Data generated:</strong> ${animalStashData.generated_at || 'Unknown'}</p>
          <p style="margin-top: 12px; color: var(--text-muted);">
            Run <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">python -m pipeline.dashboard</code> to refresh data.
          </p>
        </div>
      `;
    } else {
      content.innerHTML = '<p style="color: var(--text-muted);">No Animal Stash data available.</p>';
    }
  } else if (agentId === 'video-launchpad') {
    content.innerHTML = `
      <p style="color: var(--text-secondary);">
        The AI Video Launchpad manages video generation via Higgsfield/Kling APIs,
        FFmpeg stitching, and clip publishing.
      </p>
      <p style="margin-top: 12px;">
        <a href="../index.html" target="_blank" style="color: var(--accent-blue);">Open Launchpad →</a>
      </p>
    `;
  }
}

function hideDetail() {
  document.getElementById('detailPanel').style.display = 'none';
}

// --- Animal Stash Pipeline ---
let animalStashData = null;

const AS_STAGE_NAMES = ['Brief', 'Statics', 'Animate', 'Stitch', 'PostProd', 'Publish'];

const ANIMAL_EMOJIS = {
  'maltese': '\uD83D\uDC15',
  'corgi': '\uD83D\uDC15',
  'pembroke welsh corgi': '\uD83D\uDC15',
  'red fox': '\uD83E\uDD8A',
  'fox': '\uD83E\uDD8A',
  'raccoon': '\uD83E\uDD9D',
  'north american raccoon': '\uD83E\uDD9D',
  'ball python': '\uD83D\uDC0D',
  'python': '\uD83D\uDC0D',
  'sugar glider': '\uD83D\uDC3F\uFE0F',
  'sugar glider (caramel)': '\uD83D\uDC3F\uFE0F',
  'cat': '\uD83D\uDC31',
  'rabbit': '\uD83D\uDC07',
  'hamster': '\uD83D\uDC39',
  'ferret': '\uD83E\uDDAD',
  'parrot': '\uD83E\uDD9C',
  'owl': '\uD83E\uDD89',
  'hedgehog': '\uD83E\uDD94',
};

function getAnimalEmoji(animal) {
  const key = animal.toLowerCase();
  if (ANIMAL_EMOJIS[key]) return ANIMAL_EMOJIS[key];
  for (const [k, v] of Object.entries(ANIMAL_EMOJIS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return '\uD83D\uDC3E';
}

async function loadAnimalStashData() {
  try {
    const resp = await fetch('data/projects.json');
    if (!resp.ok) {
      updateAnimalStashStatus('offline');
      return;
    }
    animalStashData = await resp.json();
    updateAnimalStashCard(animalStashData);
    updateAnimalStashStatus('online');
  } catch {
    updateAnimalStashStatus('offline');
  }
}

function updateAnimalStashStatus(status) {
  const badge = document.querySelector('#animalStashStatus .status-badge');
  if (!badge) return;
  if (status === 'online') {
    badge.className = 'status-badge success';
    badge.textContent = 'Active';
  } else {
    badge.className = 'status-badge idle';
    badge.textContent = 'No Data';
  }
}

function updateAnimalStashCard(data) {
  if (!data || !data.projects) return;
  const projects = data.projects;

  document.getElementById('asProjectCount').textContent = projects.length;
  document.getElementById('asStaticsCount').textContent =
    projects.reduce((sum, p) => sum + (p.statics_count || 0), 0);
  document.getElementById('asClipsCount').textContent =
    projects.reduce((sum, p) => sum + (p.clips_count || 0), 0);
  document.getElementById('asPublishedCount').textContent =
    projects.filter(p => p.status === 'completed').length;

  if (data.generated_at) {
    document.getElementById('asLastUpdated').textContent = formatDate(data.generated_at);
  }
}

function showAnimalStashProjects() {
  const panel = document.getElementById('animalStashPanel');
  panel.style.display = 'block';

  if (!animalStashData || !animalStashData.projects) {
    document.getElementById('asProjectsContainer').innerHTML =
      '<p style="color: var(--text-muted); padding: 20px;">No project data available. Run pipeline.dashboard to generate.</p>';
    return;
  }

  const projects = animalStashData.projects;
  const inProgress = projects.filter(p => p.status === 'in_progress');
  const completed = projects.filter(p => p.status === 'completed');
  const queued = projects.filter(p => p.status === 'queued');

  renderProjectSection('asInProgress', 'In Progress', inProgress);
  renderProjectSection('asCompleted', 'Completed', completed);
  renderProjectSection('asQueued', 'Queued', queued);
}

function hideAnimalStashProjects() {
  document.getElementById('animalStashPanel').style.display = 'none';
}

function renderProjectSection(containerId, title, projects) {
  const container = document.getElementById(containerId);
  if (!projects.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <h4 class="as-section-title">${title} <span class="as-section-count">${projects.length}</span></h4>
    <div class="as-project-grid">
      ${projects.map(renderProjectCard).join('')}
    </div>
  `;
}

function renderProjectCard(project) {
  const emoji = getAnimalEmoji(project.animal);
  const statusClass = {
    'completed': 'as-status-completed',
    'in_progress': 'as-status-progress',
    'queued': 'as-status-queued',
    'failed': 'as-status-failed',
  }[project.status] || 'as-status-queued';

  const statusLabel = {
    'completed': 'Completed',
    'in_progress': 'In Progress',
    'queued': 'Queued',
    'failed': 'Failed',
  }[project.status] || project.status;

  const progressSteps = AS_STAGE_NAMES.map((name, i) => {
    const stageNum = i + 1;
    let stepClass = 'as-step-future';
    if (stageNum < project.stage) stepClass = 'as-step-done';
    else if (stageNum === project.stage) {
      stepClass = project.status === 'completed' ? 'as-step-done' : 'as-step-current';
    }
    return `<div class="as-step ${stepClass}" title="${name}">
      <div class="as-step-bar"></div>
      <span class="as-step-label">${name}</span>
    </div>`;
  }).join('');

  const hookText = project.hook_text
    ? `<p class="as-hook">"${truncateText(project.hook_text, 60)}"</p>`
    : '';

  const familyInfo = project.family_composition
    ? `<span class="as-family">${project.family_composition}</span>`
    : '';

  return `
    <div class="as-project-card">
      <div class="as-card-header">
        <span class="as-animal-emoji">${emoji}</span>
        <div class="as-card-title">
          <h5>${project.animal}</h5>
          <span class="as-location">${project.location}</span>
        </div>
        <span class="as-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      ${hookText}
      <div class="as-progress">
        ${progressSteps}
      </div>
      <div class="as-card-footer">
        <span class="as-date">${project.date}</span>
        ${familyInfo}
        <span class="as-asset-counts">
          ${project.statics_count ? project.statics_count + ' frames' : ''}
          ${project.statics_count && project.clips_count ? ' / ' : ''}
          ${project.clips_count ? project.clips_count + ' clips' : ''}
        </span>
      </div>
    </div>
  `;
}

function truncateText(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// --- Helpers ---
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}
