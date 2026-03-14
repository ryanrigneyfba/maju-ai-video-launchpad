'use strict';

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
    'Content-Type':      'application/json',
    'x-api-key-value':   getKey('higgsFieldApiKey'),
    'x-api-secret-value': getKey('higgsFieldApiSecret'),
  };
}

async function generateClip(startImageUrl, endImageUrl, prompt) {
  const data = await fetchJSON(`${MAJU_SERVER}/api/proxy/kling/image2video`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      model_name:      'kling-v2-master',
      image:           startImageUrl,
      tail_image_url:  endImageUrl,
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      duration:        '6',
      aspect_ratio:    '9:16',
      mode:            'std',
    }),
  });

  const taskId = data?.data?.task_id || data?.task_id || data?.taskId;
  if (!taskId) throw new Error(`Kling returned no task ID: ${JSON.stringify(data)}`);
  return taskId;
}

async function pollClip(taskId) {
  return poll(
    `${MAJU_SERVER}/api/proxy/kling/image2video/${taskId}`,
    { headers: headers() },
    (data) => {
      const status = (
        data?.data?.task_status ||
        data?.task_status || ''
      ).toLowerCase();

      if (status === 'failed') {
        throw new Error(`Kling task failed: ${data?.data?.task_status_msg || 'unknown'}`);
      }
      if (status === 'succeed') {
        const videos = data?.data?.task_result?.videos || [];
        const url = videos[0]?.url;
        if (!url) throw new Error('Kling succeeded but no video URL in response');
        return url;
      }
      return null;
    },
    VIDEO_TIMEOUT,
  );
}

module.exports = { generateClip, pollClip };
