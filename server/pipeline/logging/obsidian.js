'use strict';

// Obsidian REST API logger
// Writes brief JSON to vault and appends a row to ANIMAL_TRACKER.md

const https  = require('https');
const { getKey, OBSIDIAN_API } = require('../config');

// ─── Low-level request (self-signed cert on localhost) ───────────────────────
function obsidianRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const apiKey = getKey('obsidianApiKey');
    const url    = new URL(urlPath, OBSIDIAN_API);
    const bodyStr = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port:     url.port || 443,
      path:     url.pathname + url.search,
      method,
      rejectUnauthorized: false, // self-signed cert on localhost
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function writeFile(vaultPath, content) {
  const encoded = encodeURIComponent(vaultPath).replace(/%2F/g, '/');
  await obsidianRequest('PUT', `/vault/${encoded}`, { content });
}

async function appendFile(vaultPath, content) {
  const encoded = encodeURIComponent(vaultPath).replace(/%2F/g, '/');
  await obsidianRequest('POST', `/vault/${encoded}`, { content });
}

// ─── Public: log a completed run ─────────────────────────────────────────────
async function logRun(state, brief, publishResults) {
  const { runId, animal, location } = state;
  const date = new Date().toISOString().slice(0, 10);

  // 1. Write brief JSON to vault
  const briefPath = `MAJU/Animal-Stash/briefs/${date}-${runId}.json`;
  await writeFile(briefPath, JSON.stringify(brief, null, 2));

  // 2. Append tracker row
  const succeeded = Object.entries(publishResults)
    .filter(([, r]) => r.ok)
    .map(([n]) => n)
    .join(', ');

  const row = `| ${date} | ${runId} | ${animal} | ${location} | ${brief.hookLine} | ${succeeded} |\n`;
  await appendFile('MAJU/ANIMAL_TRACKER.md', row);

  console.log(`  [obsidian] logged run ${runId}`);
}

module.exports = { logRun };
