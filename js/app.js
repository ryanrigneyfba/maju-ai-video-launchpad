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

  // Cleanup: remove busted pending items that have no stitched video and no segment videos
  const beforeCount = queue.length;
  queue = queue.filter(item => {
    if (item.status === 'pending' && !item.stitchedVideoUrl && (!item.segmentVideos || item.segmentVideos.length === 0)) {
      console.log('[Cleanup] Removing busted queue item:', item.id, item.typeName);
      return false;
    }
    return true;
  });
  if (queue.length < beforeCount) {
    localStorage.setItem(CONFIG.storageKeys.queue, JSON.stringify(queue));
    console.log(`[Cleanup] Removed ${beforeCount - queue.length} busted pending items from queue`);
  }

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
    tracker: 'view-tracker',
    approval: 'view-approval',
    approved: 'view-approved',
    spend: 'view-spend',
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
      tracker: 'Request Tracker',
      approval: 'Approval Queue',
      approved: 'Approved Videos',
      spend: 'Spend Tracker',
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
    // Refresh views when navigating to them
    if (name === 'tracker') renderTracker();
    if (name === 'approved') renderApprovedVideos();
    if (name === 'spend') renderSpendTracker();
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

    const systemPrompt = `You are a video production AI assistant for MAJU, a wellness brand. You generate optimized Kling AI text-to-video prompts.

Format: ${videoType}
Avatar: ${avatar} (Patient Maya / Bree Alba — young woman, hair in bun, black tank top, minimal makeup, natural look)
Product: ${product} (Maju's Black Seed Oil 8oz — dark glass bottle with "MAJU BLACK SEED OIL" label)
Video model: Kling v2 Master (text-to-video, 5s per segment)

This is the "Anti-Puffy Face Snack" Selfcare Snack Reel — red onion + Maju Black Seed Oil + salt. Total duration: 25 seconds (5 segments x 5s each), 9:16 vertical.

The video has exactly 5 segments. Each segment is generated as a 5-second Kling text-to-video clip. Prompts must be rich, descriptive, and cinematic — Kling generates from text alone (no reference image).

SEGMENT 1: HOOK (0-5s) — Stop the scroll
Text overlay: "de-puff your face snack" OR "wake up puffy? eat this"

SEGMENT 2: THE REVEAL — Ingredients + Pour (5-10s) — Product placement money shot
Text overlay: "1 red onion\\n+ black seed oil\\n+ salt"

SEGMENT 3: THE DEMO — Eating the Snack (10-15s) — Viral hook, authentic reaction
Text overlay: NONE (let the visual do the work)

SEGMENT 4: RESULT + BENEFITS (15-20s) — Educate on benefits
Text overlay: "drains facial bloat\\nreduces water retention\\ntightens puffy skin"

SEGMENT 5: THE GLOW — Result + CTA (20-25s) — Payoff beauty shot
Text overlay: "anti-puffy face snack\\n(onion + black seed oil + salt)" + CTA

CRITICAL RULES FOR EVERY PROMPT:
- EVERY prompt MUST describe Patient Maya: "a young woman with her hair in a bun wearing a black tank top"
- EVERY prompt MUST include the Maju bottle: "a dark bottle labeled MAJU BLACK SEED OIL"
- The bottle MUST be visible in EVERY segment — on the counter, in her hand, or in the foreground
- Bottle label must be readable in at least Reveal + Glow segments
- Kitchen: ALWAYS dark/moody (dark cabinets, warm wood), NEVER bright/white
- Lighting: ALWAYS warm golden-hour (3200-4000K), soft, flattering
- Eating reaction must be AUTHENTIC — slight grimace then acceptance, NOT polished
- Movement: smooth, natural, never robotic
- Each prompt should be 2-3 sentences of rich visual description for Kling text-to-video
- Include "Vertical 9:16 format" in each prompt

For A/B testing, vary: hook text, CTA ("save for later" / "link in bio" / "shop now"), and lighting intensity.

Return ONLY a JSON object with these fields:
- "segments": array of 5 objects, each with { "name": segment name, "prompt": optimized Kling text-to-video prompt, "duration": 5, "textOverlay": text to show or null, "model": "kling-v2-master" }
- "direction": overall visual/pacing/tone direction
- "reasoning": 1 sentence explaining what you optimized based on feedback
- "captions": array of 5 objects for each segment with { "text": "caption text", "startTime": seconds, "endTime": seconds }
- "hookVariant": which hook text variant this version uses

Example:
{"segments":[{"name":"hook","prompt":"A young woman with her hair in a bun wearing a black tank top...","duration":5,"textOverlay":"de-puff your face snack","model":"kling-v2-master"},{"name":"reveal","prompt":"A young woman with hair in a bun wearing a black tank top pours...","duration":5,"textOverlay":"1 red onion\\n+ black seed oil\\n+ salt","model":"kling-v2-master"},{"name":"demo","prompt":"Tight close-up of a young woman with hair in a bun...","duration":5,"textOverlay":null,"model":"kling-v2-master"},{"name":"result","prompt":"A young woman with hair in a bun wearing a black tank top holds...","duration":5,"textOverlay":"drains facial bloat\\nreduces water retention\\ntightens puffy skin","model":"kling-v2-master"},{"name":"glow","prompt":"A young woman with hair in a bun wearing a black tank top looks...","duration":5,"textOverlay":"anti-puffy face snack","model":"kling-v2-master"}],"direction":"Warm, moody kitchen. Authentic reactions.","reasoning":"Used default SOP prompts.","captions":[{"text":"de-puff your face snack","startTime":0,"endTime":5},{"text":"1 red onion + black seed oil + salt","startTime":5,"endTime":10},{"text":"","startTime":10,"endTime":15},{"text":"drains facial bloat, reduces water retention, tightens puffy skin","startTime":15,"endTime":20},{"text":"anti-puffy face snack","startTime":20,"endTime":25}],"hookVariant":"de-puff your face snack"}`;

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
    renderTracker();
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
    console.log('[Pipeline] apiKeys.kling =', apiKeys.kling ? '(set)' : '(empty)', '| All keys:', Object.keys(apiKeys).filter(k => apiKeys[k]));
    if (!apiKeys.kling) {
      let stage = 0;
      const sim = [
        '⚠️ Kling API key not set — video generation simulated. Add key in Settings.',
        'FFmpeg stitch simulated (no backend connected).',
        '✓ Pipeline complete — videos in queue (simulated).',
      ];
      function advanceSim() {
        setStage(stage, sim[stage]);
        stage++;
        if (stage < sim.length) {
          setTimeout(advanceSim, 1800);
        } else {
          // Simulation complete — move items into the approval queue
          const simItems = queue.filter(q => q.pipelineStage === 'generate');
          simItems.forEach(item => { item.pipelineStage = 'queue'; });
          saveQueue();
          renderQueue();
          renderTracker();
          updateBadge();
        }
      }
      advanceSim();
      return;
    }

    // Real pipeline: Generate → Stitch → Queue
    runRealPipeline(steps, msg, setStage);
  }

  // SOP v2.0 default Kling prompts for each segment
  // Avatar: Patient Maya (Bree Alba) — young woman, black tank top, hair in bun, minimal makeup, natural look
  // Product: Maju's Black Seed Oil 8oz dark bottle with "MAJU BLACK SEED OIL" label
  const DEFAULT_SEGMENT_PROMPTS = [
    { name: 'hook', duration: 5, prompt: 'A young woman with her hair in a bun wearing a black tank top stands in a dark moody kitchen with warm golden lighting. She holds a whole red onion near her face, looking at it curiously then turning to camera with a confident knowing smile. A dark glass bottle labeled "MAJU BLACK SEED OIL" sits prominently on the wooden counter beside her. She slowly raises the onion. Cinematic warm golden-hour lighting from a window, dark cabinets in background. Vertical 9:16 format, smooth natural motion.', textOverlay: 'de-puff your face snack', model: 'kling-v2-master' },
    { name: 'reveal', duration: 5, prompt: 'A young woman with hair in a bun wearing a black tank top pours dark oil from a bottle labeled "MAJU BLACK SEED OIL" onto a halved red onion on a wooden cutting board. Camera slightly wider showing her waist up. She looks down at the onion as she pours, the bottle label clearly readable facing camera. Dark moody kitchen with warm golden lighting, dark cabinets behind her. Smooth satisfying pour motion, oil glistening on the onion. Vertical 9:16 format.', textOverlay: '1 red onion\n+ black seed oil\n+ salt', model: 'kling-v2-master' },
    { name: 'demo', duration: 5, prompt: 'Tight close-up of a young woman with hair in a bun wearing a black tank top biting into a raw red onion half glistening with dark oil. She takes a big crunchy bite, chews with a slight grimace then settles into it and nods approvingly. A dark bottle labeled "MAJU BLACK SEED OIL" is visible on the counter behind her. Warm golden kitchen lighting, dark moody background. Authentic unpolished eating reaction. Vertical 9:16 format, natural motion.', textOverlay: null, model: 'kling-v2-master' },
    { name: 'result', duration: 5, prompt: 'A young woman with hair in a bun wearing a black tank top holds a bitten red onion near her face, looking confidently at camera. She gently touches her cheek with her free hand, feeling her skin. A dark bottle labeled "MAJU BLACK SEED OIL" is visible on the counter beside her. Warm golden lighting in a dark moody kitchen. Calm, satisfied expression on her face. Vertical 9:16 format.', textOverlay: 'drains facial bloat\nreduces water retention\ntightens puffy skin', model: 'kling-v2-master' },
    { name: 'glow', duration: 5, prompt: 'A young woman with hair in a bun wearing a black tank top looks at herself in a mirror, gently touching her glowing dewy face with both hands. She looks serene and satisfied with her skin. A dark bottle labeled "MAJU BLACK SEED OIL" is prominently placed in the foreground near the mirror. Warm soft golden lighting emphasizes her healthy glowing skin. Dark moody background. Vertical 9:16 format, slow smooth motion.', textOverlay: 'anti-puffy face snack\n(onion + black seed oil + salt)', model: 'kling-v2-master' },
  ];

  // Helper: generate a video segment via Kling text-to-video and poll until done
  // Returns { url, error } object
  async function generateSegmentVideo(seg, segLabel) {
    const result = await API.kling.generateVideo({
      prompt: seg.prompt,
      duration: seg.duration <= 5 ? '5' : '10',
      aspect_ratio: '9:16',
      model_name: seg.model || 'kling-v2-master',
      mode: 'std',
    });
    console.log(`[Pipeline] Kling submit for ${segLabel}:`, result.ok, 'taskId:', result.taskId);
    if (!result.ok || !result.taskId) {
      const errDetail = result.error || result.message || JSON.stringify(result).slice(0, 200);
      debugPanel(`[${segLabel}] Kling submit failed: ${errDetail}`);
      return { url: null, error: `Submit: ${errDetail}` };
    }
    // Poll for completion (Kling can take a few minutes)
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      const status = await API.kling.getVideoStatus(result.taskId);
      const st = (status.task_status || '').toLowerCase();
      if (attempt % 5 === 0) console.log(`[Pipeline] Kling ${segLabel} poll #${attempt}: status=${st}`);
      if (st === 'succeed') {
        const videos = status.task_result && status.task_result.videos;
        const url = videos && videos[0] && videos[0].url;
        return { url: url || null, error: url ? null : 'No video URL in result' };
      }
      if (st === 'failed') {
        return { url: null, error: `Video failed: ${status.task_status_msg || 'unknown'}` };
      }
    }
    console.warn(`[Pipeline] ${segLabel} timed out after 360s`);
    return { url: null, error: 'Timed out after 360s' };
  }

  // Helper: run async tasks with a concurrency limit
  function runWithConcurrency(tasks, limit) {
    const results = new Array(tasks.length);
    let next = 0;
    let active = 0;
    return new Promise(resolve => {
      function launch() {
        while (active < limit && next < tasks.length) {
          const idx = next++;
          active++;
          tasks[idx]().then(val => { results[idx] = val; }).catch(() => { results[idx] = null; }).finally(() => {
            active--;
            if (next >= tasks.length && active === 0) resolve(results);
            else launch();
          });
        }
      }
      if (tasks.length === 0) resolve(results);
      else launch();
    });
  }

  async function runRealPipeline(steps, msg, setStage) {
    // Stage 0: Generate each segment via Kling text-to-video
    setStage(0, 'Generating video segments via Kling AI…');

    const newItems = queue.filter(q => q.pipelineStage === 'generate');
    const allSegmentVideos = []; // { url, label } for stitching

    for (const item of newItems) {
      const allSegments = (item.aiPrompt && item.aiPrompt.segments) || DEFAULT_SEGMENT_PROMPTS;
      const testMode = $('#test-mode') && $('#test-mode').checked;
      const segments = testMode ? allSegments.slice(0, 1) : allSegments;
      if (testMode) debugPanel('[Test Mode] Generating 1 segment only (hook)');

      // Generate ALL video segments in parallel via Kling (text→video, no image step needed)
      const KLING_CONCURRENCY = 3;
      msg.textContent = `v${item.version}: Generating ${segments.length} video segments via Kling…`;
      updateSegmentStatus('hook', 'Generating videos…', false);

      const videoTasks = segments.map((seg, si) => () => {
        updateSegmentStatus(seg.name, 'Generating…', false);
        return generateSegmentVideo(seg, `${seg.name} (${si + 1}/${segments.length})`);
      });
      const videoResults = await runWithConcurrency(videoTasks, KLING_CONCURRENCY);

      // Collect results (preserve segment order)
      const segmentResults = [];
      for (let si = 0; si < segments.length; si++) {
        if (videoResults[si] && videoResults[si].url) {
          segmentResults.push({ url: videoResults[si].url, label: segments[si].name, textOverlay: segments[si].textOverlay });
          updateSegmentStatus(segments[si].name, 'Done ✓', true);
        } else {
          const reason = videoResults[si]?.error || 'Video failed';
          updateSegmentStatus(segments[si].name, reason, false);
          debugPanel(`[${segments[si].name}] ${reason}`);
        }
      }

      // Store segment results on the item
      item.segmentVideos = segmentResults;
      if (segmentResults.length > 0) {
        item.videoUrl = segmentResults[0].url; // preview = first segment
        item.pipelineStage = 'stitch';
        allSegmentVideos.push(...segmentResults.map(s => ({ url: s.url, label: `${item.typeName} - ${s.label}` })));
        msg.textContent = `v${item.version}: ${segmentResults.length}/${segments.length} segments rendered!`;
      } else {
        item.pipelineStage = 'failed';
        item.status = 'failed';
        msg.textContent = `⚠️ v${item.version}: No segments rendered successfully.`;
        if (typeof fetchDebugLog === 'function') fetchDebugLog();
      }
      saveQueue();
    }

    const completedVideos = allSegmentVideos;

    // Stage 1: Auto-stitch via FFmpeg with captions
    let stitchPassed = false;
    if (completedVideos.length > 0 && (apiKeys.backendUrl || DEFAULT_BACKEND)) {
      setStage(1, `FFmpeg auto-stitching ${completedVideos.length} clips with captions…`);

      const stitchOptions = {};
      const firstItem = newItems[0];
      if (firstItem && firstItem.aiPrompt && firstItem.aiPrompt.captions) {
        stitchOptions.captions = firstItem.aiPrompt.captions;
      } else {
        // Fallback: build captions from segment textOverlay data
        const segs = (firstItem && firstItem.aiPrompt && firstItem.aiPrompt.segments) || DEFAULT_SEGMENT_PROMPTS;
        stitchOptions.captions = segs
          .filter(seg => seg.textOverlay)
          .map(seg => {
            const idx = segs.indexOf(seg);
            let segStart = 0;
            for (let j = 0; j < idx; j++) segStart += (segs[j].duration || 3);
            const segEnd = segStart + (seg.duration || 3);
            return { text: seg.textOverlay.replace(/\n/g, ' '), startTime: segStart, endTime: segEnd };
          });
      }

      try {
        const stitchResult = await API.backend.autoStitch(completedVideos, stitchOptions);
        if (stitchResult.jobId) {
          let stitchDone = false;
          while (!stitchDone) {
            await new Promise(r => setTimeout(r, 1500));
            const st = await API.backend.jobStatus(stitchResult.jobId);
            msg.textContent = `Stitching… ${st.progress || 0}%`;

            if (st.status === 'done') {
              stitchDone = true;
              const dlUrl = API.backend.downloadUrl(stitchResult.jobId);
              newItems[0].stitchJobId = stitchResult.jobId;
              newItems[0].stitchedVideoUrl = dlUrl;
              msg.textContent = 'Stitch complete!';
              stitchPassed = true;
            } else if (st.status === 'error') {
              stitchDone = true;
              msg.textContent = `⚠️ Stitch error: ${st.error}`;
            }
          }
        }
      } catch (err) {
        msg.textContent = `⚠️ Stitch error: ${err.message}`;
      }
    } else if (completedVideos.length === 0) {
      setStage(1, 'Stitch skipped — no completed videos.');
    } else {
      setStage(1, 'Stitch skipped — no backend URL set.');
    }

    // Audit check: only send to approval if stitch produced a real video
    if (stitchPassed && newItems[0].stitchedVideoUrl) {
      newItems.forEach(item => { item.pipelineStage = 'queue'; });
      saveQueue();
      renderQueue();
      renderTracker();
      updateBadge();
      setStage(2, '✓ Pipeline complete — video ready for approval.');
    } else if (completedVideos.length > 0) {
      // Segments rendered but stitch failed — keep in generate stage for retry, don't pollute approval queue
      msg.textContent = '⚠️ Stitch failed — video not sent to approval. Check backend and retry.';
      renderTracker();
      setStage(2, '⚠️ Stitch failed — not queued for approval.');
    } else {
      // Nothing rendered at all — keep in generate stage so they don't pollute approval queue
      newItems.forEach(item => { item.pipelineStage = 'failed'; item.status = 'failed'; });
      saveQueue();
      renderTracker();
      updateBadge();
      setStage(2, '⚠️ No videos generated — check Kling API key and retry.');
    }
  }

  // ─── Queue Rendering ───
  function renderQueue(filter = 'all') {
    const list = $('#queue-list');
    // Only show items that have reached the approval queue (not still generating/stitching)
    const readyForApproval = queue.filter(q => q.pipelineStage === 'queue' || q.pipelineStage === 'post');
    const filtered =
      filter === 'all' ? readyForApproval : readyForApproval.filter((q) => q.status === filter);

    if (!filtered.length) {
      list.innerHTML =
        '<p class="empty-state">No items match this filter.</p>';
      return;
    }

    list.innerHTML = filtered
      .map(
        (item) => `
      <div class="queue-item status-${item.status}" data-id="${item.id}">
        ${item.stitchedVideoUrl ? `<div class="queue-video"><video src="${item.stitchedVideoUrl}" controls preload="metadata" playsinline></video></div>` : item.videoUrl ? `<div class="queue-video"><video src="${item.videoUrl}" controls preload="metadata" playsinline></video></div>` : '<div class="queue-video queue-video-placeholder"><span>Video generating…</span></div>'}
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
      renderTracker();
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
      renderTracker();
      renderActivity();
      updateBadge();

      // If kling key exists, send revision request
      if (apiKeys.kling) {
        API.kling.reviseVideo(item.id, notes);
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
      (q) => (q.status === 'pending' || q.status === 'revision') && (q.pipelineStage === 'queue' || q.pipelineStage === 'post')
    ).length;
    const badge = $('#queue-badge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';

    // Tracker badge: count of all active (non-posted, non-failed) items
    const active = queue.filter(q => q.status !== 'failed' && q.pipelineStage !== 'post').length;
    const trackerBadge = $('#tracker-badge');
    if (trackerBadge) {
      trackerBadge.textContent = active;
      trackerBadge.style.display = active > 0 ? '' : 'none';
    }
  }

  // ─── Request Tracker ───
  const PIPELINE_STAGES = [
    { key: 'generate', label: 'Generating', icon: '🎬' },
    { key: 'stitch', label: 'Stitching', icon: '🧵' },
    { key: 'queue', label: 'Awaiting Approval', icon: '⏳' },
    { key: 'post', label: 'Posted', icon: '✅' },
  ];

  function getStageIndex(item) {
    if (item.status === 'approved' && item.pipelineStage === 'post') return 3;
    const idx = PIPELINE_STAGES.findIndex(s => s.key === item.pipelineStage);
    return idx >= 0 ? idx : 0;
  }

  function renderTracker() {
    const list = $('#tracker-list');
    if (!list) return;

    if (!queue.length) {
      list.innerHTML = '<p class="empty-state">No active requests. Generate videos from the Dashboard.</p>';
      return;
    }

    // Sort: active items first (generate, stitch, queue), then completed (post)
    const sorted = [...queue].sort((a, b) => {
      const aIdx = getStageIndex(a);
      const bIdx = getStageIndex(b);
      if (aIdx === bIdx) return new Date(b.createdAt) - new Date(a.createdAt);
      return aIdx - bIdx;
    });

    list.innerHTML = sorted.map(item => {
      const currentStage = getStageIndex(item);
      const isRevision = item.status === 'revision';
      const isFailed = item.status === 'failed';

      const stagesHtml = PIPELINE_STAGES.map((stage, idx) => {
        let cls = 'tracker-stage';
        if (idx < currentStage) cls += ' completed';
        else if (idx === currentStage) cls += ' active';
        if (isFailed && idx === currentStage) cls += ' failed';
        if (isRevision && idx === 0) cls += ' revision';
        return `<div class="${cls}">
          <div class="tracker-stage-dot">${idx < currentStage ? '✓' : stage.icon}</div>
          <div class="tracker-stage-label">${stage.label}</div>
        </div>`;
      }).join('<div class="tracker-stage-connector"></div>');

      const progressPct = Math.round(((currentStage + (currentStage < 3 ? 0.5 : 1)) / PIPELINE_STAGES.length) * 100);

      return `<div class="tracker-item ${isFailed ? 'tracker-failed' : ''} ${isRevision ? 'tracker-revision' : ''}">
        <div class="tracker-header">
          <div class="tracker-title">
            <strong>${item.typeName || 'Video'} — v${item.version}/${item.totalVersions}</strong>
            <span class="tracker-meta">${item.productName} · ${item.avatarName}</span>
          </div>
          <div class="tracker-progress-badge">${isFailed ? 'Failed' : isRevision ? 'In Revision' : progressPct + '%'}</div>
        </div>
        <div class="tracker-pipeline">${stagesHtml}</div>
        <div class="tracker-footer">
          <span class="tracker-meta">Created ${formatDate(item.createdAt)}</span>
          ${item.postMode === 'asap' ? '<span class="tracker-meta">Post ASAP</span>' : `<span class="tracker-meta">Scheduled: ${formatDate(item.schedDate)}</span>`}
          ${(item.revisionCount || 0) > 0 ? `<span class="tracker-meta tracker-rev-count">Revision ${item.revisionCount}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Approved Videos ───
  function renderApprovedVideos() {
    const list = $('#approved-list');
    if (!list) return;

    const approved = queue.filter(q => q.status === 'approved');
    if (!approved.length) {
      list.innerHTML = '<p class="empty-state">No approved videos yet.</p>';
      return;
    }

    // Most recently approved first
    const sorted = [...approved].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = sorted.map(item => {
      const videoSrc = item.stitchedVideoUrl || item.videoUrl;
      return `<div class="approved-card">
        ${videoSrc ? `<video src="${videoSrc}" controls preload="metadata" playsinline></video>` : '<div class="queue-video-placeholder" style="height:180px"><span>No video</span></div>'}
        <div class="approved-card-info">
          <h4>${item.typeName || 'Video'} — v${item.version}</h4>
          <p>${item.productName} · ${item.avatarName}</p>
          <p>${formatDate(item.createdAt)}</p>
          ${item.postMode === 'asap' ? '<p>Post ASAP</p>' : `<p>Scheduled: ${formatDate(item.schedDate)}</p>`}
          ${item.metricoolId ? '<p style="color:var(--success)">Posted to Metricool</p>' : ''}
          ${(item.approvalNotes || []).map(n => `<div class="approved-card-notes">${n}</div>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Spend Tracker ───
  // Kling pricing estimates (per API call)
  const COST_ESTIMATES = {
    'kling-v2-master': 0.14,    // Kling v2 Master (5s video)
    'kling-v2-5-turbo': 0.07,   // Kling v2.5 Turbo (5s video)
    'kling-v2-6': 0.14,          // Kling v2.6 (5s video)
    'kling-v1': 0.07,            // Kling v1 (5s video)
    default_video: 0.14,
  };

  function renderSpendTracker() {
    const summaryEl = $('#spend-summary');
    const tableEl = $('#spend-table-wrap');
    if (!summaryEl || !tableEl) return;

    // Build spend log from queue items
    const spendRows = [];
    for (const item of queue) {
      const segments = (item.aiPrompt && item.aiPrompt.segments) || DEFAULT_SEGMENT_PROMPTS;
      const segCount = item.segmentVideos ? item.segmentVideos.length : 0;
      const imageCount = 0; // Kling generates video directly, no separate image step
      const videoCount = segCount;
      const model = (segments[0] && segments[0].model) || 'kling-v2-master';
      const imageCost = 0;
      const videoCost = videoCount * (COST_ESTIMATES[model] || COST_ESTIMATES.default_video);
      const totalCost = imageCost + videoCost;

      spendRows.push({
        id: item.id,
        date: item.createdAt,
        name: `${item.typeName || 'Video'} — v${item.version}`,
        product: item.productName,
        images: imageCount,
        videos: videoCount,
        model: model,
        imageCost,
        videoCost,
        totalCost,
        status: item.status,
      });
    }

    if (!spendRows.length) {
      summaryEl.innerHTML = '';
      tableEl.innerHTML = '<p class="empty-state">No generation history yet.</p>';
      return;
    }

    // Sort by date descending
    spendRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalSpend = spendRows.reduce((s, r) => s + r.totalCost, 0);
    const totalImages = spendRows.reduce((s, r) => s + r.images, 0);
    const totalVideos = spendRows.reduce((s, r) => s + r.videos, 0);
    const totalRequests = spendRows.length;

    summaryEl.innerHTML = `
      <div class="spend-stat"><div class="stat-value">$${totalSpend.toFixed(2)}</div><div class="stat-label">Est. Total Spend</div></div>
      <div class="spend-stat"><div class="stat-value">${totalRequests}</div><div class="stat-label">Requests</div></div>
      <div class="spend-stat"><div class="stat-value">${totalImages}</div><div class="stat-label">Images Generated</div></div>
      <div class="spend-stat"><div class="stat-value">${totalVideos}</div><div class="stat-label">Videos Rendered</div></div>
    `;

    tableEl.innerHTML = `<table class="spend-table">
      <thead><tr>
        <th>Date</th><th>Request</th><th>Product</th><th>Images</th><th>Videos</th><th>Model</th><th>Est. Cost</th><th>Status</th>
      </tr></thead>
      <tbody>${spendRows.map(r => `<tr>
        <td class="spend-date">${formatDate(r.date)}</td>
        <td>${r.name}</td>
        <td>${r.product || '—'}</td>
        <td>${r.images}</td>
        <td>${r.videos}</td>
        <td>${r.model}</td>
        <td class="spend-amount">$${r.totalCost.toFixed(2)}</td>
        <td>${r.status}</td>
      </tr>`).join('')}</tbody>
    </table>`;
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
    if (apiKeys.kling) $('#api-kling').value = apiKeys.kling;
    if (apiKeys.klingSecret) $('#api-kling-secret').value = apiKeys.klingSecret;
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
        const hasRemoteKeys = remote && Object.keys(remote).filter(k => remote[k]).length > 0;
        const hasLocalKeys = Object.keys(apiKeys).filter(k => apiKeys[k]).length > 0;

        if (hasRemoteKeys) {
          // Merge: remote keys fill in anything missing locally
          apiKeys = { ...remote, ...apiKeys };
          // If local was empty, remote wins completely
          if (!localStorage.getItem(CONFIG.storageKeys.apiKeys)) {
            apiKeys = remote;
          }
          localStorage.setItem(CONFIG.storageKeys.apiKeys, JSON.stringify(apiKeys));
          loadApiKeys();
          console.log('[Config] Synced keys from backend');
        } else if (hasLocalKeys) {
          // Backend has no keys (e.g. after redeploy) — push local keys up
          console.log('[Config] Backend empty after redeploy — pushing local keys');
          pushKeysToBackend();
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
      kling: $('#api-kling').value.trim(),
      klingSecret: $('#api-kling-secret').value.trim(),
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
    // ── Kling AI — Video generation (via proxy) ──
    // API: https://api-singapore.klingai.com
    // Auth: JWT (HS256) from AccessKey + SecretKey (handled server-side)
    // Models: kling-v1, kling-v2-master, kling-v2-5-turbo, kling-v2-6
    kling: {
      async generateVideo(params) {
        console.log('[Kling] Generate video:', params);
        if (!apiKeys.kling) return { ok: false, error: 'No Kling API key set — add in Settings' };
        const body = {
          model_name: params.model_name || 'kling-v2-master',
          prompt: params.prompt || '',
          aspect_ratio: params.aspect_ratio || '9:16',
          duration: params.duration || '5',
          mode: params.mode || 'std',
        };
        if (params.negative_prompt) body.negative_prompt = params.negative_prompt;
        if (params.camera_control) body.camera_control = params.camera_control;
        try {
          const res = await fetch(backendUrl('/api/proxy/kling/text2video'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.kling, 'x-api-secret-value': apiKeys.klingSecret || '' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          console.log('[Kling] Generate response:', data);
          const taskId = data.data && data.data.task_id;
          return { ok: res.ok && data.code === 0, taskId, ...data };
        } catch (err) {
          console.error('[Kling] Error:', err);
          return { ok: false, error: err.message };
        }
      },

      async getVideoStatus(taskId) {
        if (!apiKeys.kling) return { task_status: 'failed', task_status_msg: 'No Kling API key' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/kling/text2video/${encodeURIComponent(taskId)}`), {
            headers: { 'x-api-key-value': apiKeys.kling, 'x-api-secret-value': apiKeys.klingSecret || '' },
          });
          const data = await res.json();
          return data.data || { task_status: 'failed', task_status_msg: data.message || 'Unknown error' };
        } catch (err) {
          return { task_status: 'failed', task_status_msg: err.message };
        }
      },

      async reviseVideo(videoId, notes) {
        return this.generateVideo({
          prompt: `Revision — feedback: ${notes}`,
          model_name: 'kling-v2-master',
        });
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

  // ─── Debug Panel (visible on page, no F12 needed) ───
  const _debugLines = [];
  function debugPanel(msg) {
    _debugLines.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (_debugLines.length > 100) _debugLines.shift();
    const el = document.getElementById('debug-panel-content');
    if (el) {
      el.textContent = _debugLines.join('\n');
      el.scrollTop = el.scrollHeight;
    }
  }
  window.debugPanel = debugPanel;

  // Fetch server-side debug logs and display in panel
  async function fetchDebugLog() {
    try {
      const res = await fetch(backendUrl('/api/debug/log?n=50'));
      const logs = await res.json();
      const el = document.getElementById('debug-panel-content');
      if (el && logs.length) {
        const lines = logs.map(e => `[${e.t?.slice(11, 19) || '??'}] [${e.tag}] ${JSON.stringify(e, null, 0).slice(0, 300)}`);
        el.textContent = lines.join('\n') + '\n---\n' + _debugLines.join('\n');
        el.scrollTop = el.scrollHeight;
      }
    } catch (err) {
      debugPanel(`Failed to fetch server logs: ${err.message}`);
    }
  }
  window.fetchDebugLog = fetchDebugLog;

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
  renderTracker();
  renderActivity();
  updateBadge();
  renderScheduledPosts();
  checkBackendStatus();

  // Fetch live scheduled posts if Metricool key is set
  if (apiKeys.metricool) fetchScheduledPosts();
})();
