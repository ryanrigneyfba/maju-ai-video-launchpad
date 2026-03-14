'use strict';

// Higgsfield image generation — Nano Banana Pro ONLY (vault HARD RULE #8)
// Endpoint: nano-banana-pro via MAJU proxy /api/proxy/higgsfield/generate
// Soul injection for Patient Maya (clip1Start) and MajuBottle (clip2End)
// Poll via /api/proxy/higgsfield/status/:requestId

const { fetchJSON, poll } = require('./http');
const { getKey, MAJU_SERVER, IMAGE_TIMEOUT } = require('../config');

// Soul IDs — must match vault definitions exactly
const SOUL_IDS = {
  patientMaya: '6bceded1-e872-41d7-824b-8476faf87fa4',
  majuBottle:  'b360f0d3-51f4-4801-85e7-be9adacc6a47',
};

// Style ID for Nano Banana Pro soul generation (from fnf-patch.js)
const NBP_STYLE_ID = '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe';

function proxyHeaders() {
  return {
    'Content-Type':       'application/json',
    'x-api-key-value':    getKey('higgsFieldApiKey'),
    'x-api-secret-value': getKey('higgsFieldApiSecret'),
  };
}

// ─── Generate frame with Nano Banana Pro ────────────────────────────────────
// soulId: inject soul character into the frame (Patient Maya or MajuBottle)
async function generateFrame(prompt, soulId = null) {
  const input = {
    prompt:    soulId ? `<<<${soulId}>>> ${prompt}` : prompt,
    quality:   '1k',
    batch_size: 1,
    width:     1152,
    height:    2048,
  };

  if (soulId) {
    input.custom_reference_id       = soulId;
    input.custom_reference_strength = 0.9;
    input.style_id                  = NBP_STYLE_ID;
    input.style_strength            = 0.6;
  }

  const data = await fetchJSON(`${MAJU_SERVER}/api/proxy/higgsfield/generate`, {
    method:  'POST',
    headers: proxyHeaders(),
    body: JSON.stringify({
      endpoint: 'nano-banana-pro',
      input,
    }),
  });

  const requestId = data?.request_id || data?.id;
  if (!requestId) throw new Error(`nano-banana-pro returned no request_id: ${JSON.stringify(data)}`);
  return requestId;
}

// ─── Poll for image result ────────────────────────────────────────────────────
async function pollFrame(requestId, timeoutMs = IMAGE_TIMEOUT) {
  return poll(
    `${MAJU_SERVER}/api/proxy/higgsfield/status/${encodeURIComponent(requestId)}`,
    { headers: proxyHeaders() },
    (data) => {
      const status = (data?.status || '').toLowerCase();
      if (status === 'failed' || status === 'error') {
        throw new Error(`Nano Banana Pro frame failed: ${JSON.stringify(data)}`);
      }
      if (status === 'completed' || status === 'ready' || status === 'succeeded') {
        const url = data?.images?.[0]?.url
          || data?.result?.sample
          || data?.result?.url
          || data?.output?.[0];
        if (url) return url;
      }
      return null;
    },
    timeoutMs,
  );
}

module.exports = { generateFrame, pollFrame, SOUL_IDS };
