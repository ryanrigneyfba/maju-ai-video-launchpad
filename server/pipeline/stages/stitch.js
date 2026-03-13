/**
 * Stage 4: Stitch — combine 2 clips into a single 12s video with background music.
 */
const stitchClient = require('../clients/stitch');

module.exports = async function stitch(run) {
  const animate = run.stages.animate.output;
  if (!animate?.clip1?.url || !animate?.clip2?.url) {
    throw new Error('Animate stage missing clip URLs');
  }

  const clipUrls = [animate.clip1.url, animate.clip2.url];
  const options = {
    maxClipDuration: 6,
    audioBg: 'royalty_free_upbeat',
  };

  process.stdout.write(`\x1b[2m  Stitching ${clipUrls.length} clips...\x1b[0m\n`);
  const result = await stitchClient.stitchClips(clipUrls, options);

  return {
    jobId: result.jobId,
    outputFile: result.outputFile,
    videoUrl: result.videoUrl,
  };
};
