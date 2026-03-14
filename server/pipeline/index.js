#!/usr/bin/env node
'use strict';

// Animal Stash Pipeline — CLI entry point
//
// Commands:
//   run    <animal> <location>   Start a new pipeline run
//   resume <runId>               Resume an interrupted run from last passed stage
//   retry  <runId> --stage <s>   Re-run a specific stage (and all after it)
//   status <runId>               Show run status
//   list                         List all runs

const { create, load, save, setStageRunning, setStagePass, setStageFail, setComplete, listAll, firstPendingStage, STAGES } = require('./state');

const STAGE_RUNNERS = {
  brief:    require('./stages/01-brief'),
  statics:  require('./stages/02-statics'),
  animate:  require('./stages/03-animate'),
  stitch:   require('./stages/04-stitch'),
  postprod: require('./stages/05-postprod'),
  publish:  require('./stages/06-publish'),
};

// ─── Run pipeline from a given stage ────────────────────────────────────────
async function runFrom(state, fromStage) {
  const startIdx = STAGES.indexOf(fromStage);
  if (startIdx === -1) throw new Error(`Unknown stage: ${fromStage}`);

  console.log(`\n[pipeline] run ${state.runId} | ${state.animal} in ${state.location}`);
  console.log(`[pipeline] starting from stage: ${fromStage}\n`);

  for (let i = startIdx; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const runner = STAGE_RUNNERS[stage];

    console.log(`[stage ${i + 1}/${STAGES.length}] ${stage.toUpperCase()}`);
    setStageRunning(state, stage);

    try {
      const output = await runner.run(state);
      setStagePass(state, stage, output);
      console.log(`[stage ${i + 1}/${STAGES.length}] ${stage} PASSED\n`);
    } catch (err) {
      setStageFail(state, stage, err.message);
      console.error(`[stage ${i + 1}/${STAGES.length}] ${stage} FAILED: ${err.message}`);
      console.error(`\n[pipeline] run ${state.runId} stopped at stage: ${stage}`);
      console.error(`[pipeline] to resume: node server/pipeline/index.js resume ${state.runId}`);
      process.exit(1);
    }
  }

  setComplete(state);
  console.log(`\n[pipeline] COMPLETE — run ${state.runId}`);
  printStatus(state);
}

// ─── Print run status table ──────────────────────────────────────────────────
function printStatus(state) {
  console.log(`\nRun:      ${state.runId}`);
  console.log(`Animal:   ${state.animal}`);
  console.log(`Location: ${state.location}`);
  console.log(`Created:  ${state.createdAt}`);
  if (state.completedAt) console.log(`Done:     ${state.completedAt}`);
  console.log('\nStages:');
  for (const s of STAGES) {
    const st = state.stages[s];
    const icon = { passed: 'OK', failed: 'FAIL', running: '...', pending: '---' }[st.status] || '?';
    console.log(`  [${icon}] ${s.padEnd(10)} ${st.error ? `— ${st.error}` : ''}`);
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {

    case 'run': {
      const animal   = args[0];
      const location = args[1];
      if (!animal || !location) {
        console.error('Usage: node server/pipeline/index.js run <animal> <location>');
        process.exit(1);
      }
      const state = create(animal, location);
      console.log(`[pipeline] created run ${state.runId}`);
      await runFrom(state, 'brief');
      break;
    }

    case 'resume': {
      const runId = args[0];
      if (!runId) {
        console.error('Usage: node server/pipeline/index.js resume <runId>');
        process.exit(1);
      }
      const state = load(runId);
      const next  = firstPendingStage(state);
      if (!next) {
        console.log(`[pipeline] run ${runId} is already complete.`);
        printStatus(state);
        break;
      }
      await runFrom(state, next);
      break;
    }

    case 'retry': {
      const runId = args[0];
      const stageFlag = args.indexOf('--stage');
      const stage = stageFlag !== -1 ? args[stageFlag + 1] : null;
      if (!runId || !stage) {
        console.error('Usage: node server/pipeline/index.js retry <runId> --stage <stageName>');
        process.exit(1);
      }
      if (!STAGES.includes(stage)) {
        console.error(`Unknown stage: ${stage}. Valid: ${STAGES.join(', ')}`);
        process.exit(1);
      }
      const state = load(runId);
      // Reset stage and all after it to pending
      const startIdx = STAGES.indexOf(stage);
      for (let i = startIdx; i < STAGES.length; i++) {
        state.stages[STAGES[i]].status   = 'pending';
        state.stages[STAGES[i]].error    = null;
        state.stages[STAGES[i]].output   = null;
        state.stages[STAGES[i]].attempts = [];
      }
      state.completedAt = null;
      save(state);
      await runFrom(state, stage);
      break;
    }

    case 'status': {
      const runId = args[0];
      if (!runId) {
        console.error('Usage: node server/pipeline/index.js status <runId>');
        process.exit(1);
      }
      printStatus(load(runId));
      break;
    }

    case 'list': {
      const runs = listAll();
      if (!runs.length) { console.log('No runs found.'); break; }
      console.log(`\n${'RunID'.padEnd(28)} ${'Animal'.padEnd(14)} ${'Location'.padEnd(18)} ${'Status'}`);
      console.log('-'.repeat(80));
      for (const r of runs) {
        const done = r.completedAt ? 'complete' : (firstPendingStage(r) ? `stopped:${firstPendingStage(r)}` : 'running');
        console.log(`${r.runId.padEnd(28)} ${r.animal.padEnd(14)} ${r.location.padEnd(18)} ${done}`);
      }
      break;
    }

    default:
      console.log(`Animal Stash Pipeline

Commands:
  run    <animal> <location>          Start new run
  resume <runId>                      Resume from last failed stage
  retry  <runId> --stage <stageName>  Re-run from a specific stage
  status <runId>                      Show run status
  list                                List all runs

Stages: ${STAGES.join(' -> ')}

Examples:
  node server/pipeline/index.js run fox "misty forest"
  node server/pipeline/index.js resume 1700000000000-abc123
  node server/pipeline/index.js retry  1700000000000-abc123 --stage animate
  node server/pipeline/index.js status 1700000000000-abc123
  node server/pipeline/index.js list
`);
  }
}

main().catch(err => {
  console.error('[pipeline] Fatal error:', err.message);
  process.exit(1);
});
