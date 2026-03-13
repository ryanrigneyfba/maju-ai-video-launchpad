/**
 * Stage 3: Animate — generate 2 video clips from static frames via Kling.
 * Clip 1: clip1Start → clip1End with animationPrompts.clip1
 * Clip 2: clip2Start → clip2End with animationPrompts.clip2
 */
const kling = require('../clients/kling');

module.exports = async function animate(run) {
  const brief = run.stages.brief.output;
  const statics = run.stages.statics.output;

  if (!brief?.animationPrompts) throw new Error('Brief missing animationPrompts');
  if (!statics?.clip1Start || !statics?.clip2End) throw new Error('Statics missing required frames');

  const clips = [
    {
      key: 'clip1',
      imageUrl: statics.clip1Start.url,
      tailImageUrl: statics.clip1End.url,
      prompt: brief.animationPrompts.clip1,
    },
    {
      key: 'clip2',
      imageUrl: statics.clip2Start.url,
      tailImageUrl: statics.clip2End.url,
      prompt: brief.animationPrompts.clip2,
    },
  ];

  const results = {};
  for (const { key, imageUrl, tailImageUrl, prompt } of clips) {
    process.stdout.write(`\x1b[2m  Animating ${key}...\x1b[0m\n`);
    const result = await kling.generateClip(imageUrl, prompt, tailImageUrl);
    results[key] = { url: result.url, duration: result.duration, taskId: result.taskId };
  }

  return results;
};
