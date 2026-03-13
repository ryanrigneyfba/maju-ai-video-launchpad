/**
 * QC: POV Integrity Check — the MOST CRITICAL quality gate.
 * Extracts frames from each animated clip and sends to Claude Vision
 * to verify first-person animal POV (ears top, snout bottom, no 3rd person).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ffmpeg = require('../clients/ffmpeg');
const { request } = require('../clients/http');
const { getKey, ASSETS_DIR } = require('../config');

/**
 * Download a video URL to a local temp file.
 */
function downloadVideo(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        downloadVideo(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

/**
 * Send an image to Claude Vision for POV analysis.
 */
async function analyzePOV(imagePath, clipLabel) {
  const apiKey = getKey('claudeApiKey');
  if (!apiKey) throw new Error('Missing claudeApiKey for POV check');

  const imageData = fs.readFileSync(imagePath).toString('base64');
  const mediaType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const result = await request('/api/proxy/claude/messages', 'POST', {
    'x-api-key-value': apiKey,
  }, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageData },
        },
        {
          type: 'text',
          text: `You are a quality checker for Animal Stash videos. This frame is from ${clipLabel}.

Analyze this image and answer these questions with YES/NO:
1. Is this a first-person POV shot (camera mounted on animal's head)?
2. Are animal ears/head features visible at the top edges of the frame?
3. Is a snout/nose visible at the bottom of the frame?
4. Is this NOT a third-person view (we should NOT see the whole animal from outside)?

Respond with JSON: { "isPOV": boolean, "hasEars": boolean, "hasSnout": boolean, "notThirdPerson": boolean, "confidence": "high"|"medium"|"low", "notes": "brief explanation" }`,
        },
      ],
    }],
  });

  if (result.status !== 200) {
    throw new Error(`Claude Vision error: ${result.status}`);
  }

  const text = result.data.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { isPOV: false, notes: 'Could not parse Vision response' };
  return JSON.parse(jsonMatch[0]);
}

module.exports = async function povCheck(output) {
  if (!output?.clip1?.url || !output?.clip2?.url) {
    return { pass: false, reason: 'Animate output missing clip URLs' };
  }

  const issues = [];

  for (const [key, clip] of Object.entries(output)) {
    if (!clip.url) continue;

    const videoPath = path.join(ASSETS_DIR, `pov-check-${key}.mp4`);
    const frame0Path = path.join(ASSETS_DIR, `pov-check-${key}-f0.jpg`);
    const frame5Path = path.join(ASSETS_DIR, `pov-check-${key}-f5.jpg`);

    try {
      // Download video
      await downloadVideo(clip.url, videoPath);

      // Extract frame at 0s and ~5s
      await ffmpeg.extractFrame(videoPath, 0, frame0Path);
      await ffmpeg.extractFrame(videoPath, 4.5, frame5Path);

      // Analyze both frames
      for (const [label, framePath] of [['start', frame0Path], ['end', frame5Path]]) {
        if (!fs.existsSync(framePath)) continue;

        const analysis = await analyzePOV(framePath, `${key} ${label} frame`);

        // Clip 1 start frame is non-POV (Patient Maya shot) — skip POV check
        if (key === 'clip1' && label === 'start') continue;

        if (!analysis.isPOV || !analysis.notThirdPerson) {
          issues.push(`${key} ${label}: NOT POV (${analysis.notes || 'third-person detected'})`);
        }
      }

      // Cleanup temp files
      for (const f of [videoPath, frame0Path, frame5Path]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    } catch (e) {
      issues.push(`${key}: analysis error — ${e.message}`);
    }
  }

  if (issues.length > 0) {
    return { pass: false, reason: issues.join('; ') };
  }

  return { pass: true, detail: 'POV integrity verified for all clips' };
};
