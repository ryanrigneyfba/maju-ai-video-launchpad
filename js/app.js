/* ═══════════════════════════════════════════
   MAJU AI Video Launchpad — v1.1
   Main application logic
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Config ───
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

  // ─── State ───
  let queue = JSON.parse(localStorage.getItem(CONFIG.storageKeys.queue) || '[]');
  let apiKeys = JSON.parse(localStorage.getItem(CONFIG.storageKeys.apiKeys) || '{}');
  let currentRejectId = null;
  let currentApproveId = null;
  let analyticsLoaded = false;

  // ─── Feedback Log (persisted for AI learning) ───
  const FEEDBACK_KEY = 'maju_feedback_log';
  let feedbackLog = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');

  function saveFeedback(entry) {
    feedbackLog.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackLog));
  }

  // ─── DOM Refs ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Navigation ───
  const viewMap = {
    dashboard: 'view-dashboard',
    approval: 'view-approval',
    scheduled: 'view-scheduled',
    analytics: 'view-analytics',
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
      analytics: 'Analytics',
      'sop-wiki': 'SOP Wiki',
      settings: 'API Settings',
    };
    $('#page-title').textContent = titles[name] || 'Dashboard';
    // Lazy-load analytics when navigating to that view
    if (name === 'analytics' && typeof loadAnalytics === 'function' && !analyticsLoaded) {
      loadAnalytics();
    }
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

  // ─── Posting Toggle ───
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

  // ─── Claude AI Learning Loop ───
  async function getClaudeOptimizedPrompt(videoType, avatar, product, userNotes) {
    if (!apiKeys.claude) return null;

    // Build context from feedback log
    const relevantFeedback = feedbackLog
      .filter((f) => f.videoType === videoType)
      .slice(-20); // last 20 entries for this format

    const approvals = relevantFeedback.filter((f) => f.action === 'approve');
    const rejections = relevantFeedback.filter((f) => f.action === 'reject');

    const systemPrompt = `You are a video production AI assistant for MAJU, a wellness brand. You generate optimized Higgsfield prompts for AI avatar videos.

Format: ${videoType}
Avatar: ${avatar} (Patient Maya / Bree Alba)
Product: ${product} (Maju's Black Seed Oil 8oz)

This is the "Anti-Puffy Face Snack" Selfcare Snack Reel — red onion + Maju Black Seed Oil + salt. Total duration: 15 seconds, 9:16 vertical.

The video has exactly 5 segments with specific Higgsfield prompts:

SEGMENT 1: HOOK (0-3s) — Stop the scroll
Default prompt: "Medium close-up of a woman in a dark kitchen holding a whole red onion near her face, looking at it curiously then at camera with a confident smile. A bottle of black seed oil sits on the wooden counter beside her. Warm golden lighting from window. She slowly raises the onion. 9:16 vertical, 3 seconds, smooth motion."
Text overlay: "de-puff your face snack" OR "wake up puffy? eat this"

SEGMENT 2: THE REVEAL — Ingredients + Pour (3-6s) — Product placement money shot
Default prompt: "Woman pouring black seed oil from a dark bottle onto a halved red onion on a wooden cutting board. Camera slightly wider, waist up. She looks down at the onion as she pours. The bottle label reading BLACK SEED OIL faces the camera. Warm kitchen lighting, dark moody background. Smooth satisfying pour motion. 9:16 vertical, 3 seconds."
Text overlay: "1 red onion\\n+ black seed oil\\n+ salt"

SEGMENT 3: THE DEMO — Eating the Snack (6-11s) — Viral hook, authentic reaction
Default prompt: "Tight close-up of woman biting into a raw red onion half glistening with oil. She takes a big bite, chews with a slight grimace then settles into it and nods. A bottle of black seed oil is visible on the counter behind her. Warm golden kitchen lighting. Authentic, unpolished reaction. 9:16 vertical, 5 seconds, natural motion."
Text overlay: NONE (let the visual do the work)

SEGMENT 4: RESULT + BENEFITS (11-13s) — Educate on benefits
Default prompt: "Woman holding a bitten red onion near her face, looking confidently at camera. She gently touches her cheek with her free hand. Black seed oil bottle visible on counter. Warm golden lighting. Calm, satisfied expression. 9:16 vertical, 2 seconds."
Text overlay: "drains facial bloat\\nreduces water retention\\ntightens puffy skin"

SEGMENT 5: THE GLOW — Result + CTA (13-15s) — Payoff beauty shot
Default prompt: "Woman looking at herself in a mirror, gently touching her glowing face with both hands. Dewy, healthy skin. She looks serene and satisfied. A bottle of black seed oil is prominently placed in the foreground near the mirror. Warm, soft lighting emphasizes skin glow. 9:16 vertical, 2 seconds, slow smooth motion."
Text overlay: "anti-puffy face snack\\n(onion + black seed oil + salt)" + CTA

CRITICAL RULES:
- Maju Black Seed Oil bottle MUST be visible in EVERY segment
- Bottle label readable in at least Reveal + Glow segments
- Kitchen: dark/moody (dark cabinets, warm wood), NOT bright/white
- Lighting: warm golden-hour (3200-4000K), soft, flattering
- Avatar: black tank top, hair in bun, minimal makeup, natural look
- Eating reaction must be AUTHENTIC — slight grimace then acceptance, NOT polished
- Movement: smooth, natural, never robotic

For A/B testing, vary: hook text, pacing (15-18s), CTA ("save for later" / "link in bio" / "shop now"), and audio style.

Return ONLY a JSON object with these fields:
- "segments": array of 5 objects, each with { "name": segment name, "prompt": optimized Higgsfield prompt, "duration": seconds, "textOverlay": text to show or null }
- "direction": overall visual/pacing/tone direction
- "reasoning": 1 sentence explaining what you optimized based on feedback
- "captions": array of 5 objects for each segment with { "text": "caption text", "startTime": seconds, "endTime": seconds }
- "hookVariant": which hook text variant this version uses

Example:
{"segments":[{"name":"hook","prompt":"Medium close-up of a woman...","duration":3,"textOverlay":"de-puff your face snack"},{"name":"reveal","prompt":"Woman pouring...","duration":3,"textOverlay":"1 red onion\\n+ black seed oil\\n+ salt"},{"name":"demo","prompt":"Tight close-up...","duration":5,"textOverlay":null},{"name":"result","prompt":"Woman holding...","duration":2,"textOverlay":"drains facial bloat\\nreduces water retention\\ntightens puffy skin"},{"name":"glow","prompt":"Woman looking...","duration":2,"textOverlay":"anti-puffy face snack"}],"direction":"Warm, moody kitchen. Authentic reactions.","reasoning":"Used default SOP prompts.","captions":[{"text":"de-puff your face snack","startTime":0,"endTime":3},{"text":"1 red onion + black seed oil + salt","startTime":3,"endTime":6},{"text":"","startTime":6,"endTime":11},{"text":"drains facial bloat, reduces water retention, tightens puffy skin","startTime":11,"endTime":13},{"text":"anti-puffy face snack","startTime":13,"endTime":15}],"hookVariant":"de-puff your face snack"}`;

    const feedbackContext = relevantFeedback.length
      ? `\n\nPast feedback for this format (${relevantFeedback.length} entries):
APPROVED videos — what worked:\n${approvals.map((f) => `- "${f.notes}"`).join('\n') || '(none yet)'}
REJECTED videos — what to avoid:\n${rejections.map((f) => `- "${f.notes}"`).join('\n') || '(none yet)'}`
      : '\n\nNo past feedback yet — use best practices for short-form social video.';

    try {
      const res = await fetch(backendUrl('/api/proxy/claude/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.claude },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Generate an optimized video brief.${feedbackContext}\n\nUser notes for this batch: "${userNotes || 'No specific notes'}"`,
          }],
        }),
      });
      const data = await res.json();
      if (data.content && data.content[0]) {
        const text = data.content[0].text;
        // Try to parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return { script: text, direction: '', reasoning: 'Raw response' };
      }
      return null;
    } catch (err) {
      console.error('[Claude] Error:', err);
      return null;
    }
  }

  // ─── Generate Video ───
  $('#submit-video').addEventListener('click', async () => {
    const type = $('#video-type').value;
    const versions = parseInt($('#versions').value);
    const avatar = $('#avatar').value;
    const avatarName = $('#avatar').selectedOptions[0].textContent;
    const product = $('#product').value;
    const productName = $('#product').selectedOptions[0].textContent;
    const postMode = $('input[name="postMode"]:checked').value;
    const schedDate = $('#schedule-date')?.value || '';
    const notes = $('#notes').value.trim();

    // If Claude key is set, get AI-optimized prompt first
    let aiPrompt = null;
    if (apiKeys.claude) {
      const btn = $('#submit-video');
      btn.disabled = true;
      btn.textContent = '🧠 Claude is optimizing your prompt…';
      aiPrompt = await getClaudeOptimizedPrompt(type, avatar, product, notes);
      btn.disabled = false;
      btn.textContent = '🚀 Generate & Send to Queue';
    }

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
        aiPrompt, // Claude-optimized prompt (null if no key)
        version: i + 1,
        totalVersions: versions,
        status: 'pending',
        revisionCount: 0,
        revisionNotes: [],
        createdAt: new Date().toISOString(),
        pipelineStage: 'generate', // generate → stitch → queue → post
      };
      queue.unshift(item);
    }

    saveQueue();
    renderQueue();
    renderActivity();
    updateBadge();
    showPipeline();

    // Scroll pipeline into view so user sees it
    $('#pipeline-card').scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Flash the approval badge to draw attention
    const badge = $('#queue-badge');
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 2000);

    // Reset form
    $('#notes').value = '';
  });

  // ─── Pipeline Visualization ───
  function showPipeline() {
    const card = $('#pipeline-card');
    card.classList.remove('hidden');
    const steps = $$('.pipeline-step');
    const msg = $('#pipeline-msg');

    // Reset steps
    steps.forEach((s) => s.classList.remove('active', 'done'));

    function setStage(idx, text) {
      if (idx > 0) steps[idx - 1].classList.replace('active', 'done');
      if (idx < steps.length) steps[idx].classList.add('active');
      msg.textContent = text;
    }

    // If no Higgsfield key, simulate the whole pipeline
    console.log('[Pipeline] apiKeys.higgsfield =', apiKeys.higgsfield ? '(set)' : '(empty)', '| All keys:', Object.keys(apiKeys).filter(k => apiKeys[k]));
    if (!apiKeys.higgsfield) {
      let stage = 0;
      const sim = [
        '⚠️ Higgsfield API key not set — video generation simulated. Add key in Settings.',
        'FFmpeg stitch simulated (no backend connected).',
        '✓ Pipeline complete — videos in queue (simulated).',
      ];
      function advanceSim() {
        setStage(stage, sim[stage]);
        stage++;
        if (stage < sim.length) setTimeout(advanceSim, 1800);
      }
      advanceSim();
      return;
    }

    // Real pipeline: Generate → Stitch → Queue
    runRealPipeline(steps, msg, setStage);
  }

  // SOP v2.0 default Higgsfield prompts for each segment
  const DEFAULT_SEGMENT_PROMPTS = [
    { name: 'hook', duration: 3, prompt: 'Medium close-up of a woman in a dark kitchen holding a whole red onion near her face, looking at it curiously then at camera with a confident smile. A bottle of black seed oil sits on the wooden counter beside her. Warm golden lighting from window. She slowly raises the onion. 9:16 vertical, 3 seconds, smooth motion.', textOverlay: 'de-puff your face snack' },
    { name: 'reveal', duration: 3, prompt: 'Woman pouring black seed oil from a dark bottle onto a halved red onion on a wooden cutting board. Camera slightly wider, waist up. She looks down at the onion as she pours. The bottle label reading BLACK SEED OIL faces the camera. Warm kitchen lighting, dark moody background. Smooth satisfying pour motion. 9:16 vertical, 3 seconds.', textOverlay: '1 red onion\n+ black seed oil\n+ salt' },
    { name: 'demo', duration: 5, prompt: 'Tight close-up of woman biting into a raw red onion half glistening with oil. She takes a big bite, chews with a slight grimace then settles into it and nods. A bottle of black seed oil is visible on the counter behind her. Warm golden kitchen lighting. Authentic, unpolished reaction. 9:16 vertical, 5 seconds, natural motion.', textOverlay: null },
    { name: 'result', duration: 2, prompt: 'Woman holding a bitten red onion near her face, looking confidently at camera. She gently touches her cheek with her free hand. Black seed oil bottle visible on counter. Warm golden lighting. Calm, satisfied expression. 9:16 vertical, 2 seconds.', textOverlay: 'drains facial bloat\nreduces water retention\ntightens puffy skin' },
    { name: 'glow', duration: 2, prompt: 'Woman looking at herself in a mirror, gently touching her glowing face with both hands. Dewy, healthy skin. She looks serene and satisfied. A bottle of black seed oil is prominently placed in the foreground near the mirror. Warm, soft lighting emphasizes skin glow. 9:16 vertical, 2 seconds, slow smooth motion.', textOverlay: 'anti-puffy face snack\n(onion + black seed oil + salt)' },
  ];

  async function runRealPipeline(steps, msg, setStage) {
    // Stage 0: Generate each segment via Higgsfield
    setStage(0, 'Generating video segments via Higgsfield…');

    const newItems = queue.filter(q => q.pipelineStage === 'generate');
    const allSegmentVideos = []; // { url, label } for stitching

    for (const item of newItems) {
      // Get segment prompts from Claude AI output or use SOP defaults
      const segments = (item.aiPrompt && item.aiPrompt.segments) || DEFAULT_SEGMENT_PROMPTS;
      const segmentResults = [];

      for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        const segLabel = `${seg.name} (${si + 1}/${segments.length})`;
        msg.textContent = `v${item.version}: Generating ${segLabel}… [Kling 3.0]`;

        const result = await API.higgsfield.generateVideo({
          prompt: seg.prompt,
          duration: seg.duration || 5,
        });

        if (result.ok && result.id) {
          // Poll for this segment's completion
          let done = false;
          let attempts = 0;
          while (!done && attempts < 120) {
            await new Promise(r => setTimeout(r, 3000));
            attempts++;
            const status = await API.higgsfield.getStatus(result.id);
            if (status.status === 'completed' || status.status === 'done') {
              done = true;
              const videoUrl = status.video_url || status.url || status.output_url;
              if (videoUrl) {
                segmentResults.push({ url: videoUrl, label: seg.name, textOverlay: seg.textOverlay });
                msg.textContent = `v${item.version}: ${segLabel} rendered!`;
              }
            } else if (status.status === 'failed' || status.status === 'error') {
              done = true;
              msg.textContent = `⚠️ v${item.version}: ${segLabel} failed to render.`;
            } else {
              msg.textContent = `v${item.version}: Rendering ${segLabel}… (${status.status || 'processing'})`;
            }
          }
        } else {
          msg.textContent = `⚠️ v${item.version}: ${segLabel} error: ${result.error || JSON.stringify(result.detail || 'Unknown')}`;
        }
      }

      // Store segment results on the item
      item.segmentVideos = segmentResults;
      if (segmentResults.length > 0) {
        item.videoUrl = segmentResults[0].url; // preview = first segment
        item.pipelineStage = 'stitch';
        allSegmentVideos.push(...segmentResults.map(s => ({ url: s.url, label: `${item.typeName} - ${s.label}` })));
      } else {
        item.pipelineStage = 'queue';
        msg.textContent = `⚠️ v${item.version}: No segments rendered successfully.`;
      }
      saveQueue();
    }

    const completedVideos = allSegmentVideos;

    // Stage 1: Auto-stitch via FFmpeg with captions
    if (completedVideos.length > 0 && (apiKeys.backendUrl || DEFAULT_BACKEND)) {
      setStage(1, `FFmpeg auto-stitching ${completedVideos.length} clips with captions…`);

      // Get captions from the AI brief if available
      const stitchOptions = {};
      const firstItem = newItems[0];
      if (firstItem && firstItem.aiPrompt && firstItem.aiPrompt.captions) {
        stitchOptions.captions = firstItem.aiPrompt.captions;
      }

      try {
        const stitchResult = await API.backend.autoStitch(completedVideos, stitchOptions);
        if (stitchResult.jobId) {
          // Poll stitch job
          let stitchDone = false;
          while (!stitchDone) {
            await new Promise(r => setTimeout(r, 1500));
            const st = await API.backend.jobStatus(stitchResult.jobId);
            msg.textContent = `Stitching… ${st.progress || 0}%`;

            if (st.status === 'done') {
              stitchDone = true;
              const dlUrl = API.backend.downloadUrl(stitchResult.jobId);
              // Store stitch result on the first queue item
              newItems[0].stitchJobId = stitchResult.jobId;
              newItems[0].stitchedVideoUrl = dlUrl;
              msg.textContent = 'Stitch complete!';
            } else if (st.status === 'error') {
              stitchDone = true;
              msg.textContent = `⚠️ Stitch error: ${st.error}`;
            }
          }
        }
      } catch (err) {
        msg.textContent = `⚠️ Stitch error: ${err.message}`;
      }
    } else if (completedVideos.length > 0) {
      setStage(1, 'Stitch skipped — no backend URL set. Individual videos available.');
    } else {
      setStage(1, 'Stitch skipped — no completed videos.');
    }

    // Stage 2: Queue
    newItems.forEach(item => { item.pipelineStage = 'queue'; });
    saveQueue();
    renderQueue();
    updateBadge();
    setStage(2, '✓ Pipeline complete — videos in approval queue.');
  }

  // ─── Queue Rendering ───
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
        ${item.videoUrl ? `<div class="queue-video"><video src="${item.videoUrl}" controls preload="metadata" playsinline></video></div>` : item.stitchedVideoUrl ? `<div class="queue-video"><video src="${item.stitchedVideoUrl}" controls preload="metadata" playsinline></video></div>` : '<div class="queue-video queue-video-placeholder"><span>Video generating…</span></div>'}
        <div class="queue-info">
          <h4>${item.typeName} — v${item.version}/${item.totalVersions}</h4>
          <p>${item.productName} · ${item.avatarName}</p>
          ${item.postMode === 'asap' ? '<p>📌 Post ASAP</p>' : `<p>📅 ${formatDate(item.schedDate)}</p>`}
          ${item.notes ? `<p>"${item.notes}"</p>` : ''}
          ${item.aiPrompt ? `<div class="ai-prompt"><strong>AI Brief:</strong> ${item.aiPrompt.reasoning || ''}<br><em>${(item.aiPrompt.direction || '').substring(0, 120)}</em></div>` : ''}
          <div class="queue-meta">
            Status: <strong>${item.status.toUpperCase()}</strong> ·
            Created: ${formatDate(item.createdAt)}
            ${(item.revisionCount || 0) > 0 ? `<div class="revision-count">🔄 Revision ${item.revisionCount}</div>` : ''}
          </div>
          ${(item.revisionNotes || []).length ? (item.revisionNotes || []).map((n, i) => `<div class="rejection-notes">Rev ${i + 1}: ${n}</div>`).join('') : ''}
          ${(item.approvalNotes || []).length ? (item.approvalNotes || []).map((n) => `<div class="approval-notes">Approved: ${n}</div>`).join('') : ''}
        </div>
        <div class="queue-actions">
          ${item.status === 'pending' || item.status === 'revision'
            ? `<button class="btn-approve" data-action="approve" data-id="${item.id}">✓ Approve</button>
               <button class="btn-reject" data-action="reject" data-id="${item.id}">✗ Reject</button>`
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
      currentApproveId = id;
      $('#approve-modal').classList.remove('hidden');
      $('#approve-notes').value = '';
      $('#approve-notes').focus();
    }

    if (action === 'reject') {
      currentRejectId = id;
      $('#reject-modal').classList.remove('hidden');
      $('#reject-notes').value = '';
      $('#reject-notes').focus();
    }
  });

  // ─── Approval Modal ───
  $('#btn-cancel-approve').addEventListener('click', () => {
    $('#approve-modal').classList.add('hidden');
    currentApproveId = null;
  });

  $('#btn-confirm-approve').addEventListener('click', () => {
    const notes = $('#approve-notes').value.trim();
    if (!notes) {
      $('#approve-notes').style.borderColor = 'var(--danger)';
      return;
    }

    const item = queue.find((q) => q.id === currentApproveId);
    if (item) {
      item.status = 'approved';
      item.pipelineStage = 'post';
      if (!item.approvalNotes) item.approvalNotes = [];
      item.approvalNotes.push(notes);

      // Save to feedback log for AI learning
      saveFeedback({
        action: 'approve',
        videoType: item.type,
        avatar: item.avatar,
        product: item.product,
        version: item.version,
        revisionCount: item.revisionCount || 0,
        notes,
        allRevisionNotes: item.revisionNotes || [],
      });

      saveQueue();
      renderQueue(getActiveFilter());
      renderActivity();
      updateBadge();

      // Schedule via Metricool if key is set
      scheduleApprovedItem(item);
    }

    $('#approve-modal').classList.add('hidden');
    currentApproveId = null;
  });

  $('#approve-modal').addEventListener('click', (e) => {
    if (e.target === $('#approve-modal')) {
      $('#approve-modal').classList.add('hidden');
      currentApproveId = null;
    }
  });

  // ─── Rejection Modal ───
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
      item.revisionCount = (item.revisionCount || 0) + 1;
      if (!item.revisionNotes) item.revisionNotes = [];
      item.revisionNotes.push(notes);
      item.pipelineStage = 'generate'; // back to Higgsfield for revision

      // Save to feedback log for AI learning
      saveFeedback({
        action: 'reject',
        videoType: item.type,
        avatar: item.avatar,
        product: item.product,
        version: item.version,
        revisionCount: item.revisionCount,
        notes,
        allRevisionNotes: item.revisionNotes,
      });

      saveQueue();
      renderQueue(getActiveFilter());
      renderActivity();
      updateBadge();

      // If higgsfield key exists, send revision request
      if (apiKeys.higgsfield) {
        API.higgsfield.reviseVideo(item.id, notes);
      }
    }

    $('#reject-modal').classList.add('hidden');
    currentRejectId = null;
  });

  // Close modals on overlay click
  $('#reject-modal').addEventListener('click', (e) => {
    if (e.target === $('#reject-modal')) {
      $('#reject-modal').classList.add('hidden');
      currentRejectId = null;
    }
  });

  // ─── Activity Feed ───
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
        <strong>${item.typeName}</strong> v${item.version} — ${item.productName}
        <span style="color:var(--${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : item.status === 'revision' ? 'revision' : 'warning'})">[${item.status}]</span>
        ${item.revisionCount > 0 ? `<span style="color:var(--revision)">🔄 ${item.revisionCount}</span>` : ''}
        <div class="activity-time">${formatDate(item.createdAt)}</div>
      </div>
    `
      )
      .join('');
  }

  // ─── Badge ───
  function updateBadge() {
    const pending = queue.filter(
      (q) => q.status === 'pending' || q.status === 'revision'
    ).length;
    const badge = $('#queue-badge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
  }

  // ─── Scheduled Posts (Metricool) ───
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
        '<span class="status-dot disconnected"></span><span>Metricool: Not connected</span><a href="#" class="link-settings" data-goto="settings">Add API key →</a>';
      listEl.innerHTML =
        '<p class="empty-state">Connect your Metricool API key in Settings to see scheduled posts.</p>';
    }
  }

  // ─── SOP Wiki ───
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

  // ─── API Settings ───
  // Load saved keys into form fields
  function loadApiKeys() {
    if (apiKeys.backendUrl) $('#api-backend-url').value = apiKeys.backendUrl;
    if (apiKeys.claude) $('#api-claude').value = apiKeys.claude;
    if (apiKeys.higgsfield) $('#api-higgsfield').value = apiKeys.higgsfield;
    if (apiKeys.metricool) $('#api-metricool').value = apiKeys.metricool;
    if (apiKeys.arcads) $('#api-arcads').value = apiKeys.arcads;
    if (apiKeys.creatify) $('#api-creatify').value = apiKeys.creatify;
  }

  // Sync keys from backend on load (so keys work on any device)
  async function syncKeysFromBackend() {
    try {
      const res = await fetch(backendUrl('/api/config'));
      if (res.ok) {
        const remote = await res.json();
        if (remote && Object.keys(remote).length) {
          // Merge: remote keys fill in anything missing locally
          apiKeys = { ...remote, ...apiKeys };
          // If local was empty, remote wins completely
          if (!localStorage.getItem(CONFIG.storageKeys.apiKeys)) {
            apiKeys = remote;
          }
          localStorage.setItem(CONFIG.storageKeys.apiKeys, JSON.stringify(apiKeys));
          loadApiKeys();
          console.log('[Config] Synced keys from backend');
        }
      }
    } catch { /* backend not reachable, use localStorage */ }
  }

  // Push keys to backend so they persist across devices
  async function pushKeysToBackend() {
    try {
      await fetch(backendUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKeys),
      });
      console.log('[Config] Keys saved to backend');
    } catch { /* silent fail — localStorage still works */ }
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

  // Save keys (local + backend)
  $('#btn-save-keys').addEventListener('click', () => {
    apiKeys = {
      backendUrl: $('#api-backend-url').value.trim(),
      claude: $('#api-claude').value.trim(),
      higgsfield: $('#api-higgsfield').value.trim(),
      metricool: $('#api-metricool').value.trim(),
      arcads: $('#api-arcads').value.trim(),
      creatify: $('#api-creatify').value.trim(),
    };
    localStorage.setItem(CONFIG.storageKeys.apiKeys, JSON.stringify(apiKeys));
    pushKeysToBackend();
    const msg = $('#save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
    renderScheduledPosts();
    checkBackendStatus();
  });

  // ─── Helpers ───
  function saveQueue() {
    localStorage.setItem(CONFIG.storageKeys.queue, JSON.stringify(queue));
  }

  function getActiveFilter() {
    const active = $('.filter-btn.active');
    return active ? active.dataset.filter : 'all';
  }

  function formatDate(str) {
    if (!str) return '—';
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

  // ─── API Integrations (Live) ───

  let DEFAULT_BACKEND = '';

  // Auto-load backend URL from backend-url.json (written by CI deploy)
  fetch('backend-url.json').then(r => r.ok ? r.json() : null).then(cfg => {
    if (cfg && cfg.url) {
      DEFAULT_BACKEND = cfg.url.replace(/\/+$/, '');
      checkBackendStatus();
    }
  }).catch(() => {});

  function backendUrl(path) {
    const base = (apiKeys.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, '');
    return base + path;
  }

  // All API calls route through the backend proxy to avoid CORS issues.

  const API = {
    // ── Higgsfield — AI avatar video generation (via proxy) ──
    // API: https://platform.higgsfield.ai
    // Auth: Key KEY_ID:KEY_SECRET
    higgsfield: {
      async generateVideo(params) {
        console.log('[Higgsfield] Generate video:', params);
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set — add in Settings' };
        // Higgsfield subscribe API — Kling 3.0 Pro text-to-video
        const body = {
          endpoint: 'kling-v3.0-pro-text-to-video',
          input: {
            prompt: params.prompt || '',
            aspect_ratio: '9:16',
            duration: params.duration || 5,
          },
        };
        // If image provided, use Kling image-to-video instead
        if (params.image_url) {
          body.endpoint = 'kling-v3.0-pro-image-to-video';
          body.input.image_url = params.image_url;
        }
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          console.log('[Higgsfield] Generate response:', data);
          // Returns { request_id, jobs: [...] }
          return { ok: res.ok, id: data.request_id || data.id, ...data };
        } catch (err) {
          console.error('[Higgsfield] Error:', err);
          return { ok: false, error: err.message };
        }
      },

      async generateImage(params) {
        console.log('[Higgsfield] Generate image (Nano Banana Pro):', params);
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set — add in Settings' };
        const body = {
          endpoint: 'nano-banana-pro',
          input: {
            prompt: params.prompt || '',
            aspect_ratio: params.aspect_ratio || '9:16',
            resolution: params.resolution || '2k',
          },
        };
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          console.log('[Higgsfield] Image response:', data);
          return { ok: res.ok, id: data.request_id || data.id, ...data };
        } catch (err) {
          console.error('[Higgsfield] Image error:', err);
          return { ok: false, error: err.message };
        }
      },

      async reviseVideo(videoId, notes) {
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set' };
        const body = {
          endpoint: 'kling-v3.0-pro-text-to-video',
          input: {
            prompt: `Revision — feedback: ${notes}`,
            aspect_ratio: '9:16',
            duration: 5,
          },
        };
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/revise'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          return { ok: res.ok, id: data.request_id || data.id, ...data };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },

      async getStatus(requestId) {
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/higgsfield/status/${encodeURIComponent(requestId)}`), {
            headers: { 'x-api-key-value': apiKeys.higgsfield },
          });
          const data = await res.json();
          // Higgsfield status: queued, in_progress, completed, failed, nsfw
          // Normalize for pipeline
          const job = (data.jobs && data.jobs[0]) || {};
          const videoUrl = (job.results && (job.results.raw?.url || job.results.min?.url)) || data.video_url || data.url;
          return {
            ok: res.ok,
            status: data.status,
            video_url: videoUrl,
            progress: data.progress,
            ...data,
          };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
    },

    // ── Metricool — Social scheduling & analytics (via proxy) ──
    metricool: {
      async getScheduledPosts() {
        console.log('[Metricool] Fetching scheduled posts');
        if (!apiKeys.metricool) return { ok: false, error: 'No API key set' };
        try {
          const now = new Date();
          const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const params = new URLSearchParams({
            init_date: now.toISOString().split('T')[0],
            end_date: future.toISOString().split('T')[0],
          });
          const res = await fetch(backendUrl(`/api/proxy/metricool/posts?${params}`), {
            headers: { 'x-api-key-value': apiKeys.metricool },
          });
          const data = await res.json();
          return { ok: res.ok, posts: data.posts || data || [] };
        } catch (err) {
          console.error('[Metricool] Error:', err);
          return { ok: false, error: err.message, posts: [] };
        }
      },

      async schedulePost(params) {
        console.log('[Metricool] Schedule post:', params);
        if (!apiKeys.metricool) return { ok: false, error: 'No API key set' };
        try {
          const res = await fetch(backendUrl('/api/proxy/metricool/posts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.metricool },
            body: JSON.stringify(params),
          });
          const data = await res.json();
          return { ok: res.ok, ...data };
        } catch (err) {
          console.error('[Metricool] Error:', err);
          return { ok: false, error: err.message };
        }
      },
    },

    // ── Arcads — UGC-style ad video generation (via proxy) ──
    arcads: {
      async generateUGC(params) {
        console.log('[Arcads] Generate UGC video:', params);
        if (!apiKeys.arcads) return { ok: false, error: 'No API key set' };
        try {
          const res = await fetch(backendUrl('/api/proxy/arcads/videos'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.arcads },
            body: JSON.stringify(params),
          });
          const data = await res.json();
          return { ok: res.ok, ...data };
        } catch (err) {
          console.error('[Arcads] Error:', err);
          return { ok: false, error: err.message };
        }
      },

      async getStatus(videoId) {
        if (!apiKeys.arcads) return { ok: false, error: 'No API key set' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/arcads/videos/${encodeURIComponent(videoId)}`), {
            headers: { 'x-api-key-value': apiKeys.arcads },
          });
          const data = await res.json();
          return { ok: res.ok, ...data };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
    },

    // ── Creatify — AI product video generation (via proxy) ──
    creatify: {
      _creatifyHeaders() {
        const [apiId, apiKey] = (apiKeys.creatify || '').includes(':')
          ? apiKeys.creatify.split(':')
          : [apiKeys.creatify || '', ''];
        return { 'x-creatify-id': apiId, 'x-creatify-key': apiKey || apiId, 'Content-Type': 'application/json' };
      },

      async generatePreview(params) {
        console.log('[Creatify] Generate preview:', params);
        if (!apiKeys.creatify) return { ok: false, error: 'No API key set' };
        try {
          const res = await fetch(backendUrl('/api/proxy/creatify/gen-image'), {
            method: 'POST',
            headers: this._creatifyHeaders(),
            body: JSON.stringify({
              product_url: params.productUrl,
              aspect_ratio: params.aspectRatio || '9x16',
              image_prompt: params.imagePrompt || '',
            }),
          });
          const data = await res.json();
          return { ok: res.ok, ...data };
        } catch (err) {
          console.error('[Creatify] Error:', err);
          return { ok: false, error: err.message };
        }
      },

      async generateVideo(taskId, params = {}) {
        if (!apiKeys.creatify) return { ok: false, error: 'No API key set' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/creatify/${encodeURIComponent(taskId)}/gen-video`), {
            method: 'POST',
            headers: this._creatifyHeaders(),
            body: JSON.stringify({ video_prompt: params.videoPrompt || '' }),
          });
          const data = await res.json();
          return { ok: res.ok, ...data };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },

      async getStatus(taskId) {
        if (!apiKeys.creatify) return { ok: false, error: 'No API key set' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/creatify/${encodeURIComponent(taskId)}/status`), {
            headers: this._creatifyHeaders(),
          });
          const data = await res.json();
          return { ok: res.ok, ...data };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
    },

    // ── Backend — FFmpeg stitching server ──
    backend: {
      async health() {
        try {
          const res = await fetch(backendUrl('/api/health'));
          return await res.json();
        } catch {
          return { status: 'unreachable', ffmpeg: false };
        }
      },

      async uploadAndStitch(files, options = {}) {
        const formData = new FormData();
        files.forEach((f) => formData.append('clips', f));
        if (Object.keys(options).length) {
          formData.append('options', JSON.stringify(options));
        }
        const res = await fetch(backendUrl('/api/pipeline'), {
          method: 'POST',
          body: formData,
        });
        return await res.json();
      },

      async jobStatus(jobId) {
        const res = await fetch(backendUrl(`/api/jobs/${jobId}`));
        return await res.json();
      },

      downloadUrl(jobId) {
        return backendUrl(`/api/download/${jobId}`);
      },

      async autoStitch(clips, options = {}) {
        const res = await fetch(backendUrl('/api/auto-stitch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clips, options }),
        });
        return await res.json();
      },
    },
  };

  // Expose API for console debugging
  window.MAJU_API = API;
  window.MAJU_CONFIG = CONFIG;

  // ─── Backend Status Check ───
  async function checkBackendStatus(retries = 3) {
    const el = $('#backend-status');
    el.innerHTML = '<span class="status-dot connecting"></span><span>Backend: Connecting…</span>';

    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(backendUrl('/api/health'), { signal: controller.signal });
        clearTimeout(timeout);
        const status = await res.json();
        if (status.status === 'ok') {
          el.innerHTML = `<span class="status-dot connected"></span><span>Backend: Connected${status.ffmpeg ? ' (FFmpeg ready)' : ' (FFmpeg not found!)'}</span>`;
          return;
        }
      } catch {
        // Backend may be cold-starting, retry
        if (i < retries - 1) {
          el.innerHTML = `<span class="status-dot connecting"></span><span>Backend: Waking up… (attempt ${i + 2}/${retries})</span>`;
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
    el.innerHTML = '<span class="status-dot disconnected"></span><span>Backend: Not connected — set your backend URL in <a href="#" data-goto="settings">Settings</a></span>';
  }

  // ─── Auto-Stitch Segment Status Updates ───
  // Called by the pipeline to update segment status in the stitch panel
  function updateSegmentStatus(segment, statusText, isReady) {
    const el = $(`#seg-${segment}`);
    if (el) {
      el.textContent = statusText;
      if (isReady) el.classList.add('ready');
    }
  }
  window.updateSegmentStatus = updateSegmentStatus;

  // ─── Live Metricool Scheduled Posts ───
  async function fetchScheduledPosts() {
    const statusEl = $('#metricool-status');
    const listEl = $('#scheduled-list');

    if (!apiKeys.metricool) return;

    statusEl.innerHTML = '<span class="status-dot connected"></span><span>Metricool: Fetching…</span>';

    const result = await API.metricool.getScheduledPosts();
    if (result.ok && result.posts && result.posts.length) {
      statusEl.innerHTML = '<span class="status-dot connected"></span><span>Metricool: Connected</span>';
      listEl.innerHTML = result.posts.map((post) => `
        <div class="scheduled-item">
          <div>
            <div class="sch-title">${post.content || post.text || 'Scheduled Post'}</div>
            <div class="sch-meta">${post.publicationDate || post.date || ''}</div>
          </div>
          <span class="sch-platform">${post.network || post.platform || 'Social'}</span>
        </div>
      `).join('');
    } else if (result.ok) {
      statusEl.innerHTML = '<span class="status-dot connected"></span><span>Metricool: Connected</span>';
      listEl.innerHTML = '<p class="empty-state">No scheduled posts in the next 30 days.</p>';
    } else {
      statusEl.innerHTML = `<span class="status-dot disconnected"></span><span>Metricool: Error — ${result.error}</span>`;
    }
  }

  // ─── Analytics View ───

  async function loadAnalytics() {
    if (!apiKeys.metricool) {
      $('#analytics-status').innerHTML =
        '<span class="status-dot disconnected"></span><span>Metricool: Not connected</span><a href="#" class="link-settings" data-goto="settings">Add API key →</a>';
      return;
    }

    $('#analytics-status').innerHTML =
      '<span class="status-dot connected"></span><span>Metricool: Loading analytics…</span>';

    // Fetch accounts/networks, analytics, and top posts in parallel
    const [networksRes, topPostsRes] = await Promise.all([
      fetchAnalyticsNetworks(),
      fetchAnalyticsTopPosts(),
    ]);

    // Show accounts
    if (networksRes.ok) {
      const accounts = networksRes.accounts || networksRes.networks || networksRes || [];
      renderAccountCards(Array.isArray(accounts) ? accounts : [accounts]);
    }

    // Show top posts
    if (topPostsRes.ok) {
      const posts = topPostsRes.posts || topPostsRes || [];
      renderTopPosts(Array.isArray(posts) ? posts : []);
    }

    // Summary stats from queue data
    renderAnalyticsSummary();

    $('#analytics-status').innerHTML =
      '<span class="status-dot connected"></span><span>Metricool: Connected</span>';
    analyticsLoaded = true;
  }

  async function fetchAnalyticsNetworks() {
    try {
      const res = await fetch(backendUrl('/api/proxy/metricool/networks'), {
        headers: { 'x-api-key-value': apiKeys.metricool },
      });
      const data = await res.json();
      return { ok: res.ok, ...data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function fetchAnalyticsTopPosts() {
    try {
      const now = new Date();
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        init_date: past.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        order_by: 'interactions',
        limit: '10',
      });
      const res = await fetch(backendUrl(`/api/proxy/metricool/top-posts?${params}`), {
        headers: { 'x-api-key-value': apiKeys.metricool },
      });
      const data = await res.json();
      return { ok: res.ok, ...data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function renderAccountCards(accounts) {
    const grid = $('#accounts-grid');
    const section = $('#analytics-accounts');

    if (!accounts.length) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = accounts.map((acct) => `
      <div class="account-card">
        <span class="acct-platform">${acct.network || acct.platform || acct.type || 'Social'}</span>
        <div class="acct-name">${acct.name || acct.username || acct.handle || 'Account'}</div>
        <div class="acct-stats">
          ${acct.followers != null ? `<div class="acct-stat"><span class="stat-label">Followers</span><span class="stat-value">${formatNum(acct.followers)}</span></div>` : ''}
          ${acct.following != null ? `<div class="acct-stat"><span class="stat-label">Following</span><span class="stat-value">${formatNum(acct.following)}</span></div>` : ''}
          ${acct.posts != null ? `<div class="acct-stat"><span class="stat-label">Posts</span><span class="stat-value">${formatNum(acct.posts)}</span></div>` : ''}
          ${acct.engagement != null ? `<div class="acct-stat"><span class="stat-label">Engagement</span><span class="stat-value">${acct.engagement}%</span></div>` : ''}
          ${acct.reach != null ? `<div class="acct-stat"><span class="stat-label">Reach</span><span class="stat-value">${formatNum(acct.reach)}</span></div>` : ''}
          ${acct.impressions != null ? `<div class="acct-stat"><span class="stat-label">Impressions</span><span class="stat-value">${formatNum(acct.impressions)}</span></div>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderTopPosts(posts) {
    const list = $('#top-posts-list');
    const section = $('#analytics-top-posts');

    if (!posts.length) {
      section.classList.remove('hidden');
      list.innerHTML = '<p class="empty-state">No post data available for the last 30 days.</p>';
      return;
    }

    section.classList.remove('hidden');
    list.innerHTML = posts.map((post, i) => `
      <div class="top-post">
        <div class="post-info">
          <div class="post-text">${i + 1}. ${post.content || post.text || post.caption || 'Post'}</div>
          <div class="post-meta">
            ${post.network || post.platform || ''} · ${post.publicationDate || post.date || ''}
          </div>
        </div>
        <div class="post-stats">
          ${post.likes != null ? `<div class="post-stat"><span class="stat-num">${formatNum(post.likes)}</span><span class="stat-label">Likes</span></div>` : ''}
          ${post.comments != null ? `<div class="post-stat"><span class="stat-num">${formatNum(post.comments)}</span><span class="stat-label">Comments</span></div>` : ''}
          ${post.shares != null ? `<div class="post-stat"><span class="stat-num">${formatNum(post.shares)}</span><span class="stat-label">Shares</span></div>` : ''}
          ${post.interactions != null ? `<div class="post-stat"><span class="stat-num">${formatNum(post.interactions)}</span><span class="stat-label">Interactions</span></div>` : ''}
          ${post.reach != null ? `<div class="post-stat"><span class="stat-num">${formatNum(post.reach)}</span><span class="stat-label">Reach</span></div>` : ''}
          ${post.impressions != null ? `<div class="post-stat"><span class="stat-num">${formatNum(post.impressions)}</span><span class="stat-label">Views</span></div>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderAnalyticsSummary() {
    const section = $('#analytics-summary');
    const grid = $('#stats-grid');
    section.classList.remove('hidden');

    const total = queue.length;
    const approved = queue.filter((q) => q.status === 'approved').length;
    const pending = queue.filter((q) => q.status === 'pending' || q.status === 'revision').length;
    const revisions = queue.reduce((sum, q) => sum + ((q.revisionCount || 0)), 0);

    grid.innerHTML = `
      <div class="stat-box"><div class="stat-number">${total}</div><div class="stat-desc">Total Videos</div></div>
      <div class="stat-box"><div class="stat-number">${approved}</div><div class="stat-desc">Approved</div></div>
      <div class="stat-box"><div class="stat-number">${pending}</div><div class="stat-desc">Pending Review</div></div>
      <div class="stat-box"><div class="stat-number">${revisions}</div><div class="stat-desc">Total Revisions</div></div>
    `;
  }

  function formatNum(n) {
    if (n == null) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  // Analytics is loaded lazily — triggered from nav click handler below

  // ─── Wire Approve → Metricool Post ───
  function scheduleApprovedItem(item) {
    if (!apiKeys.metricool) {
      console.log('[Metricool] No API key — skip scheduling');
      return;
    }
    const postParams = {
      content: `${item.productName} — ${item.typeName} by ${item.avatarName}`,
      publicationDate: item.schedDate
        ? { dateTime: item.schedDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        : undefined,
    };
    API.metricool.schedulePost(postParams).then((res) => {
      if (res.ok) {
        console.log('[Metricool] Post scheduled:', res);
        item.metricoolId = res.postId || res.id;
        saveQueue();
      } else {
        console.warn('[Metricool] Schedule failed:', res.error);
      }
    });
  }

  // ─── Init ───
  loadApiKeys();
  syncKeysFromBackend().then(() => {
    loadApiKeys();
    checkBackendStatus();
  });
  renderQueue();
  renderActivity();
  updateBadge();
  renderScheduledPosts();
  checkBackendStatus();

  // Fetch live scheduled posts if Metricool key is set
  if (apiKeys.metricool) fetchScheduledPosts();
})();
