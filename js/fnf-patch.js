/**
 * FNF Patch - Runtime override for Higgsfield Soul generation
 * Patches the app to use fnf.higgsfield.ai internal API instead of platform API
 * Must be loaded AFTER app.js
 */
(function() {
  'use strict';
  
  const FNF_SOUL_ID = '6bceded1-e872-41d7-824b-8476faf87fa4';
  const OLD_SOUL_ID = 'b262e935-4460-4026-980b-926aa0babdec';
  const REALISTIC_STYLE = '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe';

  function backendUrl(path) {
    const keys = JSON.parse(localStorage.getItem('maju_api_keys') || '{}');
    const base = keys.backendUrl || '';
    return base + path;
  }

  // --- Patch CONFIG soul IDs ---
  function patchConfig() {
    if (typeof CONFIG !== 'undefined') {
      if (CONFIG.higgsfield) CONFIG.higgsfield.avatar = FNF_SOUL_ID;
      if (CONFIG.avatarMeta) {
        const old = CONFIG.avatarMeta[OLD_SOUL_ID];
        if (old && !CONFIG.avatarMeta[FNF_SOUL_ID]) {
          CONFIG.avatarMeta[FNF_SOUL_ID] = old;
        }
      }
    }
    // Patch avatar dropdown
    document.querySelectorAll('select option').forEach(function(opt) {
      if (opt.value === OLD_SOUL_ID) opt.value = FNF_SOUL_ID;
    });
  }

  // --- FNF Soul generateImage ---
  async function fnfGenerateImage(params) {
    console.log('[FNF-Patch] Image generation:', params);
    const useSoul = !!params.custom_reference_id;
    if (useSoul) {
      try {
        const sr = await fetch(backendUrl('/api/jwt-status'));
        const sd = await sr.json();
        if (!sd.valid) {
          return { ok: false, error: 'No valid Higgsfield session. Run bookmarklet on higgsfield.ai first.', needsToken: true };
        }
      } catch (e) { console.warn('[FNF-Patch] JWT check failed:', e); }
      const soulId = params.custom_reference_id;
      const body = {
        params: {
          prompt: '<<<' + soulId + '>>> ' + (params.prompt || ''),
          quality: '1080p',
          aspect_ratio: params.aspect_ratio || '9:16',
          enhance_prompt: true,
          style_id: params.soul_style_id || REALISTIC_STYLE,
          style_strength: 0.6,
          custom_reference_id: soulId,
          custom_reference_strength: params.custom_reference_strength || 0.9,
          seed: Math.floor(Math.random() * 1000000),
          width: 1152, height: 2048, steps: 50, batch_size: 1,
          sample_shift: 4, sample_guide_scale: 4,
          negative_prompt: '', version: 3,
          fashion_factory_id: null, use_unlim: false
        }
      };
      try {
        const res = await fetch(backendUrl('/api/proxy/higgsfield/fnf-generate'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'FNF generation failed', needsToken: data.needsToken };
        return { ok: true, id: data.id, jobSetId: data.id, fnf: true, ...data };
      } catch (err) { return { ok: false, error: err.message }; }
    }
    // Non-soul: use standard platform API
    const keys = JSON.parse(localStorage.getItem('maju_api_keys') || '{}');
    if (!keys.higgsfield) return { ok: false, error: 'No Higgsfield API key set' };
    const endpoint = params.endpoint || 'flux-pro/kontext/max/text-to-image';
    const body = { endpoint: endpoint, input: { prompt: params.prompt || '', aspect_ratio: params.aspect_ratio || '9:16' } };
    try {
      const res = await fetch(backendUrl('/api/proxy/higgsfield/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key-value': keys.higgsfield, 'x-api-secret-value': keys.higgsfieldSecret || '' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return { ok: res.ok, id: data.request_id || data.id, ...data };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  // --- FNF Job-Set Polling ---
  async function fnfPollJobSet(jobSetId) {
    try {
      const res = await fetch(backendUrl('/api/proxy/higgsfield/fnf-job-set/' + jobSetId));
      const data = await res.json();
      if (!res.ok) return { done: false, error: data.error || 'Poll failed' };
      const status = data.status || (data.jobs && data.jobs[0] && data.jobs[0].status);
      if (status === 'completed' || status === 'done') {
        const url = data.jobs && data.jobs[0] && data.jobs[0].result && data.jobs[0].result.url;
        return { done: true, status: 'completed', url: url, data: data };
      }
      if (status === 'failed' || status === 'error') {
        return { done: true, status: 'failed', error: 'Generation failed', data: data };
      }
      return { done: false, status: status || 'processing', data: data };
    } catch (err) { return { done: false, error: err.message }; }
  }

  // --- Apply patches when app is ready ---
  function applyPatches() {
    patchConfig();
    // Expose for app.js to use
    window.__fnfGenerateImage = fnfGenerateImage;
    window.__fnfPollJobSet = fnfPollJobSet;
    window.__FNF_SOUL_ID = FNF_SOUL_ID;
    window.__FNF_PATCHED = true;
    console.log('[FNF-Patch] Patches applied. Soul ID:', FNF_SOUL_ID);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPatches);
  } else {
    applyPatches();
  }
})();
