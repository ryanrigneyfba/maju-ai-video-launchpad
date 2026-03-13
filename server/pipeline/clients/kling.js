/**
 * Kling AI client — image-to-video generation.
 * Calls through the MAJU backend proxy which handles JWT generation.
 */
const { request, poll } = require('./http');
const { getKey, KLING_NEGATIVE_PROMPT } = require('../config');

function authHeaders() {
  return {
    'x-api-key-value': getKey('klingAccessKey'),
    'x-api-secret-value': getKey('klingSecretKey'),
  };
}

/**
 * Submit an image-to-video job.
 * @param {object} params
 * @param {string} params.imageUrl - Start frame image URL
 * @param {string} params.prompt - Animation prompt
 * @param {string} [params.tailImageUrl] - End frame image URL (optional)
 * @returns {Promise<{taskId: string}>}
 */
async function submitImage2Video(params) {
  const body = {
    model_name: 'kling-v2-master',
    mode: 'std',
    duration: '5',
    aspect_ratio: '9:16',
    image: params.imageUrl,
    prompt: params.prompt,
    negative_prompt: KLING_NEGATIVE_PROMPT,
  };

  if (params.tailImageUrl) {
    body.image_tail = params.tailImageUrl;
  }

  const result = await request('/api/proxy/kling/image2video', 'POST', authHeaders(), body);

  if (result.status !== 200) {
    throw new Error(`Kling submit error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }

  // Kling API returns { code: 0, data: { task_id: "..." } }
  const taskId = result.data?.data?.task_id || result.data?.task_id;
  if (!taskId) {
    throw new Error(`Kling did not return task_id: ${JSON.stringify(result.data).slice(0, 200)}`);
  }

  return { taskId };
}

/**
 * Poll a task until the video is ready.
 */
async function pollTask(taskId) {
  const result = await poll(`/api/proxy/kling/image2video/${taskId}`, authHeaders(), {
    intervalMs: 3000,
    maxAttempts: 200,
    label: 'kling',
    check: (res) => {
      if (res.status !== 200) return false;
      const task = res.data?.data;
      if (!task) return false;
      if (task.task_status === 'failed') {
        throw new Error(`Kling task failed: ${task.task_status_msg || 'unknown'}`);
      }
      return task.task_status === 'succeed' && task.task_result?.videos?.length > 0;
    },
  });

  const videos = result.data.data.task_result.videos;
  return {
    url: videos[0].url,
    duration: videos[0].duration,
    taskId,
  };
}

/**
 * Generate a video clip from start frame + prompt.
 * Optionally accepts an end frame for guided animation.
 */
async function generateClip(imageUrl, prompt, tailImageUrl = null) {
  const { taskId } = await submitImage2Video({ imageUrl, prompt, tailImageUrl });
  return pollTask(taskId);
}

module.exports = { submitImage2Video, pollTask, generateClip };
