'use strict';

// Stage 6 — Publish to social networks via Metricool
// Requires final video to be accessible via a URL (stream URL from MAJU backend)
// Output: { publishResults } — per-network results

const { publish }   = require('../clients/metricool');
const { logRun }    = require('../logging/obsidian');
const { RETRY_ATTEMPTS, RETRY_DELAYS } = require('../config');
const { sleep } = require('../clients/http');

async function run(state) {
  const { streamUrl } = state.stages.stitch.output;
  const brief           = state.stages.brief.output.brief;

  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    if (i > 0) {
      console.log(`  [publish] retry ${i}/${RETRY_ATTEMPTS - 1}...`);
      await sleep(RETRY_DELAYS[i - 1]);
    }
    try {
      console.log('  [publish] publishing to social networks...');
      const publishResults = await publish(streamUrl, brief.caption, brief.hashtags);

      const succeeded = Object.entries(publishResults)
        .filter(([, r]) => r.ok)
        .map(([n]) => n);
      const failed = Object.entries(publishResults)
        .filter(([, r]) => !r.ok)
        .map(([n, r]) => `${n}: ${r.error}`);

      console.log(`  [publish] succeeded: ${succeeded.join(', ') || 'none'}`);
      if (failed.length) console.warn(`  [publish] failed: ${failed.join(', ')}`);

      // Log to Obsidian regardless of partial publish failures
      try {
        await logRun(state, brief, publishResults);
      } catch (logErr) {
        console.warn(`  [publish] Obsidian log failed (non-fatal): ${logErr.message}`);
      }

      if (succeeded.length === 0) throw new Error(`All networks failed: ${failed.join('; ')}`);

      return { publishResults };
    } catch (err) {
      if (i === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`  [publish] attempt ${i + 1} failed: ${err.message}`);
    }
  }
}

module.exports = { run };
