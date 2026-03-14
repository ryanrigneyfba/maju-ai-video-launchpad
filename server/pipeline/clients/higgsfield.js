'use strict';

const { fetchJSON, poll, sleep } = require('./http');
const { getKey, MAJU_SERVER, IMAGE_TIMEOUT, POLL_INTERVAL, JWT_WAIT_TIMEOUT } = require('../config');

// ─── FNF image generation (fnf.higgsfield.ai via backend proxy) ──────────────
// Requires a valid Higgsfield JWT stored via the bookmarklet (/api/jwt-store)

async function ensureJWT() {
  const status = await fetchJSON(`${MAJU_SERVER}/api/jwt-status`);
  if (status.valid) return;

  console.log('\n  ⚡ ACTION REQUIRED: Higgsfield JWT needed.');
  console.log('  1. Open https://fnf.higgsfield.ai in your browser (must be logged in)');
  console.log('  2. Run the Soul Connect bookmarklet');
  console.log(`  3. Pipeline will continue automatically (waiting up to ${JWT_WAIT_TIMEOUT / 1000}s)...\n`);

  const deadline = Date.now() + JWT_WAIT_TIMEOUT;
  while (Date.now() < deadline) {
    await sleep(3000);
    const s = await fetchJSON(`${MAJU_SERVER}/api/jwt-status`);
    if (s.valid) {
      console.log('  JWT received — continuing.\n');
      return;
    }
  }
  throw new Error('Timed out waiting for Higgsfield JWT. Run the Soul Connect bookmarklet and retry.');
}

async function generateFrame(prompt, soulId = null) {
  await ensureJWT();
  const apiKey    = getKey('higgsFieldApiKey');
  const apiSecret = getKey('higgsFieldApiSecret');

  const params = {
    prompt,
    quality:    '1080p',
    aspect_ratio: '9:16',
    enhance_prompt: true,
    batch_size: 1,
    use_unlim:  true,
  };

  if (soulId) {
    params.custom_reference_id       = soulId;
    params.custom_reference_strength = 0.9;
  }

  const data = await fetchJSON(`${MAJU_SERVER}/api/proxy/higgsfield/fnf-generate`, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key-value':   apiKey,
      'x-api-secret-value': apiSecret,
    },
    body: JSON.stringify({ params }),
  });

  const jobSetId = data?.id || data?.job_set_id;
  if (!jobSetId) throw new Error(`FNF generate returned no job ID: ${JSON.stringify(data)}`);
  return jobSetId;
}

async function pollFrame(jobSetId) {
  const apiKey    = getKey('higgsFieldApiKey');
  const apiSecret = getKey('higgsFieldApiSecret');

  return poll(
    `${MAJU_SERVER}/api/proxy/higgsfield/fnf-job-set/${jobSetId}`,
    {
      headers: {
        'x-api-key-value':   apiKey,
        'x-api-secret-value': apiSecret,
      },
    },
    (data) => {
      const status = (data?.status || '').toLowerCase();
      if (status === 'failed' || status === 'error') {
        throw new Error(`FNF job failed: ${JSON.stringify(data)}`);
      }
      // Extract image URL from completed job
      const jobs = data?.jobs || data?.results || [];
      if (jobs.length > 0) {
        const url = jobs[0]?.result?.url || jobs[0]?.url || jobs[0]?.image_url;
        if (url) return url;
      }
      if (data?.result?.url) return data.result.url;
      return null;
    },
    IMAGE_TIMEOUT,
  );
}

module.exports = { generateFrame, pollFrame };
