'use strict';

const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '.maju-config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}

function getKey(name) {
  const cfg = readConfig();
  const val = cfg[name] || process.env[name.toUpperCase()];
  if (!val) throw new Error(`Missing config key: ${name}`);
  return val;
}

// ─── Soul IDs (Higgsfield FNF custom references) ─────────────────────────────
const SOULS = {
  patientMaya: '6bceded1-e872-41d7-824b-8476faf87fa4', // clip1Start — establishing shot
  majuBottle:  'b360f0d3-51f4-4801-85e7-be9adacc6a47', // clip2End   — product discovery
};

// ─── Which frame gets which soul ─────────────────────────────────────────────
// clip1Start → patientMaya  (human establishing shot)
// clip1End   → null         (pure animal POV)
// clip2Start → null         (pure animal POV)
// clip2End   → majuBottle   (product discovery)
const FRAME_SOULS = {
  clip1Start: SOULS.patientMaya,
  clip1End:   null,
  clip2Start: null,
  clip2End:   SOULS.majuBottle,
};

// ─── Service URLs ─────────────────────────────────────────────────────────────
const MAJU_SERVER    = process.env.MAJU_SERVER    || 'http://localhost:3001';
const OBSIDIAN_API   = process.env.OBSIDIAN_API   || 'https://localhost:27124';

// ─── Pipeline constants ───────────────────────────────────────────────────────
const RETRY_ATTEMPTS  = 3;
const RETRY_DELAYS    = [2000, 4000, 8000]; // ms, exponential backoff
const POLL_INTERVAL   = 3000;               // ms between status polls
const IMAGE_TIMEOUT   = 180_000;            // 3 min
const VIDEO_TIMEOUT   = 360_000;            // 6 min
const STITCH_TIMEOUT  = 300_000;            // 5 min
const JWT_WAIT_TIMEOUT = 120_000;           // 2 min to wait for bookmarklet JWT

// ─── Assets ───────────────────────────────────────────────────────────────────
const ASSETS_DIR      = path.join(__dirname, 'assets');
const CRACK_OVERLAY   = path.join(ASSETS_DIR, 'crack-overlay.png');
const REEL_AUDIO      = path.join(ASSETS_DIR, 'ReelAudio-27687.mp3');

// ─── Runs directory ───────────────────────────────────────────────────────────
const RUNS_DIR = path.join(__dirname, 'runs');
fs.mkdirSync(RUNS_DIR, { recursive: true });

module.exports = {
  getKey, readConfig,
  SOULS, FRAME_SOULS,
  MAJU_SERVER, OBSIDIAN_API,
  RETRY_ATTEMPTS, RETRY_DELAYS,
  POLL_INTERVAL, IMAGE_TIMEOUT, VIDEO_TIMEOUT, STITCH_TIMEOUT, JWT_WAIT_TIMEOUT,
  ASSETS_DIR, CRACK_OVERLAY, REEL_AUDIO,
  RUNS_DIR,
};
