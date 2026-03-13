/**
 * Stage 5: Post-Production — captions, crack overlay, audio via FFmpeg.
 * Downloads the stitched video, applies ASS captions + overlay + audio, outputs final.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ffmpeg = require('../clients/ffmpeg');
const { ASSETS_DIR, SERVER_BASE } = require('../config');

/**
 * Download a URL to a local file path.
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

module.exports = async function postprod(run) {
  const stitchOutput = run.stages.stitch.output;
  const brief = run.stages.brief.output;

  if (!stitchOutput?.videoUrl) throw new Error('Stitch stage missing videoUrl');
  if (!brief?.hookLine) throw new Error('Brief missing hookLine');

  // Download stitched video locally
  const inputPath = path.join(ASSETS_DIR, `${run.runId}-stitched.mp4`);
  process.stdout.write(`\x1b[2m  Downloading stitched video...\x1b[0m\n`);
  await download(stitchOutput.videoUrl, inputPath);

  // Output path
  const outputPath = path.join(ASSETS_DIR, `${run.runId}-final.mp4`);

  // Look for assets (optional — graceful fallback if missing)
  const crackOverlay = path.join(ASSETS_DIR, 'crack-overlay.png');
  const audioFile = path.join(ASSETS_DIR, 'ReelAudio-27687.mp3');

  process.stdout.write(`\x1b[2m  Running FFmpeg post-production...\x1b[0m\n`);
  await ffmpeg.postProduce({
    inputVideo: inputPath,
    captionText: brief.hookLine,
    outputPath,
    crackOverlay: fs.existsSync(crackOverlay) ? crackOverlay : null,
    audioFile: fs.existsSync(audioFile) ? audioFile : null,
  });

  // Verify output exists
  if (!fs.existsSync(outputPath)) {
    throw new Error('FFmpeg post-production failed: output file not created');
  }

  // Get video info
  const probeData = await ffmpeg.probe(outputPath);
  const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
  const duration = parseFloat(probeData.format?.duration || 0);

  return {
    filePath: outputPath,
    duration,
    width: videoStream?.width,
    height: videoStream?.height,
  };
};
