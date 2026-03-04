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
