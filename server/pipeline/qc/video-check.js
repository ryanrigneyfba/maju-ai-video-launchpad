/**
 * QC: Video validation — check duration, resolution, and audio presence.
 * Used for both stitch and postprod stages.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ffmpeg = require('../clients/ffmpeg');
const { ASSETS_DIR } = require('../config');

/**
 * Download a URL to a temp file for probing.
 */
function downloadTemp(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        downloadTemp(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

module.exports = async function videoCheck(output, run) {
  // Determine what we're checking based on stage
  let filePath = null;
  let expectedDuration = 10; // minimum expected seconds
  let checkAudio = false;

  if (output.filePath && fs.existsSync(output.filePath)) {
    // Post-production output (local file)
    filePath = output.filePath;
    expectedDuration = 10;
    checkAudio = true;
  } else if (output.videoUrl) {
    // Stitch output (remote URL)
    filePath = path.join(ASSETS_DIR, `qc-video-${run.runId}.mp4`);
    await downloadTemp(output.videoUrl, filePath);
  } else {
    return { pass: false, reason: 'No video file or URL in output' };
  }

  try {
    const probeData = await ffmpeg.probe(filePath);

    // Check video stream exists
    const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
    if (!videoStream) {
      return { pass: false, reason: 'No video stream found' };
    }

    // Check duration
    const duration = parseFloat(probeData.format?.duration || 0);
    if (duration < expectedDuration) {
      return { pass: false, reason: `Video too short: ${duration.toFixed(1)}s (expected ≥${expectedDuration}s)` };
    }

    // Check resolution (should be 1080x1920 for 9:16)
    const w = videoStream.width;
    const h = videoStream.height;
    if (w < 720 || h < 1280) {
      return { pass: false, reason: `Resolution too low: ${w}x${h} (expected ≥1080x1920)` };
    }

    // Check audio if expected
    if (checkAudio) {
      const audioStream = probeData.streams?.find(s => s.codec_type === 'audio');
      if (!audioStream) {
        return { pass: false, reason: 'No audio stream (expected after post-production)' };
      }
    }

    return {
      pass: true,
      detail: `${duration.toFixed(1)}s, ${w}x${h}${checkAudio ? ', has audio' : ''}`,
    };
  } finally {
    // Clean up temp download if we created one
    if (output.videoUrl && filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};
