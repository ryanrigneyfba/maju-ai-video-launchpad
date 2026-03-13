/**
 * Obsidian logging — writes run results to Obsidian vault via Local REST API.
 * API at localhost:27124 (HTTPS, self-signed cert) with Bearer token auth.
 */
const https = require('https');
const { OBSIDIAN_BASE, OBSIDIAN_KEY } = require('../config');

/**
 * Make an HTTP request to the Obsidian Local REST API.
 */
function obsidianRequest(method, vaultPath, body = null, contentType = 'text/markdown') {
  return new Promise((resolve, reject) => {
    const url = new URL(`/vault/${encodeURIComponent(vaultPath)}`, OBSIDIAN_BASE);
    const headers = { Authorization: `Bearer ${OBSIDIAN_KEY}` };
    if (body) headers['Content-Type'] = contentType;

    const req = https.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers,
      rejectUnauthorized: false, // self-signed cert
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Log a completed pipeline run to Obsidian.
 * Creates a brief file and updates the tracker.
 */
async function logRun(run) {
  if (!OBSIDIAN_KEY) throw new Error('No Obsidian API key configured');

  // Write brief file
  const briefMd = buildBriefMarkdown(run);
  const briefPath = `20_AI_Factory/animal-stash/briefs/${run.runId}.md`;
  await obsidianRequest('PUT', briefPath, briefMd);

  // Append to tracker
  const trackerRow = buildTrackerRow(run);
  const trackerPath = '20_AI_Factory/animal-stash/ANIMAL_TRACKER.md';
  await obsidianRequest('POST', trackerPath, `\n${trackerRow}`, 'text/markdown');
}

/**
 * Log a pipeline failure to Obsidian.
 */
async function logFailure(run, stageName) {
  if (!OBSIDIAN_KEY) return;

  const lastAttempt = run.stages[stageName]?.attempts?.slice(-1)[0];
  const row = `| ${run.runId} | ${run.animal} | ${run.location} | FAILED at ${stageName} | ${lastAttempt?.error || 'unknown'} | ${new Date().toISOString().slice(0, 10)} |`;
  const trackerPath = '20_AI_Factory/animal-stash/ANIMAL_TRACKER.md';

  try {
    await obsidianRequest('POST', trackerPath, `\n${row}`, 'text/markdown');
  } catch { /* silent */ }
}

function buildBriefMarkdown(run) {
  const brief = run.stages.brief?.output || {};
  const statics = run.stages.statics?.output || {};
  const animate = run.stages.animate?.output || {};
  const publish = run.stages.publish?.output || {};

  return `---
runId: ${run.runId}
animal: ${run.animal}
location: ${run.location}
status: ${run.currentStage}
createdAt: ${run.createdAt}
---

# ${run.animal} — ${run.location}

## Concept
${brief.concept || 'N/A'}

## Hook Line
${brief.hookLine || 'N/A'}

## Caption
${brief.caption || 'N/A'}

## Hashtags
${(brief.hashtags || []).join(' ')}

## Static Frames
${Object.entries(statics).map(([k, v]) => `- **${k}**: ${v?.url || 'N/A'}`).join('\n')}

## Animated Clips
${Object.entries(animate).map(([k, v]) => `- **${k}**: ${v?.url || 'N/A'} (${v?.duration || '?'}s)`).join('\n')}

## Publishing
${publish.networkResults ? publish.networkResults.map(r => `- **${r.network}**: ${r.success ? 'OK' : 'FAILED — ' + r.error}`).join('\n') : 'N/A'}

## Stage Timing
${Object.entries(run.stages).map(([name, s]) => `- **${name}**: ${s.status}${s.completedAt ? ' (' + s.completedAt.slice(11, 19) + ')' : ''}`).join('\n')}
`;
}

function buildTrackerRow(run) {
  const publish = run.stages.publish?.output || {};
  const networks = publish.successCount || 0;
  return `| ${run.runId} | ${run.animal} | ${run.location} | ${run.currentStage} | ${networks}/5 networks | ${new Date().toISOString().slice(0, 10)} |`;
}

module.exports = { logRun, logFailure };
