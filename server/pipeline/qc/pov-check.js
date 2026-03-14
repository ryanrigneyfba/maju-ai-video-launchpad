'use strict';

// POV Integrity Check — the most critical QC gate.
// Extracts frames at 0s and 4.5s, sends to Claude Vision, checks first-person POV.

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { extractFrame } = require('../clients/ffmpeg');
const { fetchJSON }    = require('../clients/http');
const { getKey } = require('../config');

const SYSTEM = `You are a POV integrity checker for Animal Stash videos.
Rules (STRICT):
- Valid POV: animal's ears visible at TOP, snout at BOTTOM, first-person perspective
- Invalid: full animal body visible from outside, third-person camera, no animal parts visible
- Exception: clip1Start frame is allowed to show a human (Patient Maya establishing shot)

Respond with JSON only: { "valid": true/false, "reason": "one sentence" }`;

async function check(clipPath, clipLabel, isClip1Start = false) {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'pov-'));
  const frame0   = path.join(tmpDir, 'frame0.jpg');
  const frame45  = path.join(tmpDir, 'frame45.jpg');
  const errors   = [];

  try {
    await extractFrame(clipPath, 0,   frame0);
    await extractFrame(clipPath, 4.5, frame45);

    for (const [label, framePath] of [['0s', frame0], ['4.5s', frame45]]) {
      // Skip 0s check for clip1Start — Patient Maya establishing shot
      if (isClip1Start && label === '0s') continue;

      const result = await checkFrame(framePath, clipLabel, label);
      if (!result.valid) errors.push(`${clipLabel} @ ${label}: ${result.reason}`);
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }

  return errors;
}

async function checkFrame(framePath, clipLabel, timeLabel) {
  const apiKey  = getKey('claudeApiKey');
  const imgData = fs.readFileSync(framePath).toString('base64');

  // Call Claude API directly — avoids MAJU proxy body size limits
  const data = await fetchJSON('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:     SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imgData },
          },
          {
            type: 'text',
            text: `Check this frame (${clipLabel} at ${timeLabel}) for valid animal GoPro POV.`,
          },
        ],
      }],
    }),
  });

  const raw = data?.content?.[0]?.text?.trim() || '{}';
  try {
    const s = raw.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
    return JSON.parse(s);
  } catch {
    return { valid: false, reason: `Could not parse Claude response: ${raw.slice(0, 100)}` };
  }
}

module.exports = { check };
