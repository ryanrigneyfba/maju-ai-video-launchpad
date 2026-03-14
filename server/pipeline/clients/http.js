'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const { POLL_INTERVAL } = require('../config');

// ─── Generic fetch (no deps, works in Node 18+) ───────────────────────────────
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); }
  catch { return text; }
}

// ─── Poll a URL until condition is met ───────────────────────────────────────
async function poll(url, options, checkFn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await fetchJSON(url, options);
    const result = checkFn(data);
    if (result !== null && result !== undefined && result !== false) return result;
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Poll timed out after ${timeoutMs}ms: ${url}`);
}

// ─── Download a URL to a local file ──────────────────────────────────────────
async function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(destPath);
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { file.close(); reject(err); });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { fetchJSON, poll, download, sleep };
