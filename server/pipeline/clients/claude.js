'use strict';

const { fetchJSON } = require('./http');
const { getKey, MAJU_SERVER } = require('../config');

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM = `You are a creative director for Animal Stash — a viral Instagram Reels series.

CONCEPT: GoPro first-person POV from a wild animal's perspective. The animal stumbles upon a hidden Maju Black Seed Oil bottle as their secret family stash. Patient Maya (a young woman) appears briefly in the establishing shot.

POV RULES (non-negotiable):
- Animal's ears visible at TOP of frame
- Animal's snout visible at BOTTOM of frame
- Paws/legs stepping FORWARD into scene
- NEVER show full animal body from outside perspective
- NEVER third-person camera angle

CLIP STRUCTURE:
- Clip 1: clip1Start (Patient Maya establishing shot — human hand/arm briefly visible) → clip1End (animal POV entering the scene)
- Clip 2: clip2Start (animal POV exploring) → clip2End (animal discovers Maju Black Seed Oil bottle)

PRODUCT RULES:
- Product = discovery moment, NEVER product placement
- Bottle label "MAJU BLACK SEED OIL" must be readable in clip2End frame
- Animal reaction to discovery = curious/excited sniffing

OUTPUT: Valid JSON only. No markdown, no explanation.`;

const USER_TMPL = (animal, location) => `Create an Animal Stash production brief for:
- Animal: ${animal}
- Location: ${location}

Return exactly this JSON structure:
{
  "concept": "1-2 sentence scene description",
  "hookLine": "Punchy hook for caption overlay, max 8 words, no hashtags",
  "staticFrames": {
    "clip1Start": "Detailed Higgsfield FNF image prompt — Patient Maya hand/arm visible, ${animal} ears at top of frame, establishing the ${location} scene, golden hour light, photorealistic, 9:16 vertical",
    "clip1End": "Detailed prompt — pure ${animal} GoPro POV, ears top snout bottom paws forward, entering ${location}, NO human visible, photorealistic, 9:16 vertical",
    "clip2Start": "Detailed prompt — pure ${animal} GoPro POV, deeper in ${location}, sniffing around, ears top snout bottom, NO human NO bottle visible yet, photorealistic, 9:16 vertical",
    "clip2End": "Detailed prompt — ${animal} GoPro POV, dark glass bottle labeled MAJU BLACK SEED OIL discovered in ${location}, bottle label facing camera and readable, ${animal} snout/nose visible at bottom, photorealistic, 9:16 vertical"
  },
  "animationPrompts": {
    "clip1": "Camera movement from Patient Maya to ${animal} POV entry — slow forward push, ears entering frame",
    "clip2": "Camera movement from exploring to discovery moment — slow sniff-forward approach to bottle"
  },
  "caption": "2-3 sentence Instagram caption, storytelling tone, no hashtags",
  "hashtags": ["AnimalStash", "${animal.replace(' ','')}"]
}`;

async function generateBrief(animal, location) {
  const apiKey = getKey('claudeApiKey');

  const data = await fetchJSON(`${MAJU_SERVER}/api/proxy/claude/messages`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-api-key-value': apiKey,
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 2048,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: USER_TMPL(animal, location) }],
    }),
  });

  const raw = data?.content?.[0]?.text?.trim() || '';
  const json = extractJSON(raw);
  return json;
}

function extractJSON(text) {
  let s = text.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
  }
  return JSON.parse(s);
}

module.exports = { generateBrief };
