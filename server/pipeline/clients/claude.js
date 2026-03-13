/**
 * Claude (Anthropic) client — brief generation via Claude Haiku.
 * Calls POST /api/proxy/claude/messages on the MAJU backend.
 */
const { request } = require('./http');
const { getKey } = require('../config');

async function generateBrief(animal, location) {
  const apiKey = getKey('claudeApiKey');
  if (!apiKey) throw new Error('Missing Claude API key in config (claudeApiKey)');

  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Generate a complete Animal Stash creative brief for: ${animal} — ${location}

Output the brief as JSON with this structure:
{
  "concept": "1-2 sentence pitch",
  "hookLine": "lowercase caption hook",
  "staticFrames": {
    "clip1Start": "full prompt text (WITH Patient Maya element)",
    "clip1End": "full prompt text (NO element)",
    "clip2Start": "full prompt text (NO element)",
    "clip2End": "full prompt text (WITH MajuBottle element)"
  },
  "animationPrompts": {
    "clip1": "full animation prompt (WITH Patient Maya)",
    "clip2": "full animation prompt (WITH MajuBottle)"
  },
  "hashtags": ["#Tag1", "#Tag2", ...],
  "caption": "full caption with hashtags",
  "technicalNotes": {
    "animalBreed": "specific breed",
    "bodyFeatures": "ears, snout, etc.",
    "hiddenLocationType": "attic, burrow, etc.",
    "familyComposition": "mama + 3 babies, etc.",
    "headHeightInches": 8
  }
}`;

  const result = await request('/api/proxy/claude/messages', 'POST', {
    'x-api-key-value': apiKey,
  }, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (result.status !== 200) {
    throw new Error(`Claude API error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }

  // Extract text content
  const text = result.data.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');

  // Parse JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude response did not contain valid JSON');

  return JSON.parse(jsonMatch[0]);
}

function buildSystemPrompt() {
  return `You are the Animal Stash Creative Brief Factory. You generate production-ready creative briefs for the Animal Stash viral video format.

## The Formula
Every Animal Stash video: an animal wearing a GoPro discovers its hidden family in a secret location, gathered around a bottle of Maju Cold-Pressed Black Seed Oil. The viewer sees everything through the animal's eyes (first-person POV).

## Core Constants
- Product: Maju Cold-Pressed Black Seed Oil (dark bottle, gold label)
- POV style: GoPro strapped to animal's head — animal's ears/nose/whiskers visible at frame edges
- Video structure: 2 clips, ~6 seconds each (12 seconds total)
- Clip 1: Hook + journey (animal explores toward hidden location)
- Clip 2: Discovery + reveal (animal finds hidden family with product)

## Element Tagging Rules
- Clip 1 Start Frame: Patient Maya element (Maya holding animal — establishing shot)
- Clip 1 End Frame: NO element (pure POV)
- Clip 2 Start Frame: NO element (pure POV)
- Clip 2 End Frame: MajuBottle element (family + product reveal)
- Clip 1 Animation: Patient Maya element
- Clip 2 Animation: MajuBottle element

## POV Writing Rules (CRITICAL)
Camera is MOUNTED ON TOP of the animal's head pointing forward. The viewer sees through the animal's eyes.

What MUST be visible in every POV frame:
- Animal's own LARGE nose/snout PROMINENTLY at bottom of frame
- Animal's own LARGE ears PROMINENTLY at top edges of frame
- When walking: animal's own LARGE front paws filling lower portion of frame
- Ground/path ahead from animal's low head height

Use STRONG size descriptors: "LARGE", "PROMINENTLY", "CLOSE-UP", "filling the lower portion"

## Clip 1 Start Frame Special Rule
This is the ONLY non-POV frame. It shows Patient Maya (a young woman, black tank top, hair in bun) holding the animal. The animal has a small GoPro on its head. Maya faces camera, smiling. This establishes the owner+pet relationship before the POV adventure begins.

## Hashtag Strategy
5-8 total: 2 primary high-volume animal tags, 1-2 niche community tags, #MajuBlackSeedOil, #AnimalStash, 1-2 viral triggers

Output valid JSON only. No markdown, no explanation — just the JSON object.`;
}

module.exports = { generateBrief };
