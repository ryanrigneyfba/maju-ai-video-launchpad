'use strict';

// Stage 5 — Post-production via FFmpeg
// Burns captions, overlays crack PNG, mixes reel audio
// Output: { finalPath } — local file path

const path = require('path');
const { postProduce } = require('../clients/ffmpeg');
const { RETRY_ATTEMPTS, RETRY_DELAYS } = require('../config');
const { sleep } = require('../clients/http');

async function run(state) {
  const { stitchedPath } = state.stages.stitch.output;
  const brief            = state.stages.brief.output.brief;
  const hookLine         = brief.hookLine;

  const outDir    = path.dirname(stitchedPath);
  const finalPath = path.join(outDir, 'final.mp4');

  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    if (i > 0) {
      console.log(`  [postprod] retry ${i}/${RETRY_ATTEMPTS - 1}...`);
      await sleep(RETRY_DELAYS[i - 1]);
    }
    try {
      console.log(`  [postprod] rendering final video...`);
      await postProduce(stitchedPath, finalPath, hookLine);
      console.log(`  [postprod] done => ${finalPath}`);
      return { finalPath };
    } catch (err) {
      if (i === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`  [postprod] attempt ${i + 1} failed: ${err.message}`);
    }
  }
}

module.exports = { run };
