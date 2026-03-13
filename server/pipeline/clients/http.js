/**
 * Shared HTTP helper — mirrors server/index.js proxyRequest() pattern.
 * All pipeline API calls go through the MAJU backend at localhost:3001.
 */
const http = require('http');
const https = require('https');
const { SERVER_BASE } = require('../config');

/**
 * Make an HTTP request to the MAJU backend proxy.
 * @param {string} path - e.g. '/api/proxy/kling/image2video'
 * @param {string} method - GET or POST
 * @param {object} headers - extra headers (x-api-key-value, etc.)
 * @param {object|null} body - JSON body for POST
 * @returns {Promise<{status: number, data: any}>}
 */
function request(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_BASE);
    const transport = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    if (bodyStr) reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Poll an endpoint until a condition is met.
 */
async function poll(path, headers, { check, intervalMs = 3000, maxAttempts = 200, label = 'poll' } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await request(path, 'GET', headers);
    const done = check(result);
    if (done) return result;
    if (i % 10 === 0 && i > 0) process.stdout.write(`\x1b[2m  ${label}: poll #${i}...\x1b[0m\n`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`${label}: max poll attempts (${maxAttempts}) reached`);
}

module.exports = { request, poll };
