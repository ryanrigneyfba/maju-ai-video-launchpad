/**
 * FNF Patch v1.1 - Runtime override for Higgsfield Soul generation
 * Monkey-patches MAJU_API.higgsfield to use fnf.higgsfield.ai internal API
 * Must be loaded AFTER app.js
 */
(function() {
  'use strict';

  const FNF_SOUL_ID = '6bceded1-e872-41d7-824b-8476faf87fa4';
  const OLD_SOUL_ID = 'b262e935-4460-4026-980b-926aa0babdec';
  const REALISTIC_STYLE = '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe';

  function backendUrl(path) {
    const keys = JSON.parse(localStorage.getItem('maju_api_keys') || '{}');
    return (keys.backendUrl || '') + path;
  }

  // --- FNF Soul generateImage ---
  function fnfGenerateImage(params) {
    console.log('[FNF-Patch] generateImage called:', params);
    var useSoul = !!params.custom_reference_id;
    if (useSoul) {
      return fetch(backendUrl('/api/jwt-status'))
        .then(function(sr) { return sr.json(); })
        .then(function(sd) {
          if (!sd.valid) {
            return { ok: false, error: 'No valid Higgsfield session. Run bookmarklet on higgsfield.ai first.', needsToken: true };
          }
          var soulId = params.custom_reference_id;
          var body = {
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
          return fetch(backendUrl('/api/proxy/higgsfield/fnf-generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }).then(function(res) {
            return res.json().then(function(data) {
              if (!res.ok) return { ok: false, error: data.error || 'FNF generation failed', needsToken: data.needsToken };
              console.log('[FNF-Patch] Generation started:', data.id);
              return { ok: true, id: data.id, jobSetId: data.id, fnf: true, request_id: data.id };
            });
          });
        })
        .catch(function(err) { return { ok: false, error: err.message }; });
    }
    // Non-soul: use original platform API
    return fnfGenerateImage._original.call(this, params);
  }

  // --- FNF Job-Set Polling (overrides getImageStatus) ---
  function fnfGetImageStatus(id) {
    // Check if this is an FNF job by trying fnf endpoint first
    return fetch(backendUrl('/api/proxy/higgsfield/fnf-job-set/' + id))
      .then(function(res) {
        if (!res.ok) {
          // Fall back to original polling for non-FNF jobs
          if (fnfGetImageStatus._original) {
            return fnfGetImageStatus._original.call(this, id);
          }
          return { status: 'error', error: 'Poll failed' };
        }
        return res.json().then(function(data) {
          var job = data.jobs && data.jobs[0];
          var status = job ? job.status : data.status;
          if (status === 'completed' || status === 'done') {
            var url = job && job.result && job.result.url;
            console.log('[FNF-Patch] Job completed, image:', url);
            return { status: 'completed', url: url, output: { url: url }, data: data };
          }
          if (status === 'failed' || status === 'error') {
            return { status: 'failed', error: 'Generation failed' };
          }
          return { status: status || 'processing' };
        });
      })
      .catch(function(err) {
        // Fall back to original
        if (fnfGetImageStatus._original) {
          return fnfGetImageStatus._original.call(this, id);
        }
        return { status: 'error', error: err.message };
      });
  }

  // --- Patch CONFIG soul IDs ---
  function patchConfig() {
    if (typeof CONFIG !== 'undefined') {
      if (CONFIG.higgsfield) CONFIG.higgsfield.avatar = FNF_SOUL_ID;
      if (CONFIG.avatarMeta) {
        var old = CONFIG.avatarMeta[OLD_SOUL_ID];
        if (old && !CONFIG.avatarMeta[FNF_SOUL_ID]) {
          CONFIG.avatarMeta[FNF_SOUL_ID] = old;
        }
      }
    }
    document.querySelectorAll('select option').forEach(function(opt) {
      if (opt.value === OLD_SOUL_ID) opt.value = FNF_SOUL_ID;
    });
  }

  // --- Apply monkey-patches ---
  function applyPatches() {
    patchConfig();

    if (typeof MAJU_API !== 'undefined' && MAJU_API.higgsfield) {
      // Save originals
      fnfGenerateImage._original = MAJU_API.higgsfield.generateImage;
      fnfGetImageStatus._original = MAJU_API.higgsfield.getImageStatus;

      // Override
      MAJU_API.higgsfield.generateImage = fnfGenerateImage;
      MAJU_API.higgsfield.getImageStatus = fnfGetImageStatus;

      console.log('[FNF-Patch] MAJU_API.higgsfield patched successfully');
      console.log('[FNF-Patch] Soul ID:', FNF_SOUL_ID);
    } else {
      console.warn('[FNF-Patch] MAJU_API.higgsfield not found, retrying in 500ms...');
      setTimeout(applyPatches, 500);
      return;
    }

    window.__FNF_PATCHED = true;
    window.__FNF_SOUL_ID = FNF_SOUL_ID;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(applyPatches, 100); });
  } else {
    setTimeout(applyPatches, 100);
  }
})();
