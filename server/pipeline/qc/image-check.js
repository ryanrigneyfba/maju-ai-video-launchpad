/**
 * QC: Image validation — ensure all 4 static frames are accessible.
 * Performs HTTP HEAD on each URL to verify availability.
 */
const http = require('http');
const https = require('https');

function headCheck(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD' }, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
    });
    req.on('error', (err) => resolve({ url, status: 0, ok: false, error: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ url, status: 0, ok: false, error: 'timeout' }); });
    req.end();
  });
}

const REQUIRED_FRAMES = ['clip1Start', 'clip1End', 'clip2Start', 'clip2End'];

module.exports = async function imageCheck(output) {
  if (!output || typeof output !== 'object') {
    return { pass: false, reason: 'Statics output is not an object' };
  }

  for (const frame of REQUIRED_FRAMES) {
    if (!output[frame]?.url) {
      return { pass: false, reason: `Missing frame URL: ${frame}` };
    }
  }

  // Check all URLs are accessible
  const checks = await Promise.all(
    REQUIRED_FRAMES.map(frame => headCheck(output[frame].url))
  );

  const failed = checks.filter(c => !c.ok);
  if (failed.length > 0) {
    return {
      pass: false,
      reason: `${failed.length} frame(s) not accessible: ${failed.map(f => `${f.url.slice(0, 60)} (${f.status || f.error})`).join(', ')}`,
    };
  }

  return {
    pass: true,
    detail: `All ${REQUIRED_FRAMES.length} frames accessible`,
  };
};
