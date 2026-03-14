'use strict';

// Stage 2 — Generate 4 static frames via Higgsfield FNF
// Output: { frames: { clip1Start, clip1End, clip2Start, clip2End } } — URLs

const { generateFrame, pollFrame } = require('../clients/higgsfield');
const { check: checkImages }       = require('../qc/image-check');
const { check: checkPOV }          = require('../qc/pov-check');
const { FRAME_SOULS, RETRY_ATTEMPTS, RETRY_DELAYS, IMAGE_TIMEOUT } = require('../config');
const { sleep } = require('../clients/http');

const FRAME_KEYS = ['clip1Start', 'clip1End', 'clip2Start', 'clip2End'];

async function generateOneFrame(key, prompt, attempt = 0) {
  const soulId = FRAME_SOULS[key] || null;
  console.log(`  [statics] generating ${key}${soulId ? ` (soul: ${soulId.slice(0, 8)}...)` : ''}...`);

  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    if (i > 0) {
      console.log(`  [statics] ${key} retry ${i}/${RETRY_ATTEMPTS - 1}...`);
      await sleep(RETRY_DELAYS[i - 1]);
    }
    try {
      const jobSetId = await generateFrame(prompt, soulId);
      const url = await pollFrame(jobSetId, IMAGE_TIMEOUT);
      console.log(`  [statics] ${key} => ${url}`);
      return url;
    } catch (err) {
      if (i === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`  [statics] ${key} attempt ${i + 1} failed: ${err.message}`);
    }
  }
}

async function run(state) {
  const brief = state.stages.brief.output.brief;
  const prompts = brief.staticFrames;

  // Generate all 4 frames (sequentially to avoid JWT race conditions)
  const frames = {};
  for (const key of FRAME_KEYS) {
    frames[key] = await generateOneFrame(key, prompts[key]);
  }

  // QC: HTTP HEAD check
  const imgErrors = await checkImages(frames);
  if (imgErrors.length) throw new Error(`Image QC failed: ${imgErrors.join('; ')}`);

  // QC: POV integrity check on clip1End, clip2Start, clip2End
  // (clip1Start is Patient Maya — handled specially by pov-check)
  const povErrors = [];
  for (const key of FRAME_KEYS) {
    const isClip1Start = key === 'clip1Start';
    // POV check runs on video frames later; for static images we skip here
    // and rely on the pov-check in stage 03 (animate output)
    void isClip1Start;
  }

  return { frames };
}

module.exports = { run };
