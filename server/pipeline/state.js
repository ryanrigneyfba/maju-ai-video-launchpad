'use strict';

const fs   = require('fs');
const path = require('path');
const { RUNS_DIR } = require('./config');

const STAGES = ['brief', 'statics', 'animate', 'stitch', 'postprod', 'publish'];

function runPath(runId) {
  return path.join(RUNS_DIR, `${runId}.json`);
}

function create(animal, location) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const state = {
    runId,
    animal,
    location,
    createdAt: new Date().toISOString(),
    completedAt: null,
    stages: Object.fromEntries(
      STAGES.map(s => [s, { status: 'pending', attempts: [], output: null, error: null }])
    ),
  };
  save(state);
  return state;
}

function load(runId) {
  const p = runPath(runId);
  if (!fs.existsSync(p)) throw new Error(`Run not found: ${runId}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function save(state) {
  fs.writeFileSync(runPath(state.runId), JSON.stringify(state, null, 2));
}

function setStageRunning(state, stage) {
  state.stages[stage].status = 'running';
  state.stages[stage].attempts.push({ startedAt: new Date().toISOString(), error: null });
  save(state);
}

function setStagePass(state, stage, output) {
  state.stages[stage].status = 'passed';
  state.stages[stage].output = output;
  const last = state.stages[stage].attempts.at(-1);
  if (last) last.completedAt = new Date().toISOString();
  save(state);
}

function setStageFail(state, stage, error) {
  state.stages[stage].status = 'failed';
  state.stages[stage].error = error;
  const last = state.stages[stage].attempts.at(-1);
  if (last) { last.error = error; last.completedAt = new Date().toISOString(); }
  save(state);
}

function setComplete(state) {
  state.completedAt = new Date().toISOString();
  save(state);
}

function listAll() {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs.readdirSync(RUNS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function firstPendingStage(state) {
  return STAGES.find(s => state.stages[s].status !== 'passed') || null;
}

module.exports = {
  STAGES, create, load, save,
  setStageRunning, setStagePass, setStageFail, setComplete,
  listAll, firstPendingStage,
};
