/**
 * Stage 2: Statics — generate 4 static reference frames via Higgsfield.
 * Uses Soul references: Person (Patient Maya) for clip1Start, Product (MajuBottle) for clip2End.
 */
const higgsfield = require('../clients/higgsfield');

module.exports = async function statics(run) {
  const brief = run.stages.brief.output;
  if (!brief?.staticFrames) throw new Error('Brief missing staticFrames');

  const frames = brief.staticFrames;

  // Generate all 4 frames. Clip1Start uses Person soul, Clip2End uses Product soul.
  // Others have no soul reference (pure POV).
  const jobs = [
    { key: 'clip1Start', prompt: frames.clip1Start, soul: 'person' },
    { key: 'clip1End',   prompt: frames.clip1End,   soul: null },
    { key: 'clip2Start', prompt: frames.clip2Start,  soul: null },
    { key: 'clip2End',   prompt: frames.clip2End,   soul: 'product' },
  ];

  const results = {};
  for (const { key, prompt, soul } of jobs) {
    process.stdout.write(`\x1b[2m  Generating ${key}...\x1b[0m\n`);
    const image = await higgsfield.generateFrame(prompt, soul);
    results[key] = { url: image.url, jobId: image.jobId };
  }

  return results;
};
