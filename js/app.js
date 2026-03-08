/* ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ 
   MAJU AI Video Launchpad ÃÂ¢ÃÂÃÂ v1.1 
   Main application logic
   ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ */ 
(function () {
  'use strict';

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Config ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  const CONFIG = {
    higgsfield: {
      asset: 'majurender8oz',
      avatar: 'b262e935-4460-4026-980b-926aa0babdec'
    },
    avatarMeta: {
      'b262e935-4460-4026-980b-926aa0babdec': { name: 'Patient Maya', ig: '@breealba' },
    },
    productMeta: {
      majurender8oz: { name: "Maju's Black Seed Oil 8oz" },
    },
    storageKeys: {
      queue: 'maju_queue',
      apiKeys: 'maju_api_keys',
    },
  };

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ State ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  let queue = JSON.parse(localStorage.getItem(CONFIG.storageKeys.queue) || '[]');

  // Cleanup: remove busted pending items that have no stitched video andno segment ideos
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

  // Hydrate legacy items: backfill instagramCaption & hashtags from aiPrompt
  let hydrated = false;
  queue.forEach(item => {
    if (!item.instagramCaption && item.aiPrompt?.instagramCaption) {
      item.instagramCaption = item.aiPrompt.instagramCaption;
      hydrated = true;
    }
    if ((!item.hashtags || !item.hashtags.length) && item.aiPrompt?.hashtags?.length) {
      item.hashtags = item.aiPrompt.hashtags;
      hydrated = true;
    }
  });
  if (hydrated) {
    localStorage.setItem(CONFIG.storageKeys.queue, JSON.stringify(queue));
    console.log('[Hydrate] Backfilled instagramCaption/hashtags from aiPrompt on legacy items');
  }

  // Second pass: generate defaults for items still missing caption/hashtags
  let defaultsAdded = false;
  queue.forEach(item => {
    if (!item.instagramCaption) {
      const pName = item.productName || item.aiPrompt?.segments?.[0]?.textOverlay || 'Black Seed Oil';
      const hook = item.aiPrompt?.hookVariant || item.typeName || 'wellness snack';
      item.instagramCaption = hook + ' ÃÂ¢ÃÂÃÂ¨\nTry this with ' + pName + '. Your skin will thank you! ÃÂ°ÃÂÃÂÃÂ¤\nSave & follow @majusuperfoods for more wellness snacks';
      defaultsAdded = true;
    }
    if (!item.hashtags || !item.hashtags.length) {
      item.hashtags = ['blackseedoil','depuff','facesnack','skincaretips','naturalremedy','antiinflammatory','puffyface','wellnesstips','majublackseedoil','skincareroutine','majusuperfoods','holistichealth'];
      defaultsAdded = true;
    }
  });
  if (defaultsAdded) {
    localStorage.setItem(CONFIG.storageKeys.queue, JSON.stringify(queue));
    console.log('[Hydrate] Generated default instagramCaption/hashtags for items missing them');
  }

  let apiKeys = JSON.parse(localStorage.getItem(CONFIG.storageKeys.apiKeys) || '{}');
  let currentRejectId = null;
  let currentApproveId = null;
  let analyticsLoaded = false;

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Feedback Log (persisted for AI learning) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  const FEEDBACK_KEY = 'maju_feedback_log';
  let feedbackLog = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');

  function saveFeedback(entry) {
    feedbackLog.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackLog));
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ DOM Refs ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Navigation ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Posting Toggle ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Claude AI Learning Loop ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
Avatar: ${avatar} (Patient Maya / Bree Alba ÃÂ¢ÃÂÃÂ young woman, hair in bun, black tank top, minimal makeup, natural look)
Product: ${product} (Maju's Black Seed Oil 8oz ÃÂ¢ÃÂÃÂ dark glass bottle with "MAJU BLACK SEED OIL" label)
Video model: Kling v2 Master (text-to-video, 5s per segment)

This is the "Anti-Puffy Face Snack" Selfcare Snack Reel ÃÂ¢ÃÂÃÂ red onion + Maju Black Seed Oil + salt. Total duration: 25 seconds (5 segments x 5s each), 9:16 vertical.

The video has exactly 5 segments. Each segment is generated as a 5-second Kling text-to-video clip. Prompts must be rich, descriptive, and cinematic ÃÂ¢ÃÂÃÂ Kling generates from text alone (no reference image).

SEGMENT 1: HOOK (0-5s) ÃÂ¢ÃÂÃÂ Stop the scroll
Text overlay: "de-puff your face snack" OR "wake up puffy? eat this"

SEGMENT 2: THE REVEAL ÃÂ¢ÃÂÃÂ Ingredients + Pour (5-10s) ÃÂ¢ÃÂÃÂ Product placement money shot
Text overlay: "1 red onion\\n+ black seed oil\\n+ salt"

SEGMENT 3: THE DEMO ÃÂ¢ÃÂÃÂ Eating the Snack (10-15s) ÃÂ¢ÃÂÃÂ Viral hook, authentic reaction
Text overlay: NONE (let the visual do the work)

SEGMENT 4: RESULT + BENEFITS (15-20s) ÃÂ¢ÃÂÃÂ Educate on benefits
Text overlay: "drains facial bloat\\nreduces water retention\\ntightens puffy skin"

SEGMENT 5: THE GLOW ÃÂ¢ÃÂÃÂ Result + CTA (20-25s) ÃÂ¢ÃÂÃÂ Payoff beauty shot
Text overlay: "anti-puffy face snack\\n(onion + black seed oil + salt)" + CTA

CRITICAL RULES FOR EVERY PROMPT:
- EVERY prompt MUST describe Patient Maya: "a young woman with her hair in a bun wearing a black tank top"
- EVERY prompt MUST include the Maju bottle: "a dark bottle labeled MAJU BLACK SEED OIL"
- The bottle MUST be visible in EVERY segment ÃÂ¢ÃÂÃÂ on the counter, in her hand, or in the foreground
- Bottle label must be readable in at least Reveal + Glow segments
- Kitchen: ALWAYS dark/moody (dark cabinets, warm wood), NEVER bright/white
- Lighting: ALWAYS warm golden-hour (3200-4000K), soft, flattering
- Eating reaction must be AUTHENTIC ÃÂ¢ÃÂÃÂ slight grimace then acceptance, NOT polished
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
- "instagramCaption": a ready-to-post Instagram caption (hook line + value prop + CTA, 150-300 characters, NO hashtags here)
- "hashtags": array of 10-15 relevant hashtags (strings without the # prefix, e.g. ["blackseedoil","wellness","skincare"])

Example:
{"segments":[{"name":"hook","prompt":"A young woman with her hair in a bun wearing a black tank top...","duration":5,"textOverlay":"de-puff your face snack","model":"kling-v2-master"},{"name":"reveal","prompt":"A young woman with hair in a bun wearing a black tank top pours...","duration":5,"textOverlay":"1 red onion\\n+ black seed oil\\n+ salt","model":"kling-v2-master"},{"name":"demo","prompt":"Tight close-up of a young woman with hair in a bun...","duration":5,"textOverlay":null,"model":"kling-v2-master"},{"name":"result","prompt":"A young woman with hair in a bun wearing a black tank top holds...","duration":5,"textOverlay":"drains facial bloat\\nreduces water retention\\ntightens puffy skin","model":"kling-v2-master"},{"name":"glow","prompt":"A young woman with hair in a bun wearing a black tank top looks...","duration":5,"textOverlay":"anti-puffy face snack","model":"kling-v2-master"}],"direction":"Warm, moody kitchen. Authentic reactions.","reasoning":"Used default SOP prompts.","captions":[{"text":"de-puff your face snack","startTime":0,"endTime":5},{"text":"1 red onion + black seed oil + salt","startTime":5,"endTime":10},{"text":"","startTime":10,"endTime":15},{"text":"drains facial bloat, reduces water retention, tightens puffy skin","startTime":15,"endTime":20},{"text":"anti-puffy face snack","startTime":20,"endTime":25}],"hookVariant":"de-puff your face snack","instagramCaption":"Wake up puffy? Try this anti-bloat snack! Red onion + Maju Black Seed Oil + salt = natural de-puff. Your face will thank you. Save for later!","hashtags":["blackseedoil","depuff","wellness","skincare","naturalremedies","majuoil","antiinflammatory","selfcare","beautyhack","healthysnack","glowup","facialcare","holistic","puffyface","bloatremedy"]}`;

    const feedbackContext = relevantFeedback.length
      ? `\n\nPast feedback for this format (${relevantFeedback.length} entries):
APPROVED videos ÃÂ¢ÃÂÃÂ what worked:\n${approvals.map((f) => `- "${f.notes}"`).join('\n') || '(none yet)'}
REJECTED videos ÃÂ¢ÃÂÃÂ what to avoid:\n${rejections.map((f) => `- "${f.notes}"`).join('\n') || '(none yet)'}`
      : '\n\nNo past feedback yet ÃÂ¢ÃÂÃÂ use best practices for short-form social video.';

    try {
      const res = await fetch(backendUrl('/api/proxy/claude/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.claude },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
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
          const parsed = JSON.parse(jsonMatch[0]);
          // Ensure instagramCaption and hashtags always present (Claude Haiku sometimes omits them)
          if (!parsed.instagramCaption) {
            const product = parsed.segments?.[0]?.textOverlay || 'Black Seed Oil';
            const hook = parsed.hookVariant || 'wellness snack';
            parsed.instagramCaption = hook + ' ÃÂ¢ÃÂÃÂ¨\nTry this anti-puffy face combo with ' + product + '. Your skin will thank you! ÃÂ°ÃÂÃÂÃÂ¤\nSave for later & follow @majusuperfoods for more wellness snacks';
          }
          if (!parsed.hashtags || !parsed.hashtags.length) {
            parsed.hashtags = ['blackseedoil','depuff','facesnack','skincaretips','naturalremedy','antiinflammatory','puffyface','wellnesstips','majublackseedoil','skincareroutine','majusuperfoods','holistichealth'];
          }
          return parsed;
        }
        return { script: text, direction: '', reasoning: 'Raw response' };
      }
      return null;
    } catch (err) {
      console.error('[Claude] Error:', err);
      return null;
    }
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Generate Video ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
      btn.textContent = 'ÃÂ°ÃÂÃÂ§ÃÂ  Claude is optimizing your promptÃÂ¢ÃÂÃÂ¦';
      aiPrompt = await getClaudeOptimizedPrompt(type, avatar, product, notes);
      btn.disabled = false;
      btn.textContent = 'ÃÂ°ÃÂÃÂÃÂ Generate & Send to Queue';
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
        instagramCaption: aiPrompt?.instagramCaption || '',
        hashtags: aiPrompt?.hashtags || [],
        version: i + 1,
        totalVersions: versions,
        status: 'pending',
        revisionCount: 0,
        revisionNotes: [],
        createdAt: new Date().toISOString(),
        pipelineStage: 'generate', // generate ÃÂ¢ÃÂÃÂ stitch ÃÂ¢ÃÂÃÂ queue ÃÂ¢ÃÂÃÂ post
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Pipeline Visualization ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
        'ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ Higgsfield API key not set ÃÂ¢ÃÂÃÂ video generation simulated. Add key in Settings.',
        'FFmpeg stitch simulated (no backend connected).',
        'ÃÂ¢ÃÂÃÂ Pipeline complete ÃÂ¢ÃÂÃÂ videos in queue (simulated).',
      ];
      function advanceSim() {
        setStage(stage, sim[stage]);
        stage++;
        if (stage < sim.length) {
          setTimeout(advanceSim, 1800);
        } else {
          // Simulation complete ÃÂ¢ÃÂÃÂ move items into the approval queue
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

    // Real pipeline: Generate ÃÂ¢ÃÂÃÂ Stitch ÃÂ¢ÃÂÃÂ Queue
    runRealPipeline(steps, msg, setStage);
  }

  // SOP v2.0 default Kling prompts for each segment
  // Avatar: Patient Maya (Bree Alba) ÃÂ¢ÃÂÃÂ young woman, black tank top, hair in bun, minimal makeup, natural look
  // Product: Maju's Black Seed Oil 8oz dark bottle with "MAJU BLACK SEED OIL" label
  const DEFAULT_SEGMENT_PROMPTS = [
    { name: 'hook', duration: 5, prompt: 'A young woman with her hair in a bun wearing a black tank top stands in a dark moody kitchen with warm golden lighting. She holds a whole red onion near her face, looking at it curiously then turning to camera with a confident knowing smile. A dark glass bottle labeled "MAJU BLACK SEED OIL" sits prominently on the wooden counter beside her. She slowly raises the onion. Cinematic warm golden-hour lighting from a window, dark cabinets in background. Vertical 9:16 format, smooth natural motion.', textOverlay: 'de-puff your face snack', model: 'kling-v2-master' },
    { name: 'reveal', duration: 5, prompt: 'A young woman with hair in a bun wearing a black tank top pours dark oil from a bottle labeled "MAJU BLACK SEED OIL" onto a halved red onion on a wooden cutting board. Camera slightly wider showing her waist up. She looks down at the onion as she pours, the bottle label clearly readable facing camera. Dark moody kitchen with warm golden lighting, dark cabinets behind her. Smooth satisfying pour motion, oil glistening on the onion. Vertical 9:16 format.', textOverlay: '1 red onion\n+ black seed oil\n+ salt', model: 'kling-v2-master' },
    { name: 'demo', duration: 5, prompt: 'Tight close-up of a young woman with hair in a bun wearing a black tank top biting into a raw red onion half glistening with dark oil. She takes a big crunchy bite, chews with a slight grimace then settles into it and nods approvingly. A dark bottle labeled "MAJU BLACK SEED OIL" is visible on the counter behind her. Warm golden kitchen lighting, dark moody background. Authentic unpolished eating reaction. Vertical 9:16 format, natural motion.', textOverlay: null, model: 'kling-v2-master' },
    { name: 'result', duration: 5, prompt: 'A young woman with hair in a bun wearing a black tank top holds a bitten red onion near her face, looking confidently at camera. She gently touches her cheek with her free hand, feeling her skin. A dark bottle labeled "MAJU BLACK SEED OIL" is visible on the counter beside her. Warm golden lighting in a dark moody kitchen. Calm, satisfied expression on her face. Vertical 9:16 format.', textOverlay: 'drains facial bloat\nreduces water retention\ntightens puffy skin', model: 'kling-v2-master' },
    { name: 'glow', duration: 5, prompt: 'A young woman with hair in a bun wearing a black tank top looks at herself in a mirror, gently touching her glowing dewy face with both hands. She looks serene and satisfied with her skin. A dark bottle labeled "MAJU BLACK SEED OIL" is prominently placed in the foreground near the mirror. Warm soft golden lighting emphasizes her healthy glowing skin. Dark moody background. Vertical 9:16 format, slow smooth motion.', textOverlay: 'anti-puffy face snack\n(onion + black seed oil + salt)', model: 'kling-v2-master' },
  ];

  // Helper: poll a Higgsfield image request until done
  async function pollImageStatus(requestId, segLabel, timeoutLabel) {
    for (let attempt = 0; attempt < 150; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const imgStatus = await API.higgsfield.getImageStatus(requestId);
      const st = (imgStatus.status || '').toLowerCase();
      if (attempt % 5 === 0) console.log(`[Pipeline] ${segLabel} ${timeoutLabel || 'image'} poll #${attempt}: status=${st}`);
      if (st === 'completed' || st === 'done') return { url: imgStatus.url };
      if (st === 'failed' || st === 'error' || st === 'nsfw' || st === 'cancelled') {
        return { url: null, error: `Image ${st}` };
      }
    }
    console.warn(`[Pipeline] ${segLabel} ${timeoutLabel || 'image'} timed out after 300s`);
    return { url: null, error: `${timeoutLabel || 'Image'} timed out after 300s` };
  }

  // Helper: generate a static image via Higgsfield and poll until done
  // Supports Soul ID (character consistency) and product reference image (Kontext i2i refinement)
  async function generateSegmentImage(seg, segLabel, characterId, productImageUrl) {
    if (seg.image_url) return { url: seg.image_url };
    const imgParams = { prompt: seg.prompt, aspect_ratio: '9:16' };
    if (characterId) {
      imgParams.custom_reference_id = characterId;
      imgParams.custom_reference_strength = 1;
    }
    const imgResult = await API.higgsfield.generateImage(imgParams);
    console.log(`[Pipeline] ${characterId ? 'Soul' : 'Flux Kontext'} image submit for ${segLabel}:`, imgResult.ok, 'id:', imgResult.id);
    if (!imgResult.ok || !imgResult.id) {
      const errDetail = imgResult.error || imgResult.message || JSON.stringify(imgResult).slice(0, 200);
      debugPanel(`[${segLabel}] Image submit failed: ${errDetail}`);
      return { url: null, error: `Image submit: ${errDetail}` };
    }
    const baseImage = await pollImageStatus(imgResult.id, segLabel, 'image');
    if (!baseImage.url) return baseImage;

    // Product refinement pass: use Flux Kontext image-to-image with the product render as reference
    if (productImageUrl) {
      debugPanel(`[${segLabel}] Refining product packaging via Kontext image-to-imageÃÂ¢ÃÂÃÂ¦`);
      console.log(`[Pipeline] ${segLabel} product refinement with reference: ${productImageUrl.slice(0, 60)}ÃÂ¢ÃÂÃÂ¦`);
      const editResult = await API.higgsfield.editImageWithProduct(
        baseImage.url,
        productImageUrl,
        `Keep this exact scene, person, pose, lighting, and background unchanged. Replace any dark bottle or generic bottle in the image with the exact Maju Black Seed Oil bottle shown in the second reference image ÃÂ¢ÃÂÃÂ match the label, shape, color, and packaging precisely. The bottle label should read "BLACK SEED OIL" with the Maju branding clearly visible.`
      );
      if (!editResult.ok || !editResult.id) {
        console.warn(`[Pipeline] ${segLabel} product edit failed, using base image:`, editResult.error);
        debugPanel(`[${segLabel}] Product edit failed (${editResult.error || 'unknown'}) ÃÂ¢ÃÂÃÂ using base image`);
        return baseImage;
      }
      const refinedImage = await pollImageStatus(editResult.id, segLabel, 'product-edit');
      if (!refinedImage.url) {
        console.warn(`[Pipeline] ${segLabel} product edit poll failed, using base image`);
        debugPanel(`[${segLabel}] Product edit timed out ÃÂ¢ÃÂÃÂ using base image`);
        return baseImage;
      }
      debugPanel(`[${segLabel}] Product packaging refined successfully`);
      return refinedImage;
    }

    return baseImage;
  }

  // Helper: animate a static image via Kling image-to-video and poll until done
  // Returns { url, error } object
  async function animateImageToVideo(seg, imageUrl, segLabel) {
    const result = await API.kling.generateFromImage({
      prompt: seg.prompt,
      image_url: imageUrl,
      duration: seg.duration <= 5 ? 5 : 10,
      aspect_ratio: '9:16',
      model_name: seg.model || 'kling-v2-master',
      mode: 'std',
    });
    console.log(`[Pipeline] Kling i2v submit for ${segLabel}:`, result.ok, 'taskId:', result.taskId);
    if (!result.ok || !result.taskId) {
      const errDetail = result.error || result.message || JSON.stringify(result).slice(0, 200);
      debugPanel(`[${segLabel}] Kling i2v submit failed: ${errDetail}`);
      return { url: null, error: `Video submit: ${errDetail}` };
    }
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      const status = await API.kling.getImageVideoStatus(result.taskId);
      const st = (status.task_status || '').toLowerCase();
      if (attempt % 5 === 0) console.log(`[Pipeline] Kling i2v ${segLabel} poll #${attempt}: status=${st}`);
      if (st === 'succeed') {
        const videos = status.task_result && status.task_result.videos;
        const url = videos && videos[0] && videos[0].url;
              console.log('[Pipeline] t2v succeed, full status:', JSON.stringify({task_status: status.task_status, has_result: !!status.task_result, result_keys: status.task_result ? Object.keys(status.task_result) : null}).substring(0, 300));
        return { url: url || null, error: url ? null : 'No video URL in result' };
      }
      if (st === 'failed') {
        return { url: null, error: `Video failed: ${status.task_status_msg || 'unknown'}` };
      }
    }
    console.warn(`[Pipeline] ${segLabel} video timed out after 600s`);
    return { url: null, error: 'Video timed out after 600s' };
  }

  // Helper: full segment pipeline ÃÂ¢ÃÂÃÂ Higgsfield image ÃÂ¢ÃÂÃÂ Kling animate (or Kling text2video fallback)
  // Returns { url, error } object
  async function generateSegmentVideo(seg, segLabel, characterId, productImageUrl) {
    // If Higgsfield key is set, use hybrid pipeline: Soul/Flux image ÃÂ¢ÃÂÃÂ Kling image2video
    if (apiKeys.higgsfield) {
      debugPanel(`[${segLabel}] Generating image via ${characterId ? 'Soul (character: ' + characterId + ')' : 'Flux Kontext Max'}${productImageUrl ? ' + product reference' : ''}ÃÂ¢ÃÂÃÂ¦`);
      const imageResult = await generateSegmentImage(seg, segLabel, characterId, productImageUrl);
      if (imageResult.url) {
        debugPanel(`[${segLabel}] Image ready ÃÂ¢ÃÂÃÂ animating via Kling image2videoÃÂ¢ÃÂÃÂ¦`);
        return await animateImageToVideo(seg, imageResult.url, segLabel);
      }
      debugPanel(`[${segLabel}] Image failed (${imageResult.error}) ÃÂ¢ÃÂÃÂ falling back to Kling text2video`);
    }

    // Fallback: Kling text-to-video (no reference image)
    const result = await API.kling.generateVideo({
      prompt: seg.prompt,
      duration: seg.duration <= 5 ? 5 : 10,
      aspect_ratio: '9:16',
      model_name: seg.model || 'kling-v2-master',
      mode: 'std',
    });
    console.log(`[Pipeline] Kling t2v submit for ${segLabel}:`, result.ok, 'taskId:', result.taskId);
    if (!result.ok || !result.taskId) {
      const errDetail = result.error || result.message || JSON.stringify(result).slice(0, 200);
      debugPanel(`[${segLabel}] Kling submit failed: ${errDetail}`);
      return { url: null, error: `Submit: ${errDetail}` };
    }
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      const status = await API.kling.getVideoStatus(result.taskId);
      const st = (status.task_status || '').toLowerCase();
      if (attempt % 5 === 0) console.log(`[Pipeline] Kling t2v ${segLabel} poll #${attempt}: status=${st}`);
      if (st === 'succeed') {
        const videos = status.task_result && status.task_result.videos;
        const url = videos && videos[0] && videos[0].url;
        return { url: url || null, error: url ? null : 'No video URL in result' };
      }
      if (st === 'failed') {
        return { url: null, error: `Video failed: ${status.task_status_msg || 'unknown'}` };
      }
    }
    console.warn(`[Pipeline] ${segLabel} timed out after 600s`);
    return { url: null, error: 'Timed out after 600s' };
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
    setStage(0, 'Generating video segments via Kling AIÃÂ¢ÃÂÃÂ¦');

    const newItems = queue.filter(q => q.pipelineStage === 'generate');
    const allSegmentVideos = []; // { url, label } for stitching

    for (const item of newItems) {
      const allSegments = (item.aiPrompt && item.aiPrompt.segments) || DEFAULT_SEGMENT_PROMPTS;
      const testMode = $('#test-mode') && $('#test-mode').checked;
      const segments = testMode ? allSegments.slice(0, 1) : allSegments;
      if (testMode) debugPanel('[Test Mode] Generating 1 segment only (hook)');

      // Generate ALL video segments in parallel via Kling (textÃÂ¢ÃÂÃÂvideo, no image step needed)
      const KLING_CONCURRENCY = 3;
      msg.textContent = `v${item.version}: Generating ${segments.length} video segments via KlingÃÂ¢ÃÂÃÂ¦`;
      updateSegmentStatus('hook', 'Generating videosÃÂ¢ÃÂÃÂ¦', false);

      let characterId = item.avatar || CONFIG.higgsfield.avatar || null;
      // Resolve legacy avatar keys to Soul UUID
      if (characterId && CONFIG.avatarMeta[characterId] === undefined && characterId === 'pateit') characterId = 'b262e935-4460-4026-980b-926aa0babdec';
      const productImageUrl = apiKeys.productImageUrl || null;
      if (characterId) console.log(`[Pipeline] Using Soul character ID: ${characterId}`);
      if (productImageUrl) console.log(`[Pipeline] Using product reference image: ${productImageUrl.slice(0, 60)}ÃÂ¢ÃÂÃÂ¦`);
      const videoTasks = segments.map((seg, si) => () => {
        updateSegmentStatus(seg.name, 'GeneratingÃÂ¢ÃÂÃÂ¦', false);
        return generateSegmentVideo(seg, `${seg.name} (${si + 1}/${segments.length})`, characterId, productImageUrl);
      });
      const videoResults = await runWithConcurrency(videoTasks, KLING_CONCURRENCY);

      // Collect results (preserve segment order)
      const segmentResults = [];
      for (let si = 0; si < segments.length; si++) {
        if (videoResults[si] && videoResults[si].url) {
          segmentResults.push({ url: videoResults[si].url, label: segments[si].name, textOverlay: segments[si].textOverlay });
          updateSegmentStatus(segments[si].name, 'Done ÃÂ¢ÃÂÃÂ', true);
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
        msg.textContent = `ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ v${item.version}: No segments rendered successfully.`;
        if (typeof fetchDebugLog === 'function') fetchDebugLog();
      }
      saveQueue();
    }

    const completedVideos = allSegmentVideos;

    // Stage 1: Auto-stitch via FFmpeg with captions
    let stitchPassed = false;
    if (completedVideos.length > 0 && (apiKeys.backendUrl || DEFAULT_BACKEND)) {
      setStage(1, `FFmpeg auto-stitching ${completedVideos.length} clips with captionsÃÂ¢ÃÂÃÂ¦`);

      const stitchOptions = {};
      const audioSel = document.getElementById('audio-select');
      if (audioSel && audioSel.value) stitchOptions.audioBg = audioSel.value;
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
            msg.textContent = `StitchingÃÂ¢ÃÂÃÂ¦ ${st.progress || 0}%`;

            if (st.status === 'done') {
              stitchDone = true;
              const dlUrl = API.backend.downloadUrl(stitchResult.jobId);
              newItems.forEach(ni => { ni.stitchJobId = stitchResult.jobId; ni.stitchedVideoUrl = dlUrl; });
              msg.textContent = 'Stitch complete!';
              stitchPassed = true;
            } else if (st.status === 'error') {
              stitchDone = true;
              msg.textContent = `ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ Stitch error: ${st.error}`;
            }
          }
        }
      } catch (err) {
        msg.textContent = `ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ Stitch error: ${err.message}`;
      }
    } else if (completedVideos.length === 0) {
      setStage(1, 'Stitch skipped ÃÂ¢ÃÂÃÂ no completed videos.');
    } else {
      setStage(1, 'Stitch skipped ÃÂ¢ÃÂÃÂ no backend URL set.');
    }

    // Audit check: only send to approval if stitch produced a real video
    if (stitchPassed && newItems[0].stitchedVideoUrl) {
      newItems.forEach(item => { item.pipelineStage = 'queue'; });
      saveQueue();
      renderQueue();
      renderTracker();
      updateBadge();
      setStage(2, 'ÃÂ¢ÃÂÃÂ Pipeline complete ÃÂ¢ÃÂÃÂ video ready for approval.');
    } else if (completedVideos.length > 0) {
      // Segments rendered but stitch failed ÃÂ¢ÃÂÃÂ keep in generate stage for retry, don't pollute approval queue
      msg.textContent = 'ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ Stitch failed ÃÂ¢ÃÂÃÂ video not sent to approval. Check backend and retry.';
      renderTracker();
      setStage(2, 'ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ Stitch failed ÃÂ¢ÃÂÃÂ not queued for approval.');
    } else {
      // Nothing rendered at all ÃÂ¢ÃÂÃÂ keep in generate stage so they don't pollute approval queue
      newItems.forEach(item => { item.pipelineStage = 'failed'; item.status = 'failed'; });
      saveQueue();
      renderTracker();
      updateBadge();
      setStage(2, 'ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ No videos generated ÃÂ¢ÃÂÃÂ check Kling API key and retry.');
    }
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Queue Rendering ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
        ${(() => {
          const vSrc = item.stitchedVideoUrl || item.videoUrl || (item.segmentVideos && item.segmentVideos[0]?.url);
          return vSrc
            ? `<div class="queue-video"><video src="${vSrc}" controls preload="auto" playsinline muted></video></div>`
            : '<div class="queue-video queue-video-placeholder"><span>Video generatingÃÂ¢ÃÂÃÂ¦</span></div>';
        })()}
        <div class="queue-info">
          <h4>${item.typeName} ÃÂ¢ÃÂÃÂ v${item.version}/${item.totalVersions}</h4>
          <p>${item.productName} ÃÂÃÂ· ${item.avatarName}</p>
          ${item.aiPrompt?.hookVariant ? `<span class="queue-hook-label">${item.aiPrompt.hookVariant}</span>` : ''}
          ${item.postMode === 'asap' ? '<p>ÃÂ°ÃÂÃÂÃÂ Post ASAP</p>' : `<p>ÃÂ°ÃÂÃÂÃÂ ${formatDate(item.schedDate)}</p>`}
          ${item.notes ? `<p>"${item.notes}"</p>` : ''}
          ${item.aiPrompt ? `<div class="ai-prompt"><strong>AI Brief:</strong> ${item.aiPrompt.reasoning || ''}<br><em>${(item.aiPrompt.direction || '').substring(0, 120)}</em></div>` : ''}
          <div class="queue-social-content">
            <label>Instagram Caption</label>
            <textarea class="caption-input" data-id="${item.id}" rows="4" placeholder="Instagram caption...">${item.instagramCaption || ''}</textarea>
            <label>Hashtags <small>(comma-separated)</small></label>
            <input class="hashtags-input" data-id="${item.id}" type="text" placeholder="blackseedoil, wellness, skincare..." value="${(item.hashtags || []).join(', ')}">
          </div>
          ${item.aiPrompt?.segments ? `<div class="queue-segments-preview"><strong>Segment Overlays:</strong> ${item.aiPrompt.segments.filter(s => s.textOverlay).map(s => `<span>${s.name}: "${s.textOverlay.replace(/\n/g, ' ')}"</span>`).join(' \u00b7 ')}</div>` : ''}
          <div class="queue-meta">
            Status: <strong>${item.status.toUpperCase()}</strong> ÃÂÃÂ·
            Created: ${formatDate(item.createdAt)}
            ${(item.revisionCount || 0) > 0 ? `<div class="revision-count">ÃÂ°ÃÂÃÂÃÂ Revision ${item.revisionCount}</div>` : ''}
          </div>
          ${(item.revisionNotes || []).length ? (item.revisionNotes || []).map((n, i) => `<div class="rejection-notes">Rev ${i + 1}: ${n}</div>`).join('') : ''}
          ${(item.approvalNotes || []).length ? (item.approvalNotes || []).map((n) => `<div class="approval-notes">Approved: ${n}</div>`).join('') : ''}
        </div>
        <div class="queue-actions">
          ${item.status === 'pending' || item.status === 'revision'
            ? `<button class="btn-approve" data-action="approve" data-id="${item.id}">ÃÂ¢ÃÂÃÂ Approve</button>
               <button class="btn-reject" data-action="reject" data-id="${item.id}">ÃÂ¢ÃÂÃÂ Reject</button>`
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Approval Modal ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Rejection Modal ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
      item.pipelineStage = 'generate'; // back to Kling for revision

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
      if (apiKeys.higgsfield) {
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Activity Feed ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
        <strong>${item.typeName}</strong> v${item.version} ÃÂ¢ÃÂÃÂ ${item.productName}
        <span style="color:var(--${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : item.status === 'revision' ? 'revision' : 'warning'})">[${item.status}]</span>
        ${item.revisionCount > 0 ? `<span style="color:var(--revision)">ÃÂ°ÃÂÃÂÃÂ ${item.revisionCount}</span>` : ''}
        <div class="activity-time">${formatDate(item.createdAt)}</div>
      </div>
    `
      )
      .join('');
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Badge ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Request Tracker ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  const PIPELINE_STAGES = [
    { key: 'generate', label: 'Generating', icon: 'ÃÂ°ÃÂÃÂÃÂ¬' },
    { key: 'stitch', label: 'Stitching', icon: 'ÃÂ°ÃÂÃÂ§ÃÂµ' },
    { key: 'queue', label: 'Awaiting Approval', icon: 'ÃÂ¢ÃÂÃÂ³' },
    { key: 'post', label: 'Posted', icon: 'ÃÂ¢ÃÂÃÂ' },
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
          <div class="tracker-stage-dot">${idx < currentStage ? 'ÃÂ¢ÃÂÃÂ' : stage.icon}</div>
          <div class="tracker-stage-label">${stage.label}</div>
        </div>`;
      }).join('<div class="tracker-stage-connector"></div>');

      const progressPct = Math.round(((currentStage + (currentStage < 3 ? 0.5 : 1)) / PIPELINE_STAGES.length) * 100);

      return `<div class="tracker-item ${isFailed ? 'tracker-failed' : ''} ${isRevision ? 'tracker-revision' : ''}">
        <div class="tracker-header">
          <div class="tracker-title">
            <strong>${item.typeName || 'Video'} ÃÂ¢ÃÂÃÂ v${item.version}/${item.totalVersions}</strong>
            <span class="tracker-meta">${item.productName} ÃÂÃÂ· ${item.avatarName}</span>
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Approved Videos ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
          <h4>${item.typeName || 'Video'} ÃÂ¢ÃÂÃÂ v${item.version}</h4>
          <p>${item.productName} ÃÂÃÂ· ${item.avatarName}</p>
          <p>${formatDate(item.createdAt)}</p>
          ${item.postMode === 'asap' ? '<p>Post ASAP</p>' : `<p>Scheduled: ${formatDate(item.schedDate)}</p>`}
          ${item.metricoolId ? '<p style="color:var(--success)">Posted to Metricool</p>' : ''}
          ${(item.approvalNotes || []).map(n => `<div class="approved-card-notes">${n}</div>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Spend Tracker ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
      const segCount = item.segmentVideos ? item.segmentVideos.length : 0
      const imageCount = 0; // Kling generates video directly, no separate image step
      const videoCount = segCount;
      const model = (segments[0] && segments[0].model) || 'kling-v2-master';
      const imageCost = 0;
      const videoCost = videoCount * (COST_ESTIMATES[model] || COST_ESTIMATES.default_video);
      const totalCost = imageCost + videoCost;

      spendRows.push({
        id: item.id,
        date: item.createdAt,
        name: `${item.typeName || 'Video'} ÃÂ¢ÃÂÃÂ v${item.version}`,
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
        <td>${r.product || 'ÃÂ¢ÃÂÃÂ'}</td>
        <td>${r.images}</td>
        <td>${r.videos}</td>
        <td>${r.model}</td>
        <td class="spend-amount">$${r.totalCost.toFixed(2)}</td>
        <td>${r.status}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Scheduled Posts (Metricool) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
        '<span class="status-dot disconnected"></span><span>Metricool: Not connected</span><a href="#" class="link-settings" data-goto="settings">Add API key ÃÂ¢ÃÂÃÂ</a>';
      listEl.innerHTML =
        '<p class="empty-state">Connect your Metricool API key in Settings to see scheduled posts.</p>';
    }
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ SOP Wiki ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ API Settings ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  // Load saved keys into form fields
  function loadApiKeys() {
    if (apiKeys.backendUrl) $('#api-backend-url').value = apiKeys.backendUrl;
    if (apiKeys.claude) $('#api-claude').value = apiKeys.claude;
    if (apiKeys.higgsfield) $('#api-higgsfield').value = apiKeys.higgsfield;
    if (apiKeys.higgsfieldSecret) $('#api-higgsfield-secret').value = apiKeys.higgsfieldSecret;
    if (apiKeys.metricool) $('#api-metricool').value = apiKeys.metricool;
    if (apiKeys.arcads) $('#api-arcads').value = apiKeys.arcads;
    if (apiKeys.creatify) $('#api-creatify').value = apiKeys.creatify;
    if (apiKeys.productImageUrl) $('#setting-product-image-url').value = apiKeys.productImageUrl;
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
          // Backend has no keys (e.g. after redeploy) ÃÂ¢ÃÂÃÂ push local keys up
          console.log('[Config] Backend empty after redeploy ÃÂ¢ÃÂÃÂ pushing local keys');
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
    } catch { /* silent fail ÃÂ¢ÃÂÃÂ localStorage still works */ }
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
      higgsfieldSecret: $('#api-higgsfield-secret').value.trim(),
      metricool: $('#api-metricool').value.trim(),
      arcads: $('#api-arcads').value.trim(),
      creatify: $('#api-creatify').value.trim(),
      productImageUrl: $('#setting-product-image-url').value.trim(),
    };
    localStorage.setItem(CONFIG.storageKeys.apiKeys, JSON.stringify(apiKeys));
    pushKeysToBackend();
    const msg = $('#save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
    renderScheduledPosts();
  loadAudioTracks();
    checkBackendStatus();

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Debounced save for queue social content edits ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  let _queueSaveTimer = null;
  const queueList = document.getElementById('queue-list');
  if (queueList) {
    queueList.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      const item = queue.find(q => q.id === id);
      if (!item) return;
      if (e.target.classList.contains('caption-input')) {
        item.instagramCaption = e.target.value;
      } else if (e.target.classList.contains('hashtags-input')) {
        item.hashtags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
      } else { return; }
      clearTimeout(_queueSaveTimer);
      _queueSaveTimer = setTimeout(() => saveQueue(), 300);
    });
  }
  });

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Helpers ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  function saveQueue() {
    localStorage.setItem(CONFIG.storageKeys.queue, JSON.stringify(queue));
  }

  function getActiveFilter() {
    const active = $('.filter-btn.active');
    return active ? active.dataset.filter : 'all';
  }

  function formatDate(str) {
    if (!str) return 'ÃÂ¢ÃÂÃÂ';
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ API Integrations (Live) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

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
    // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Higgsfield ÃÂ¢ÃÂÃÂ Static image generation with Patient Maya avatar (via proxy) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
    higgsfield: {
      async generateImage(params) {
        console.log('[Higgsfield] Soul image generation:', params);
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set ÃÂ¢ÃÂÃÂ add in Settings' };
        // Use Soul endpoint when character_id is available, otherwise fall back to Flux Kontext
        const useSoul = !!params.custom_reference_id;
        const endpoint = params.endpoint || (useSoul ? '/v1/text2image/soul' : 'flux-pro/kontext/max/text-to-image');
        // V1 Soul API requires width_and_height instead of aspect_ratio
        const AR_TO_WH = { '9:16': '768x1344', '16:9': '1344x768', '1:1': '1024x1024', '4:5': '896x1120', '5:4': '1120x896' };
        const sizeField = useSoul
          ? { width_and_height: AR_TO_WH[params.aspect_ratio || '9:16'] || '768x1344' }
          : { aspect_ratio: params.aspect_ratio || '9:16' };
        const body = {
          endpoint,
          input: {
            prompt: params.prompt || '',
            ...sizeField,
          },
        };
        if (params.custom_reference_id) {
          body.input.custom_reference_id = params.custom_reference_id;
          body.input.custom_reference_strength = params.custom_reference_strength || 1;
          body.input.soul_style_id = params.soul_style_id || '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe';
        }
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
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

      // Flux Kontext Max image-to-image: refine a generated image using a product reference photo
      async editImageWithProduct(generatedImageUrl, productImageUrl, prompt) {
        console.log('[Higgsfield] Product refinement via Kontext image-to-image');
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set' };
        const body = {
          endpoint: 'flux-pro/kontext/max/image-to-image',
          input: {
            prompt: prompt || 'Replace the bottle in this image with the exact product bottle shown in the second reference image. Keep the person, pose, lighting, and background exactly the same.',
            input_image: generatedImageUrl,
            input_image_2: productImageUrl,
            aspect_ratio: '9:16',
          },
        };
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          console.log('[Higgsfield] Product edit response:', data);
          return { ok: res.ok, id: data.request_id || data.id, ...data };
        } catch (err) {
          console.error('[Higgsfield] Product edit error:', err);
          return { ok: false, error: err.message };
        }
      },

      async listSoulIds() {
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set', items: [] };
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/soul-ids'), {
            headers: { 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
          });
          const data = await res.json();
          console.log('[Higgsfield] Soul IDs:', data);
          return { ok: res.ok, items: Array.isArray(data) ? data : (data.items || data.data || []), ...data };
        } catch (err) {
          console.error('[Higgsfield] listSoulIds error:', err);
          return { ok: false, error: err.message, items: [] };
        }
      },

      async getImageStatus(requestId) {
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/higgsfield/status/${encodeURIComponent(requestId)}`), {
            headers: { 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
          });
          const data = await res.json();
          const imageUrl = (data.output && data.output.images && data.output.images[0]?.url) || data.images?.[0]?.url || data.url;
          const normalizedStatus = (data.status || '').toLowerCase();
          return { ok: res.ok, status: normalizedStatus, url: imageUrl, ...data };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
    },

    // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Kling AI ÃÂ¢ÃÂÃÂ Video generation (via Higgsfield platform proxy) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
    // Higgsfield provides Kling access through their API ÃÂ¢ÃÂÃÂ same credentials
    // Endpoint pattern: kling-video/{version}/{tier}/{mode}
    kling: {
      async generateVideo(params) {
        console.log('[Kling via Higgsfield] Generate video:', params);
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set ÃÂ¢ÃÂÃÂ add in Settings (Kling runs via Higgsfield)' };
        const endpoint = params.endpoint || 'kling-video/v2.1/master/text-to-video';
        const body = {
          endpoint,
          input: {
            prompt: params.prompt || '',
            aspect_ratio: params.aspect_ratio || '9:16',
            duration: parseInt(params.duration) || 5,
          },
        };
        if (params.negative_prompt) body.input.negative_prompt = params.negative_prompt;
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          console.log('[Kling via Higgsfield] Generate response:', data);
          const taskId = data.request_id || data.id || (data.data && data.data.task_id);
          return { ok: res.ok, taskId, ...data };
        } catch (err) {
          console.error('[Kling via Higgsfield] Error:', err);
          return { ok: false, error: err.message };
        }
      },

      async getVideoStatus(taskId) {
        if (!apiKeys.higgsfield) return { task_status: 'failed', task_status_msg: 'No Higgsfield API key' };
        try {
          const res = await fetch(backendUrl(`/api/proxy/higgsfield/status/${encodeURIComponent(taskId)}`), {
            headers: { 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
          });
          const data = await res.json();
          const st = (data.status || '').toLowerCase();
          const videoUrl = (data.output && data.output.video_url) || (data.output && data.output.video && data.output.video.url) || (data.output && data.output.url) || (data.video && data.video.url) || data.video_url || (data.images && data.images[0] && data.images[0].url) || data.url || (data.jobs && data.jobs[0] && data.jobs[0].results && (data.jobs[0].results.raw && data.jobs[0].results.raw.url || data.jobs[0].results.min && data.jobs[0].results.min.url)) || (data.result && data.result.videos && data.result.videos[0] && data.result.videos[0].url);
          if ((st === 'completed' || st === 'done' || st === 'succeed') && !videoUrl) { console.warn('[Kling getVideoStatus] Completed but no videoUrl! Keys:', Object.keys(data), 'output keys:', data.output ? Object.keys(data.output) : 'no output', JSON.stringify(data).substring(0, 500)); }
          return {
            task_status: st === 'completed' || st === 'done' ? 'succeed' : st,
            task_status_msg: data.message || '',
            task_result: videoUrl ? { videos: [{ url: videoUrl }] } : null,
            ...data,
          };
        } catch (err) {
          return { task_status: 'failed', task_status_msg: err.message };
        }
      },

      async generateFromImage(params) {
        console.log('[Kling via Higgsfield] Image-to-video:', params);
        if (!apiKeys.higgsfield) return { ok: false, error: 'No Higgsfield API key set ÃÂ¢ÃÂÃÂ add in Settings' };
        const endpoint = params.endpoint || 'kling-video/v2.1/master/image-to-video';
        const body = {
          endpoint,
          input: {
            image_url: params.image_url,
            prompt: params.prompt || '',
            aspect_ratio: params.aspect_ratio || '9:16',
            duration: parseInt(params.duration) || 5,
          },
        };
        if (params.negative_prompt) body.input.negative_prompt = params.negative_prompt;
        try {
          const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key-value': apiKeys.higgsfield, 'x-api-secret-value': apiKeys.higgsfieldSecret || '' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          console.log('[Kling via Higgsfield] Image-to-video response:', data);
          const taskId = data.request_id || data.id || (data.data && data.data.task_id);
          return { ok: res.ok, taskId, ...data };
        } catch (err) {
          console.error('[Kling via Higgsfield] Image-to-video error:', err);
          return { ok: false, error: err.message };
        }
      },

      async getImageVideoStatus(taskId) {
        return this.getVideoStatus(taskId);
      },

      async reviseVideo(videoId, notes) {
        return this.generateVideo({
          prompt: `Revision ÃÂ¢ÃÂÃÂ feedback: ${notes}`,
        });
      },
    },

    // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Metricool ÃÂ¢ÃÂÃÂ Social scheduling & analytics (via proxy) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

    // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Arcads ÃÂ¢ÃÂÃÂ UGC-style ad video generation (via proxy) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

    // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Creatify ÃÂ¢ÃÂÃÂ AI product video generation (via proxy) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

    // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Backend ÃÂ¢ÃÂÃÂ FFmpeg stitching server ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Debug Panel (visible on page, no F12 needed) ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Backend Status Check ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  async function checkBackendStatus(retries = 3) {
    const el = $('#backend-status');
    el.innerHTML = '<span class="status-dot connecting"></span><span>Backend: ConnectingÃÂ¢ÃÂÃÂ¦</span>';

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
          el.innerHTML = `<span class="status-dot connecting"></span><span>Backend: Waking upÃÂ¢ÃÂÃÂ¦ (attempt ${i + 2}/${retries})</span>`;
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
    el.innerHTML = '<span class="status-dot disconnected"></span><span>Backend: Not connected ÃÂ¢ÃÂÃÂ set your backend URL in <a href="#" data-goto="settings">Settings</a></span>';
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Auto-Stitch Segment Status Updates ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  // Called by the pipeline to update segment status in the stitch panel
  function updateSegmentStatus(segment, statusText, isReady) {
    const el = $(`#seg-${segment}`);
    if (el) {
      el.textContent = statusText;
      if (isReady) el.classList.add('ready');
    }
  }
  window.updateSegmentStatus = updateSegmentStatus;

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Live Metricool Scheduled Posts ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  async function fetchScheduledPosts() {
    const statusEl = $('#metricool-status');
    const listEl = $('#scheduled-list');

    if (!apiKeys.metricool) return;

    statusEl.innerHTML = '<span class="status-dot connected"></span><span>Metricool: FetchingÃÂ¢ÃÂÃÂ¦</span>';

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
      statusEl.innerHTML = `<span class="status-dot disconnected"></span><span>Metricool: Error ÃÂ¢ÃÂÃÂ ${result.error}</span>`;
    }
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Analytics View ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

  async function loadAnalytics() {
    if (!apiKeys.metricool) {
      $('#analytics-status').innerHTML =
        '<span class="status-dot disconnected"></span><span>Metricool: Not connected</span><a href="#" class="link-settings" data-goto="settings">Add API key ÃÂ¢ÃÂÃÂ</a>';
      return;
    }

    $('#analytics-status').innerHTML =
      '<span class="status-dot connected"></span><span>Metricool: Loading analyticsÃÂ¢ÃÂÃÂ¦</span>';

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
            ${post.network || post.platform || ''} ÃÂÃÂ· ${post.publicationDate || post.date || ''}
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
    if (n == null) return 'ÃÂ¢ÃÂÃÂ';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  // Analytics is loaded lazily ÃÂ¢ÃÂÃÂ triggered from nav click handler below

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Wire Approve ÃÂ¢ÃÂÃÂ Metricool Post ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  function scheduleApprovedItem(item) {
    if (!apiKeys.metricool) {
      console.log('[Metricool] No API key ÃÂ¢ÃÂÃÂ skip scheduling');
      return;
    }
    const caption = item.instagramCaption || `${item.productName} ÃÂ¢ÃÂÃÂ ${item.typeName}`;
    const tags = (item.hashtags || []).map(t => `#${t.replace(/^#/, '')}`).join(' ');
    const fullContent = tags ? `${caption}\n\n${tags}` : caption;
    const videoSrc = item.stitchedVideoUrl || item.videoUrl;
    const postParams = {
      content: fullContent,
      networks: [{ network: 'instagram', type: 'reels' }],
      media: videoSrc ? [{ url: videoSrc, type: 'video' }] : [],
      publicationDate: item.schedDate
        ? { dateTime: item.schedDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        : undefined,
    };
    console.log('[Metricool] Scheduling Instagram Reel:', { content: fullContent.substring(0, 80) + '...', hasVideo: !!videoSrc });
    return API.metricool.schedulePost(postParams).then((res) => {
      if (res.ok) {
        console.log('[Metricool] Post scheduled:', res);
        item.metricoolId = res.postId || res.id;
        saveQueue();
      } else {
        console.warn('[Metricool] Schedule failed:', res);
      }
      return res;
    }).catch(err => {
      console.error('[Metricool] Error scheduling:', err);
    });
  }

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Init ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Audio / Music Management ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  async function loadAudioTracks() {
    const select = document.getElementById('audio-select');
    if (!select) return;
    try {
      const res = await fetch(backendUrl('/api/audio/list'));
      const data = await res.json();
      const tracks = data.tracks || [];
      // Preserve current selection
      const current = select.value;
      select.innerHTML = '<option value="">No music (silent)</option>';
      tracks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.filename;
        opt.textContent = `${t.filename} (${(t.size / 1024).toFixed(0)} KB)`;
        select.appendChild(opt);
      });
      if (current) select.value = current;
      // Show/hide preview + delete buttons
      const previewBtn = document.getElementById('audio-preview-btn');
      const deleteBtn = document.getElementById('audio-delete-btn');
      if (previewBtn) previewBtn.style.display = select.value ? '' : 'none';
      if (deleteBtn) deleteBtn.style.display = select.value ? '' : 'none';
    } catch (err) {
      console.log('[Audio] Could not load tracks:', err.message);
    }
  }

  // Upload handler
  const audioUploadInput = document.getElementById('audio-upload');
  if (audioUploadInput) {
    audioUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const hint = document.getElementById('audio-hint');
      if (hint) hint.textContent = `Uploading ${file.name}ÃÂ¢ÃÂÃÂ¦`;
      const form = new FormData();
      form.append('audio', file);
      try {
        const res = await fetch(backendUrl('/api/audio/upload'), { method: 'POST', body: form });
        const data = await res.json();
        if (data.ok) {
          if (hint) hint.textContent = `ÃÂ¢ÃÂÃÂ Uploaded ${data.filename} ÃÂ¢ÃÂÃÂ saved for future reels.`;
          await loadAudioTracks();
          document.getElementById('audio-select').value = data.filename;
          document.getElementById('audio-preview-btn').style.display = '';
          document.getElementById('audio-delete-btn').style.display = '';
        } else {
          if (hint) hint.textContent = `Upload failed: ${data.error}`;
        }
      } catch (err) {
        if (hint) hint.textContent = `Upload error: ${err.message}`;
      }
      audioUploadInput.value = '';
    });
  }

  // Select change ÃÂ¢ÃÂÃÂ show/hide buttons
  const audioSelect = document.getElementById('audio-select');
  if (audioSelect) {
    audioSelect.addEventListener('change', () => {
      const previewBtn = document.getElementById('audio-preview-btn');
      const deleteBtn = document.getElementById('audio-delete-btn');
      const player = document.getElementById('audio-player');
      if (previewBtn) previewBtn.style.display = audioSelect.value ? '' : 'none';
      if (deleteBtn) deleteBtn.style.display = audioSelect.value ? '' : 'none';
      if (player) { player.style.display = 'none'; player.pause(); }
    });
  }

  // Preview
  const audioPreviewBtn = document.getElementById('audio-preview-btn');
  if (audioPreviewBtn) {
    audioPreviewBtn.addEventListener('click', () => {
      const player = document.getElementById('audio-player');
      const sel = document.getElementById('audio-select');
      if (!player || !sel || !sel.value) return;
      player.src = backendUrl(`/audio/${encodeURIComponent(sel.value)}`);
      player.style.display = '';
      player.play();
    });
  }

  // Delete
  const audioDeleteBtn = document.getElementById('audio-delete-btn');
  if (audioDeleteBtn) {
    audioDeleteBtn.addEventListener('click', async () => {
      const sel = document.getElementById('audio-select');
      if (!sel || !sel.value) return;
      if (!confirm(`Delete "${sel.value}"?`)) return;
      try {
        await fetch(backendUrl(`/api/audio/${encodeURIComponent(sel.value)}`), { method: 'DELETE' });
        await loadAudioTracks();
        document.getElementById('audio-player').style.display = 'none';
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    });
  }
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
  loadAudioTracks();
  checkBackendStatus();

  // Fetch live scheduled posts if Metricool key is set
  if (apiKeys.metricool) fetchScheduledPosts();
})();
