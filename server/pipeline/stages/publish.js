/**
 * Stage 6: Publish — upload final video and post to all networks via Metricool.
 * Uploads to MAJU backend for serving via /api/video/:id.mp4, then posts via Metricool.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { SERVER_BASE } = require('../config');
const metricool = require('../clients/metricool');

/**
 * Upload video to MAJU backend via multipart form.
 * POST /api/upload → returns { filename }
 * Then accessible at /api/video/:filename
 */
function uploadVideo(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----PipelineUpload' + Date.now();
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    const header = `--${boundary}\r\nContent-Disposition: form-data; name="clips"; filename="${fileName}"\r\nContent-Type: video/mp4\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([Buffer.from(header), fileData, Buffer.from(footer)]);
    const url = new URL('/api/upload', SERVER_BASE);

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          reject(new Error(`Upload response parse error: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function publish(run) {
  const postprodOutput = run.stages.postprod.output;
  const brief = run.stages.brief.output;

  if (!postprodOutput?.filePath) throw new Error('Postprod stage missing filePath');
  if (!brief?.caption) throw new Error('Brief missing caption');

  // Upload to MAJU backend
  process.stdout.write(`\x1b[2m  Uploading video to MAJU backend...\x1b[0m\n`);
  const uploadResult = await uploadVideo(postprodOutput.filePath);
  const uploadedFiles = uploadResult.files || uploadResult.uploadedFiles || [];
  const filename = uploadedFiles[0] || uploadResult.filename;

  if (!filename) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadResult).slice(0, 200)}`);
  }

  // Build public video URL
  const videoUrl = `${SERVER_BASE}/api/video/${filename}`;

  // Normalize media URL for Metricool
  process.stdout.write(`\x1b[2m  Normalizing media URL...\x1b[0m\n`);
  let normalizedUrl = videoUrl;
  try {
    const normalized = await metricool.normalizeMedia(videoUrl);
    if (normalized?.url) normalizedUrl = normalized.url;
  } catch (e) {
    process.stdout.write(`\x1b[2m  Normalize skipped: ${e.message}\x1b[0m\n`);
  }

  // Post to all networks
  process.stdout.write(`\x1b[2m  Posting to social networks...\x1b[0m\n`);
  const results = await metricool.postToAllNetworks(normalizedUrl, brief.caption);

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  if (succeeded === 0) {
    throw new Error(`All network posts failed: ${failed.map(f => `${f.network}: ${f.error}`).join('; ')}`);
  }

  if (failed.length > 0) {
    process.stdout.write(`\x1b[33m  Warning: ${failed.length} network(s) failed: ${failed.map(f => f.network).join(', ')}\x1b[0m\n`);
  }

  return {
    videoUrl,
    normalizedUrl,
    networkResults: results,
    successCount: succeeded,
    failCount: failed.length,
  };
};
