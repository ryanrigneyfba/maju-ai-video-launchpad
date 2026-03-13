/**
 * Stitch client — combines 2 clips via MAJU backend.
 * POST /api/stitch then poll GET /api/jobs/:id
 */
const { request, poll } = require('./http');
const { SERVER_BASE } = require('../config');

/**
 * Submit a stitch job.
 * @param {string[]} clipUrls - Array of video URLs
 * @param {object} [options] - Stitch options (maxClipDuration, audioBg, etc.)
 * @returns {Promise<{jobId: string}>}
 */
async function submitStitch(clipUrls, options = {}) {
  const result = await request('/api/stitch', 'POST', {}, {
    clips: clipUrls,
    options,
  });

  if (result.status !== 200 || !result.data.jobId) {
    throw new Error(`Stitch submit error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }

  return { jobId: result.data.jobId };
}

/**
 * Poll a stitch job until completion.
 */
async function pollJob(jobId) {
  const result = await poll(`/api/jobs/${jobId}`, {}, {
    intervalMs: 5000,
    maxAttempts: 120,
    label: 'stitch',
    check: (res) => {
      if (res.status !== 200) return false;
      const job = res.data;
      if (job.status === 'failed') {
        throw new Error(`Stitch job failed: ${job.error || 'unknown'}`);
      }
      return job.status === 'completed' || job.status === 'done';
    },
  });

  const job = result.data;
  // Build download URL from the server
  const videoUrl = `${SERVER_BASE}/api/download/${jobId}`;

  return {
    jobId,
    outputFile: job.outputFile,
    videoUrl,
  };
}

/**
 * Stitch clips and wait for result.
 */
async function stitchClips(clipUrls, options = {}) {
  const { jobId } = await submitStitch(clipUrls, options);
  return pollJob(jobId);
}

module.exports = { submitStitch, pollJob, stitchClips };
