/**
 * Pipeline configuration — reads API keys from server/.maju-config.json
 * and provides constants used across all stages.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '.maju-config.json');
const SERVER_BASE = process.env.MAJU_SERVER || 'http://localhost:3001';

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}

function getKey(name) {
  const config = readConfig();
  return config[name] || process.env[`MAJU_${name.toUpperCase()}`] || '';
}

// Higgsfield Soul IDs
const SOUL_IDS = {
  person: '6bceded1-e872-41d7-824b-8476faf87fa4',   // Patient Maya
  product: 'b360f0d3-51f4-4801-85e7-be9adacc6a47',  // MajuBottle
};

// Kling universal negative prompt (from js/app.js line 587)
const KLING_NEGATIVE_PROMPT = 'transition, fade, dissolve, wipe, zoom in, zoom out, dolly, pan, tilt, camera movement, camera shake, morph, transform, cross-fade, flash, glitch, distortion, lens flare, speed ramp, slow motion, time-lapse, split screen, picture-in-picture, text overlay, watermark, logo';

// Obsidian Local REST API
const OBSIDIAN_BASE = process.env.OBSIDIAN_API || 'https://localhost:27124';
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY || getKey('obsidianApiKey');

// Pipeline directories
const PIPELINE_DIR = __dirname;
const RUNS_DIR = path.join(PIPELINE_DIR, 'runs');
const ASSETS_DIR = path.join(PIPELINE_DIR, 'assets');

// Ensure dirs exist
fs.mkdirSync(RUNS_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });

module.exports = {
  SERVER_BASE,
  readConfig,
  getKey,
  SOUL_IDS,
  KLING_NEGATIVE_PROMPT,
  OBSIDIAN_BASE,
  OBSIDIAN_KEY,
  PIPELINE_DIR,
  RUNS_DIR,
  ASSETS_DIR,
  MAX_RETRIES: 3,
  RETRY_BASE_MS: 2000,
};
