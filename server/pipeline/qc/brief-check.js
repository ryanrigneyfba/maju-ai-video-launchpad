'use strict';

function check(brief) {
  const errors = [];
  const required = ['concept', 'hookLine', 'staticFrames', 'animationPrompts', 'caption', 'hashtags'];
  for (const key of required) {
    if (!brief[key]) errors.push(`Missing field: ${key}`);
  }
  const frames = ['clip1Start', 'clip1End', 'clip2Start', 'clip2End'];
  for (const f of frames) {
    if (!brief.staticFrames?.[f] || brief.staticFrames[f].length < 20)
      errors.push(`staticFrames.${f} too short or missing`);
  }
  if (!brief.animationPrompts?.clip1) errors.push('Missing animationPrompts.clip1');
  if (!brief.animationPrompts?.clip2) errors.push('Missing animationPrompts.clip2');
  if (!brief.caption || brief.caption.length < 30) errors.push('Caption too short');
  if (!Array.isArray(brief.hashtags) || brief.hashtags.length < 3) errors.push('Need at least 3 hashtags');
  return errors;
}

module.exports = { check };
