'use strict';

// Stage 3 — Animate 2 clips via Kling (image2video)
// clip1: clip1Start -> clip1End, animated with animationPrompts.clip1
// clip2: clip2Start -> clip2End, animated with animationPrompts.clip2
// Output: { clips: { clip1, clip2 } } — local file paths

const path = require('path');
const os   = require('os');
const fs   = require('fs');
const { generateClip, pollClip } = require('../clients/kling');
const { check: checkPOV }        = require('../qc/pov-check');
const { download }               = require('../clients/http');
const { RETRY_ATTEMPTS, RETRY_DELAYS, VIDEO_TIMEOUT } = require('../config');
const { sleep } = require('../clients/http');

async function animateClip(clipKey, startUrl, endUrl, prompt) {
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    if (i > 0) {
      console.log(`  [animate] ${clipKey} retry ${i}/${RETRY_ATTEMPTS - 1}...`);
      await sleep(RETRY_DELAYS[i - 1]);
    }
    try {
      console.log(`  [animate] generating ${clipKey}...`);
      const taskId = await generateClip(startUrl, endUrl, prompt);
      const videoUrl = await pollClip(taskId, VIDEO_TIMEOUT);
      console.log(`  [animate] ${clipKey} => ${videoUrl}`);
      return videoUrl;
    } catch (err) {
      if (i === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`  [animate] ${clipKey} attempt ${i + 1} failed: ${err.message}`);
    }
  }
}

async function run(state) {
  const brief  = state.stages.brief.output.brief;
  const frames = state.stages.statics.output.frames;

  const outDir = path.join(os.tmpdir(), `animal-stash-${state.runId}`);
  fs.mkdirSync(outDir, { recursive: true });

  // Generate clip1 and clip2 sequentially
  const clip1Url = await animateClip(
    'clip1',
    frames.clip1Start,
    frames.clip1End,
    brief.animationPrompts.clip1,
  );
  const clip2Url = await animateClip(
    'clip2',
    frames.clip2Start,
    frames.clip2End,
    brief.animationPrompts.clip2,
  );

  // Download to local files
  const clip1Path = path.join(outDir, 'clip1.mp4');
  const clip2Path = path.join(outDir, 'clip2.mp4');
  console.log('  [animate] downloading clip1...');
  await download(clip1Url, clip1Path);
  console.log('  [animate] downloading clip2...');
  await download(clip2Url, clip2Path);

  // POV QC — checks 0s and 4.5s frames via Claude Vision
  console.log('  [animate] running POV QC...');
  const pov1Errors = await checkPOV(clip1Path, 'clip1', true);  // isClip1Start=true for 0s skip
  const pov2Errors = await checkPOV(clip2Path, 'clip2', false);
  const allPovErrors = [...pov1Errors, ...pov2Errors];
  if (allPovErrors.length) {
    throw new Error(`POV QC failed:\n  ${allPovErrors.join('\n  ')}`);
  }

  return { clips: { clip1: clip1Path, clip2: clip2Path } };
}

module.exports = { run };
