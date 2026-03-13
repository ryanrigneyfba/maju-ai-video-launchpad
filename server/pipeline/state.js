/**
 * Pipeline state machine — JSON persistence per run.
 * Each run is a JSON file in server/pipeline/runs/<runId>.json
 */
const fs = require('fs');
const path = require('path');
const { RUNS_DIR } = require('./config');

const STAGES = ['brief', 'statics', 'animate', 'stitch', 'postprod', 'publish'];

function createRun(animal, location) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = `${animal}-${location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const runId = `as-${date}-${slug}`;

  const stages = {};
  for (const s of STAGES) {
    stages[s] = { status: 'pending', output: null, attempts: [] };
  }

  return {
    runId,
    animal,
    location,
    createdAt: new Date().toISOString(),
    currentStage: 'brief',
    retryCount: Object.fromEntries(STAGES.map(s => [s, 0])),
    stages,
  };
}

function save(state) {
  const filePath = path.join(RUNS_DIR, `${state.runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

function load(runId) {
  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Run not found: ${runId}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listRuns() {
  return fs.readdirSync(RUNS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8'));
        return { runId: data.runId, animal: data.animal, location: data.location, currentStage: data.currentStage, createdAt: data.createdAt };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function latestRun() {
  const runs = listRuns();
  return runs.length ? load(runs[0].runId) : null;
}

module.exports = { STAGES, createRun, save, load, listRuns, latestRun };
