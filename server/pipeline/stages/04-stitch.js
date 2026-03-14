'use strict';

// Stage 4 — Upload clips + stitch via MAJU backend
// Output: { stitchedPath, jobId, downloadUrl, streamUrl }

const path = require('path');
const { uploadClips, stitch, pollStitch, downloadURL, streamURL } = require('../clients/stitch');
const { check: checkVideo } = require('../qc/video-check');
const { download }          = require('../clients/http');
const { RETRY_ATTEMPTS, RETRY_DELAYS, STITCH_TIMEOUT } = require('../config');
const { sleep } = require('../clients/http');

async function run(state) {
  const { clip1, clip2 } = state.stages.animate.output.clips;
  const outDir = path.dirname(clip1);

  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    if (i > 0) {
      console.log(`  [stitch] retry ${i}/${RETRY_ATTEMPTS - 1}...`);
      await sleep(RETRY_DELAYS[i - 1]);
    }
    try {
      // Upload both clips
      console.log('  [stitch] uploading clips...');
      const filenames = await uploadClips([clip1, clip2]);

      // Request stitch
      console.log('  [stitch] stitching...');
      const jobId = await stitch(filenames);

      // Poll for completion — returns outputFile string
      const outputFile = await pollStitch(jobId, STITCH_TIMEOUT);
      console.log(`  [stitch] done: ${outputFile}`);

      const dlUrl     = downloadURL(jobId);
      const strUrl    = streamURL(jobId);

      // Download stitched video locally
      const stitchedPath = path.join(outDir, 'stitched.mp4');
      console.log('  [stitch] downloading stitched video...');
      await download(dlUrl, stitchedPath);

      // QC
      const errors = await checkVideo(stitchedPath);
      if (errors.length) throw new Error(`Video QC failed: ${errors.join('; ')}`);

      return { stitchedPath, jobId, downloadUrl: dlUrl, streamUrl: strUrl };
    } catch (err) {
      if (i === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`  [stitch] attempt ${i + 1} failed: ${err.message}`);
    }
  }
}

module.exports = { run };
