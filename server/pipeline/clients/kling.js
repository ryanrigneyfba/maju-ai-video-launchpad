'use strict';

// Kling video generation via Higgsfield proxy
// Uses kling-video/v2.1/master/image-to-video through /api/proxy/higgsfield/generate
// Polling via /api/proxy/higgsfield/status/:requestId (same pattern as image gen)

const { fetchJSON, poll } = require('./http');
const { getKey, MAJU_SERVER, VIDEO_TIMEOUT } = require('../config');

const NEGATIVE_PROMPT = [
  'third-person camera', 'outside perspective', 'full animal body visible',
  'transition', 'cut', 'morph', 'zoom', 'pan', 'tilt', 'rotation',
  'text overlay', 'watermark', 'logo', 'blur', 'distortion',
  'low quality', 'duplicate', 'ugly',
].join(', ');

function headers() {
  return {
    'Content-Type':       'application/json',
    'x-api-key-value':    getKey('higgsFieldApiKey'),
    'x-api-secret-value': getKey('higgsFieldApiSecret'),
  };
}

async function generateClip(startImageUrl, endImageUrl, prompt) {
  const data = await fetchJSON(`${MAJU_SERVER}/api/proxy/higgsfield/generate`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      endpoint: 'kling-video/v2.1/master/image-to-video',
      input: {
        image_url:       startImageUrl,
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        duration:        5,
        aspect_ratio:    '9:16',
      },
    }),
  });

  const requestId = data?.request_id || data?.id;
  if (!requestId) throw new Error(`Kling returned no request_id: ${JSON.stringify(data)}`);
  return requestId;
}

async function pollClip(requestId, timeoutMs = VIDEO_TIMEOUT) {
  return poll(
    `${MAJU_SERVER}/api/proxy/higgsfield/status/${encodeURIComponent(requestId)}`,
    { headers: headers() },
    (data) => {
      const status = (data?.status || '').toLowerCase();
      if (status === 'failed' || status === 'error') {
        throw new Error(`Kling job failed: ${JSON.stringify(data)}`);
      }
      if (status === 'completed' || status === 'ready' || status === 'succeeded') {
        // Kling returns video URL in different shapes
        const url = data?.video?.url
          || data?.videos?.[0]?.url
          || data?.result?.video_url
          || data?.output?.[0];
        if (url) return url;
      }
      return null;
    },
    timeoutMs,
  );
}

module.exports = { generateClip, pollClip };
