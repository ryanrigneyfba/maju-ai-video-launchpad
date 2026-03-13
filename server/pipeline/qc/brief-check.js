/**
 * QC: Brief validation — ensure all required fields are present and well-formed.
 */
const REQUIRED_FIELDS = ['concept', 'hookLine', 'staticFrames', 'animationPrompts', 'hashtags', 'caption'];
const REQUIRED_FRAMES = ['clip1Start', 'clip1End', 'clip2Start', 'clip2End'];
const REQUIRED_ANIMS = ['clip1', 'clip2'];

module.exports = async function briefCheck(output) {
  if (!output || typeof output !== 'object') {
    return { pass: false, reason: 'Brief output is not an object' };
  }

  // Check top-level fields
  for (const field of REQUIRED_FIELDS) {
    if (!output[field]) {
      return { pass: false, reason: `Missing required field: ${field}` };
    }
  }

  // Check static frames
  for (const frame of REQUIRED_FRAMES) {
    if (!output.staticFrames[frame]) {
      return { pass: false, reason: `Missing static frame: ${frame}` };
    }
    if (typeof output.staticFrames[frame] !== 'string' || output.staticFrames[frame].length < 20) {
      return { pass: false, reason: `Static frame "${frame}" prompt too short (${output.staticFrames[frame]?.length || 0} chars)` };
    }
  }

  // Check animation prompts
  for (const anim of REQUIRED_ANIMS) {
    if (!output.animationPrompts[anim]) {
      return { pass: false, reason: `Missing animation prompt: ${anim}` };
    }
    if (typeof output.animationPrompts[anim] !== 'string' || output.animationPrompts[anim].length < 20) {
      return { pass: false, reason: `Animation prompt "${anim}" too short` };
    }
  }

  // Check hashtags
  if (!Array.isArray(output.hashtags) || output.hashtags.length < 3) {
    return { pass: false, reason: `Need at least 3 hashtags, got ${output.hashtags?.length || 0}` };
  }

  // Check caption length
  if (output.caption.length < 30) {
    return { pass: false, reason: 'Caption too short' };
  }

  return {
    pass: true,
    detail: `${REQUIRED_FRAMES.length} frames, ${REQUIRED_ANIMS.length} animations, ${output.hashtags.length} hashtags`,
  };
};
