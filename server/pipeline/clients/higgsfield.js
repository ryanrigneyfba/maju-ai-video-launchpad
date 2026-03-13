/**
 * Higgsfield FNF client — static image generation via Soul system.
 * Uses the JWT token bridge (bookmarklet must have been run on higgsfield.ai).
 */
const { request, poll } = require('./http');
const { SOUL_IDS } = require('../config');

/**
 * Submit a static image generation job.
 * @param {object} params
 * @param {string} params.prompt - Full prompt text
 * @param {string|null} params.customReferenceId - Soul custom reference ID
 * @returns {Promise<{id: string}>}
 */
async function submitGenerate(params) {
  const result = await request('/api/proxy/higgsfield/fnf-generate', 'POST', {}, {
    params: {
      prompt: params.prompt,
      quality: '1080p',
      aspect_ratio: '9:16',
      enhance_prompt: false, // prompts are pre-optimized
      custom_reference_id: params.customReferenceId || null,
      custom_reference_strength: 0.9,
      width: 1152,
      height: 2048,
      steps: 50,
      batch_size: 1,
      seed: Math.floor(Math.random() * 1000000),
      version: 3,
    },
  });

  if (result.status === 401) {
    throw new Error('Higgsfield JWT expired. Run the bookmarklet on higgsfield.ai first.');
  }
  if (result.status !== 200 || !result.data.id) {
    throw new Error(`Higgsfield generate error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }

  return { id: result.data.id };
}

/**
 * Poll a job set until all images are ready.
 */
async function pollJobSet(jobSetId) {
  const result = await poll(`/api/proxy/higgsfield/fnf-job-set/${jobSetId}`, {}, {
    intervalMs: 2000,
    maxAttempts: 150,
    label: 'higgsfield',
    check: (res) => {
      if (res.status !== 200) return false;
      const jobs = res.data.jobs || [];
      if (jobs.length === 0) return false;
      // Check if all jobs are done
      return jobs.every(j => j.status === 'done' || j.status === 'completed' || j.result_url);
    },
  });

  const jobs = result.data.jobs || [];
  const images = jobs
    .filter(j => j.result_url)
    .map(j => ({ url: j.result_url, jobId: j.id }));

  if (images.length === 0) {
    throw new Error('Higgsfield generation completed but no images returned');
  }

  return images;
}

/**
 * Generate a single static frame with the appropriate Soul reference.
 * @param {string} prompt
 * @param {'person'|'product'|null} soulType - which Soul reference to use
 */
async function generateFrame(prompt, soulType = null) {
  const customReferenceId = soulType ? SOUL_IDS[soulType] : null;
  const job = await submitGenerate({ prompt, customReferenceId });
  const images = await pollJobSet(job.id);
  return images[0]; // Return first/best result
}

module.exports = { submitGenerate, pollJobSet, generateFrame };
