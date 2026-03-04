/* âââââââââââââââââââââââââââââââââââââââââââ
   MAJU AI Video Launchpad â v1.1
   Main application logic
   âââââââââââââââââââââââââââââââââââââââââââ */
(function () {
  'use strict';

  // âââ Config âââ
  const CONFIG = {
    higgsfield: {
      asset: 'majurender8oz',
      avatar: 'pateit',
    },
    avatarMeta: {
      pateit: { name: 'Patient Maya', ig: '@breealba' },
    },
    productMeta: {
      majurender8oz: { name: "Maju's Black Seed Oil 8oz" },
    },
    storageKeys: {
      queue: 'maju_queue',
      apiKeys: 'maju_api_keys',
    },
  };

  // âââ State âââ
  let queue = JSON.parse(localStorage.getItem(CONFIG.storageKeys.queue) || '[]');
  let apiKeys = JSON.parse(localStorage.getItem(CONFIG.storageKeys.apiKeys) || '{}');
  let currentRejectId = null;

  // âââ DOM Refs âââ
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // âââ Navigation âââ
  const viewMap = {
    dashboard: 'view-dashboard',
    approval: 'view-approval',
    scheduled: 'view-scheduled',
    'sop-wiki': 'view-sop-wiki',
    settings: 'view-settings',
  };

  function switchView(name) {
    $$('.view').forEach((v) => v.classList.remove('active'));
    $$('.nav-btn').forEach((b) => b.classList.remove('active'));
    const viewEl = $(`#${viewMap[name]}`);
    const navEl = $(`.nav-btn[data-view="${name}"]`);
    if (viewEl) viewEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    const titles = {
      dashboard: 'Dashboard',
      approval: 'Approval Queue',
      scheduled: 'Scheduled Posts',
      'sop-wiki': 'SOP Wiki',
      settings: 'API Settings',
    };
    $('#page-title').textContent = titles[name] || 'Dashboard';
  }

  $$('.nav-btn').forEach((btn) =>
    btn.addEventListener('click', () => switchView(btn.dataset.view))
  );

  // Links inside views that go to settings
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-goto]')) {
      e.preventDefault();
      switchView(e.target.dataset.goto);
    }
  });

  // Mobile menu
  const menuToggle = $('#menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
    });
  }

  // âââ Posting Toggle âââ
  $$('input[name="postMode"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      const schedField = $('#schedule-field');
      if (radio.value === 'schedule' && radio.checked) {
        schedField.classList.remove('hidden');
      } else if (radio.value === 'asap' && radio.checked) {
        schedField.classList.add('hidden');
      }
    })
  );

  // âââ Generate Video âââ
  $('#submit-video').addEventListener('click', () => {
    const type = $('#video-type').value;
    const versions = parseInt($('#versions').value);
    const avatar = $('#avatar').value;
    const avatarName = $('#avatar').selectedOptions[0].textContent;
    const product = $('#product').value;
    const productName = $('#product').selectedOptions[0].textContent;
    const postMode = $('input[name="postMode"]:checked').value;
    const schedDate = $('#schedule-date')?.value || '';
    const notes = $('#notes').value.trim();

    for (let i = 0; i < versions; i++) {
      const item = {
        id: Date.now().toString(36) + '-' + i,
        type,
        typeName: $('#video-type').selectedOptions[0].textContent,
        avatar,
        avatarName,
        product,
        productName,
        postMode,
        schedDate: postMode === 'schedule' ? schedDate : null,
        notes,
        version: i + 1,
        totalVersions: versions,
        status: 'pending',
        revisionCount: 0,
        revisionNotes: [],
        createdAt: new Date().toISOString(),
        pipelineStage: 'generate', // generate â stitch â queue â post
      };
      queue.unshift(item);
    }

    saveQueue();
    renderQueue();
    renderActivity();
    updateBadge();
    showPipeline();

    // Reset form
    $('#notes').value = '';
  });

  // âââ Pipeline Visualization âââ
  function showPipeline() {
    const card = $('#pipeline-card');
    card.classList.remove('hidden');
    const steps = $$('.pipeline-step');
    const msg = $('#pipeline-msg');

    // Simulate pipeline stages
    let stage = 0;
    const stages = [
      { label: 'Sending to Higgsfield for generationâ¦', key: 'generate' },
      { label: 'FFmpeg stitching & editingâ¦', key: 'stitch' },
      { label: 'Added to approval queue. Review when ready.', key: 'queue' },
    ];

    function advance() {
      if (stage > 0) steps[stage - 1].classList.replace('active', 'done');
      if (stage < stages.length) {
        steps[stage].classList.add('active');
        msg.textContent = stages[stage].label;

        // Check if API key exists for the current stage
        if (stage === 0 && !apiKeys.higgsfield) {
          msg.textContent =
            'â ï¸ Higgsfield API key not set â video generation simulated. Add key in Settings.';
        }
        stage++;
        if (stage < stages.length) setTimeout(advance, 1800);
        else setTimeout(() => (msg.textContent = 'â Pipeline complete â videos in queue.'), 1200);
      }
    }
    // Reset
    steps.forEach((s) => {
      s.classList.remove('active', 'done');
    });
    advance();
  }

  // âââ Queue Rendering âââ
  function renderQueue(filter = 'all') {
    const list = $('#queue-list');
    const filtered =
      filter === 'all' ? queue : queue.filter((q) => q.status === filter);

    if (!filtered.length) {
      list.innerHTML =
        '<p class="empty-state">No items match this filter.</p>';
      return;
    }

    list.innerHTML = filtered
      .map(
        (item) => `
      <div class="queue-item status-${item.status}" data-id="${item.id}">
        <div class="queue-info">
          <h4>${item.typeName} â v${item.version}/${item.totalVersions}</h4>
          <p>${item.productName} Â· ${item.avatarName}</p>
          ${item.postMode === 'asap' ? '<p>ð Post ASAP</p>' : `<p>ð ${formatDate(item.schedDate)}</p>`}
          ${item.notes ? `<p>"${item.notes}"</p>` : ''}
          <div class="queue-meta">
            Status: <strong>${item.status.toUpperCase()}</strong> Â·
            Created: ${formatDate(item.createdAt)}
            ${item.revisionCount > 0 ? `<div class="revision-count">ð Revision ${item.revisionCount}</div>` : ''}
          </div>
          ${item.revisionNotes.length ? item.revisionNotes.map((n, i) => `<div class="rejection-notes">Rev ${i + 1}: ${n}</div>`).join('') : ''}
        </div>
        <div class="queue-actions">
          ${item.status === 'pending' || item.status === 'revision'
            ? `<button class="btn-approve" data-action="approve" data-id="${item.id}">â Approve</button>
               <button class="btn-reject" data-action="reject" data-id="${item.id}">â Reject</button>`
            : ''
          }
        </div>
      </div>
    `
      )
      .join('');
  }

  // Queue filter buttons
  $$('.filter-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderQueue(btn.dataset.filter);
    })
  );

  // Queue actions (approve / reject)
  document.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if (!action || !id) return;

    if (action === 'approve') {
      const item = queue.find((q) => q.id === id);
      if (item) {
        item.status = 'approved';
        item.pipelineStage = 'post';
        saveQueue();
        renderQueue(getActiveFilter());
        renderActivity();
        updateBadge();

        // If metricool key exists, would post here
        if (apiKeys.metricool) {
          console.log('[Metricool] Would schedule/post:', item);
        }
      }
    }

    if (action === 'reject') {
      currentRejectId = id;
      $('#reject-modal').classList.remove('hidden');
      $('#reject-notes').value = '';
      $('#reject-notes').focus();
    }
  });

  // âââ Rejection Modal âââ
  $('#btn-cancel-reject').addEventListener('click', () => {
    $('#reject-modal').classList.add('hidden');
    currentRejectId = null;
  });

  $('#btn-confirm-reject').addEventListener('click', () => {
    const notes = $('#reject-notes').value.trim();
    if (!notes) {
      $('#reject-notes').style.borderColor = 'var(--danger)';
      return;
    }

    const item = queue.find((q) => q.id === currentRejectId);
    if (item) {
      item.status = 'revision';
      item.revisionCount++;
      item.revisionNotes.push(notes);
      item.pipelineStage = 'generate'; // back to Higgsfield for revision
      saveQueue();
      renderQueue(getActiveFilter());
      renderActivity();
      updateBadge();

      // If higgsfield key exists, would send revision request here
      if (apiKeys.higgsfield) {
        console.log('[Higgsfield] Would send revision request:', {
          asset: CONFIG.higgsfield.asset,
          avatar: CONFIG.higgsfield.avatar,
          notes,
          revisionCount: item.revisionCount,
        });
      }
    }

    $('#reject-modal').classList.add('hidden');
    currentRejectId = null;
  });

  // Close modal on overlay click
  $('#reject-modal').addEventListener('click', (e) => {
    if (e.target === $('#reject-modal')) {
      $('#reject-modal').classList.add('hidden');
      currentRejectId = null;
    }
  });

  // âââ Activity Feed âââ
  function renderActivity() {
    const feed = $('#recent-activity');
    const recent = queue.slice(0, 8);
    if (!recent.length) {
      feed.innerHTML =
        '<p class="empty-state">No videos generated yet. Create your first one above!</p>';
      return;
    }
    feed.innerHTML = recent
      .map(
        (item) => `
      <div class="activity-item">
        <strong>${item.typeName}</strong> v${item.version} â ${item.productName}
        <span style="color:var(--${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : item.status === 'revision' ? 'revision' : 'warning'})">[${item.status}]</span>
        ${item.revisionCount > 0 ? `<span style="color:var(--revision)">ð ${item.revisionCount}</span>` : ''}
        <div class="activity-time">${formatDate(item.createdAt)}</div>
      </div>
    `
      )
      .join('');
  }

  // âââ Badge âââ
  function updateBadge() {
    const pending = queue.filter(
      (q) => q.status === 'pending' || q.status === 'revision'
    ).length;
    const badge = $('#queue-badge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
  }

  // âââ Scheduled Posts (Metricool) âââ
  function renderScheduledPosts() {
    const statusEl = $('#metricool-status');
    const listEl = $('#scheduled-list');

    if (apiKeys.metricool) {
      statusEl.innerHTML =
        '<span class="status-dot connected"></span><span>Metricool: Connected</span>';

      // TODO: Replace with real Metricool API call
      // GET https://app.metricool.com/api/v1/posts/scheduled
      listEl.innerHTML =
        '<p class="empty-state">Metricool connected! Scheduled posts will appear here once the API integration is complete.</p>';
    } else {
      statusEl.innerHTML =
        '<span class="status-dot disconnected"></span><span>Metricool: Not connected</span><a href="#" class="link-settings" data-goto="settings">Add API key â</a>';
      listEl.innerHTML =
        '<p class="empty-state">Connect your Metricool API key in Settings to see scheduled posts.</p>';
    }
  }

  // âââ SOP Wiki âââ
  $$('.sop-link').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.sop-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      loadSop(link.dataset.sop);
    })
  );

  async function loadSop(name) {
    const el = $('#sop-content');
    try {
      const res = await fetch(`sops/${name}.md`);
      if (!res.ok) throw new Error('Not found');
      const md = await res.text();
      el.innerHTML = renderMarkdown(md);
    } catch {
      el.innerHTML = '<p class="empty-state">Could not load SOP.</p>';
    }
  }

  function renderMarkdown(md) {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^(.+)$/gm, (line) => {
        if (
          line.startsWith('<h') ||
          line.startsWith('<ul') ||
          line.startsWith('<li') ||
          line.startsWith('<p') ||
          line.startsWith('</p')
        )
          return line;
        return line;
      });
  }

  // Auto-load first SOP
  const firstSop = $('.sop-link.active');
  if (firstSop) loadSop(firstSop.dataset.sop);

  // âââ API Settings âââ
  // Load saved keys
  function loadApiKeys() {
    if (apiKeys.higgsfield) $('#api-higgsfield').value = apiKeys.higgsfield;
    if (apiKeys.metricool) $('#api-metricool').value = apiKeys.metricool;
    if (apiKeys.arcads) $('#api-arcads').value = apiKeys.arcads;
    if (apiKeys.creatify) $('#api-creatify').value = apiKeys.creatify;
  }

  // Toggle visibility
  $$('.btn-toggle-vis').forEach((btn) =>
    btn.addEventListener('click', () => {
      const input = $(`#${btn.dataset.target}`);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
      } else {
        input.type = 'password';
        btn.textContent = 'Show';
      }
    })
  );

  // Save keys
  $('#btn-save-keys').addEventListener('click', () => {
    apiKeys = {
      higgsfield: $('#api-higgsfield').value.trim(),
      metricool: $('#api-metricool').value.trim(),
      arcads: $('#api-arcads').value.trim(),
      creatify: $('#api-creatify').value.trim(),
    };
    localStorage.setItem(CONFIG.storageKeys.apiKeys, JSON.stringify(apiKeys));
    const msg = $('#save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
    renderScheduledPosts();
  });

  // âââ Helpers âââ
  function saveQueue() {
    localStorage.setItem(CONFIG.storageKeys.queue, JSON.stringify(queue));
  }

  function getActiveFilter() {
    const active = $('.filter-btn.active');
    return active ? active.dataset.filter : 'all';
  }

  function formatDate(str) {
    if (!str) return 'â';
    try {
      return new Date(str).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return str;
    }
  }

  // âââ API Integration Stubs âââ
  // These are ready to be wired up when API keys are provided.

  const API = {
    higgsfield: {
      async generateVideo(params) {
        // POST to Higgsfield API
        // params: { asset, avatar, prompt, notes }
        console.log('[Higgsfield] Generate video:', params);
        if (!apiKeys.higgsfield)
          return { ok: false, error: 'No API key set' };
        // TODO: Real API call
        // const res = await fetch('https://api.higgsfield.ai/v1/generate', {
        //   method: 'POST',
        //   headers: { 'Authorization': `Bearer ${apiKeys.higgsfield}`, 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ asset: CONFIG.higgsfield.asset, avatar: CONFIG.higgsfield.avatar, ...params })
        // });
        return { ok: true, videoId: 'sim_' + Date.now() };
      },

      async reviseVideo(videoId, notes) {
        console.log('[Higgsfield] Revise video:', videoId, notes);
        if (!apiKeys.higgsfield)
          return { ok: false, error: 'No API key set' };
        return { ok: true, videoId: videoId + '_rev' };
      },
    },

    metricool: {
      async getScheduledPosts() {
        console.log('[Metricool] Fetching scheduled posts');
        if (!apiKeys.metricool)
          return { ok: false, error: 'No API key set' };
        // TODO: Real API call
        // const res = await fetch('https://app.metricool.com/api/v1/posts/scheduled', {
        //   headers: { 'Authorization': `Bearer ${apiKeys.metricool}` }
        // });
        return { ok: true, posts: [] };
      },

      async schedulePost(params) {
        console.log('[Metricool] Schedule post:', params);
        if (!apiKeys.metricool)
          return { ok: false, error: 'No API key set' };
        return { ok: true, postId: 'mc_' + Date.now() };
      },
    },

    arcads: {
      async generateUGC(params) {
        console.log('[Arcads] Generate UGC video:', params);
        if (!apiKeys.arcads) return { ok: false, error: 'No API key set' };
        return { ok: true };
      },
    },

    creatify: {
      async generateProductVideo(params) {
        console.log('[Creatify] Generate product video:', params);
        if (!apiKeys.creatify)
          return { ok: false, error: 'No API key set' };
        return { ok: true };
      },
    },
  };

  // Expose API for console debugging
  window.MAJU_API = API;
  window.MAJU_CONFIG = CONFIG;

  // âââ Init âââ
  loadApiKeys();
  renderQueue();
  renderActivity();
  updateBadge();
  renderScheduledPosts();
})();
/* === MAJU AI Video Launchpad — App Logic === */
(function () {
  'use strict';

  // --- State ---
  const STATE_KEY = 'maju_queue';
  let queue = JSON.parse(localStorage.getItem(STATE_KEY) || '[]');

  // --- DOM refs ---
  const sidebar     = document.getElementById('sidebar');
  const menuToggle  = document.getElementById('menu-toggle');
  const pageTitle   = document.getElementById('page-title');
  const navBtns     = document.querySelectorAll('.nav-btn');
  const views       = document.querySelectorAll('.view');
  const queueBadge  = document.getElementById('queue-badge');
  const submitBtn   = document.getElementById('submit-video');
  const queueList   = document.getElementById('queue-list');
  const recentList  = document.getElementById('recent-activity');
  const filterBtns  = document.querySelectorAll('.filter-btn');
  const sopLinks    = document.querySelectorAll('.sop-link');
  const sopContent  = document.getElementById('sop-content');

  // --- Navigation ---
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      views.forEach(v => v.classList.toggle('active', v.id === 'view-' + target));
      pageTitle.textContent = btn.textContent.trim().replace(/\d+/, '').trim();
      if (window.innerWidth < 769) sidebar.classList.remove('open');
    });
  });
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  // --- Save / Load ---
  function persist() { localStorage.setItem(STATE_KEY, JSON.stringify(queue)); }

  // --- Badge ---
  function updateBadge() {
    const pending = queue.filter(i => i.status === 'pending').length;
    queueBadge.textContent = pending;
    queueBadge.style.display = pending ? 'inline-block' : 'none';
  }

  // --- Render Queue ---
  function renderQueue(filter) {
    if (!filter) filter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const items = filter === 'all' ? queue : queue.filter(i => i.status === filter);
    if (!items.length) {
      queueList.innerHTML = '<p class="empty-state">No items match this filter.</p>';
      return;
    }
    queueList.innerHTML = items.map((item, idx) => {
      const realIdx = queue.indexOf(item);
      const actions = item.status === 'pending'
        ? `<button class="btn btn-sm btn-approve" onclick="window.__approve(${realIdx})">Approve</button>
           <button class="btn btn-sm btn-reject" onclick="window.__reject(${realIdx})">Reject</button>`
        : `<span class="status-tag ${item.status}">${item.status}</span>`;
      return `<div class="queue-item ${item.status}">
        <div class="queue-info">
          <h4>${item.type} — ${item.product}</h4>
          <p>Avatar: ${item.avatar} · Versions: ${item.versions} · ${item.date || 'Unscheduled'}</p>
        </div>
        <div class="queue-actions">${actions}</div>
      </div>`;
    }).join('');
    updateBadge();
  }

  window.__approve = idx => { queue[idx].status = 'approved'; persist(); renderQueue(); renderRecent(); };
  window.__reject  = idx => { queue[idx].status = 'rejected'; persist(); renderQueue(); renderRecent(); };

  // --- Render Recent ---
  function renderRecent() {
    const recent = queue.slice(-5).reverse();
    if (!recent.length) {
      recentList.innerHTML = '<p class="empty-state">No videos generated yet. Create your first one above!</p>';
      return;
    }
    recentList.innerHTML = recent.map(i => `
      <div class="activity-item">
        <span>${i.type} — ${i.product}</span>
        <span class="status-tag ${i.status}">${i.status}</span>
      </div>`).join('');
  }

  // --- Filter Buttons ---
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderQueue(btn.dataset.filter);
    });
  });

  // --- Submit ---
  submitBtn.addEventListener('click', () => {
    const type    = document.getElementById('video-type').value;
    const versions = document.getElementById('versions').value;
    const avatar  = document.getElementById('avatar').value;
    const product = document.getElementById('product').value;
    const date    = document.getElementById('schedule-date').value;
    const notes   = document.getElementById('notes').value;
    if (!type || !avatar || !product) {
      alert('Please select a video type, avatar, and product.');
      return;
    }
    const label = document.querySelector('#video-type option[value="' + type + '"]').textContent;
    const prodLabel = document.querySelector('#product option[value="' + product + '"]').textContent;
    const avatarLabel = document.querySelector('#avatar option[value="' + avatar + '"]').textContent;
    for (let v = 0; v < parseInt(versions); v++) {
      queue.push({
        type: label,
        product: prodLabel,
        avatar: avatarLabel,
        versions: versions,
        date: date || null,
        notes: notes,
        status: 'pending',
        created: new Date().toISOString()
      });
    }
    persist();
    renderQueue();
    renderRecent();
    updateBadge();
    document.getElementById('video-type').value = '';
    document.getElementById('avatar').value = '';
    document.getElementById('product').value = '';
    document.getElementById('schedule-date').value = '';
    document.getElementById('notes').value = '';
  });

  // --- SOP Wiki ---
  const SOP_FILES = {
    'selfcare-snack-reel': 'sops/selfcare-snack-reel.md'
  };

  function renderMarkdown(md) {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\`(.+?)\`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>');
  }

  sopLinks.forEach(link => {
    link.addEventListener('click', () => {
      sopLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const key = link.dataset.sop;
      const file = SOP_FILES[key];
      if (!file) { sopContent.innerHTML = '<p class="empty-state">SOP not found.</p>'; return; }
      fetch(file)
        .then(r => { if (!r.ok) throw new Error('Not found'); return r.text(); })
        .then(md => { sopContent.innerHTML = renderMarkdown(md); })
        .catch(() => { sopContent.innerHTML = '<p class="empty-state">Could not load SOP. Make sure the file exists.</p>'; });
    });
  });

  // Auto-load first SOP
  if (sopLinks.length) sopLinks[0].click();

  // --- Init ---
  renderQueue();
  renderRecent();
  updateBadge();
})();
