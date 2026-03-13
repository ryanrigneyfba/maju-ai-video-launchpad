#!/usr/bin/env node
/**
 * Animal Stash Pipeline Orchestrator
 *
 * Usage:
 *   node server/pipeline/index.js run --animal "raccoon" --location "attic"
 *   node server/pipeline/index.js resume --run-id <id>
 *   node server/pipeline/index.js retry --run-id <id> --stage animate
 *   node server/pipeline/index.js status [--run-id <id>]
 *   node server/pipeline/index.js list
 */
const { SERVER_BASE, MAX_RETRIES, RETRY_BASE_MS } = require('./config');
const state = require('./state');
const http = require('http');

// Stage runners (loaded lazily)
const STAGE_RUNNERS = {
  brief:    () => require('./stages/brief'),
  statics:  () => require('./stages/statics'),
  animate:  () => require('./stages/animate'),
  stitch:   () => require('./stages/stitch'),
  postprod: () => require('./stages/postprod'),
  publish:  () => require('./stages/publish'),
};

// QC runners per stage
const QC_RUNNERS = {
  brief:    () => require('./qc/brief-check'),
  statics:  () => require('./qc/image-check'),
  animate:  () => require('./qc/pov-check'),
  stitch:   () => require('./qc/video-check'),
  postprod: () => require('./qc/video-check'),
  publish:  null, // publish QC is inline (API response check)
};

// ─── Logging ───
const log = (tag, msg) => console.log(`\x1b[36m[${tag}]\x1b[0m ${msg}`);
const ok  = (tag, msg) => console.log(`\x1b[32m[${tag}]\x1b[0m ${msg}`);
const err = (tag, msg) => console.log(`\x1b[31m[${tag}]\x1b[0m ${msg}`);
const dim = (msg) => console.log(`\x1b[2m  ${msg}\x1b[0m`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Health Check ───
async function checkServer() {
  return new Promise((resolve) => {
    http.get(`${SERVER_BASE}/api/health`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).status === 'ok'); }
        catch { resolve(false); }
      });
    }).on('error', () => resolve(false));
  });
}

// ─── Orchestrator ───
async function runPipeline(run, { skipPublish = false, dryRun = false, fromStage = null } = {}) {
  log('PIPELINE', `${run.runId} — ${run.animal} / ${run.location}`);

  const stages = state.STAGES.filter(s => !skipPublish || s !== 'publish');
  let started = !fromStage;

  for (let i = 0; i < stages.length; i++) {
    const stageName = stages[i];

    if (!started) {
      if (stageName === fromStage) started = true;
      else continue;
    }

    if (run.stages[stageName].status === 'done') {
      ok(`${i + 1}/${stages.length}`, `${stageName} — ALREADY DONE`);
      continue;
    }

    run.currentStage = stageName;
    run.stages[stageName].status = 'in_progress';
    state.save(run);

    log(`${i + 1}/${stages.length}`, `${stageName} ...`);

    if (dryRun) {
      ok(`${i + 1}/${stages.length}`, `${stageName} — DRY RUN (skipped)`);
      run.stages[stageName].status = 'done';
      run.stages[stageName].output = { dryRun: true };
      state.save(run);
      continue;
    }

    let success = false;
    for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
      const startMs = Date.now();
      try {
        const runner = STAGE_RUNNERS[stageName]();
        const output = await runner(run);

        // Run QC if available
        const qcLoader = QC_RUNNERS[stageName];
        if (qcLoader) {
          const qc = qcLoader();
          const qcResult = await qc(output, run);
          if (!qcResult.pass) {
            throw new Error(`QC failed: ${qcResult.reason}`);
          }
          dim(`QC passed: ${qcResult.detail || 'ok'}`);
        }

        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
        run.stages[stageName] = {
          status: 'done',
          output,
          completedAt: new Date().toISOString(),
          attempts: run.stages[stageName].attempts || [],
        };
        success = true;
        ok(`${i + 1}/${stages.length}`, `${stageName} — DONE (${elapsed}s)`);
      } catch (e) {
        run.retryCount[stageName]++;
        run.stages[stageName].attempts = run.stages[stageName].attempts || [];
        run.stages[stageName].attempts.push({ at: new Date().toISOString(), error: e.message });
        state.save(run);

        if (attempt < MAX_RETRIES - 1) {
          const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
          err(`${i + 1}/${stages.length}`, `${stageName} attempt ${attempt + 1} failed: ${e.message}`);
          dim(`Retrying in ${backoff / 1000}s...`);
          await sleep(backoff);
        } else {
          err(`${i + 1}/${stages.length}`, `${stageName} FAILED after ${MAX_RETRIES} attempts: ${e.message}`);
        }
      }
    }

    if (!success) {
      run.stages[stageName].status = 'failed';
      run.currentStage = 'failed';
      state.save(run);
      await alertFailure(run, stageName);
      return;
    }

    state.save(run);
  }

  run.currentStage = 'done';
  state.save(run);
  ok('PIPELINE', `${run.runId} — COMPLETE`);

  // Log to Obsidian
  try {
    const obsidian = require('./logging/obsidian');
    await obsidian.logRun(run);
    dim('Logged to Obsidian');
  } catch (e) {
    dim(`Obsidian log skipped: ${e.message}`);
  }
}

async function alertFailure(run, stageName) {
  err('ALERT', `Pipeline ${run.runId} failed at stage "${stageName}"`);
  const lastAttempt = run.stages[stageName].attempts.slice(-1)[0];
  if (lastAttempt) dim(`Last error: ${lastAttempt.error}`);
  dim(`Resume with: node server/pipeline/index.js resume --run-id ${run.runId}`);

  // Try Obsidian alert
  try {
    const obsidian = require('./logging/obsidian');
    await obsidian.logFailure(run, stageName);
  } catch { /* silent */ }
}

// ─── CLI ───
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = val;
      if (val !== true) i++;
    }
  }
  return args;
}

function printStatus(run) {
  log('STATUS', `${run.runId} — ${run.animal} / ${run.location}`);
  dim(`Created: ${run.createdAt}`);
  dim(`Current: ${run.currentStage}`);
  console.log('');
  for (const s of state.STAGES) {
    const st = run.stages[s];
    const icon = st.status === 'done' ? '\x1b[32m✓\x1b[0m' :
                 st.status === 'failed' ? '\x1b[31m✗\x1b[0m' :
                 st.status === 'in_progress' ? '\x1b[33m⟳\x1b[0m' : '·';
    const retries = run.retryCount[s] > 0 ? ` (${run.retryCount[s]} retries)` : '';
    console.log(`  ${icon} ${s.padEnd(10)} ${st.status}${retries}`);
    if (st.attempts.length && st.status === 'failed') {
      dim(`  Last: ${st.attempts.slice(-1)[0].error}`);
    }
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (command) {
    case 'run': {
      if (!args.animal || !args.location) {
        err('CLI', 'Usage: run --animal <name> --location <place>');
        process.exit(1);
      }
      const healthy = await checkServer();
      if (!healthy) {
        err('CLI', `Server not responding at ${SERVER_BASE}. Start it first: node server/index.js`);
        process.exit(1);
      }
      const run = state.createRun(args.animal, args.location);
      state.save(run);
      await runPipeline(run, {
        skipPublish: args['skip-publish'] === true,
        dryRun: args['dry-run'] === true,
      });
      break;
    }

    case 'resume': {
      const runId = args['run-id'];
      if (!runId) { err('CLI', 'Usage: resume --run-id <id>'); process.exit(1); }
      const healthy = await checkServer();
      if (!healthy) { err('CLI', `Server not responding at ${SERVER_BASE}`); process.exit(1); }
      const run = state.load(runId);
      // Find the first non-done stage
      const fromStage = state.STAGES.find(s => run.stages[s].status !== 'done');
      if (!fromStage) { ok('CLI', 'All stages already done'); break; }
      // Reset the failed stage so it can re-run
      if (run.stages[fromStage].status === 'failed') {
        run.stages[fromStage].status = 'pending';
      }
      await runPipeline(run, { fromStage, skipPublish: args['skip-publish'] === true });
      break;
    }

    case 'retry': {
      const runId = args['run-id'];
      const stage = args.stage;
      if (!runId || !stage) { err('CLI', 'Usage: retry --run-id <id> --stage <name>'); process.exit(1); }
      if (!state.STAGES.includes(stage)) { err('CLI', `Invalid stage: ${stage}`); process.exit(1); }
      const healthy = await checkServer();
      if (!healthy) { err('CLI', `Server not responding at ${SERVER_BASE}`); process.exit(1); }
      const run = state.load(runId);
      run.stages[stage].status = 'pending';
      run.retryCount[stage] = 0;
      state.save(run);
      await runPipeline(run, { fromStage: stage, skipPublish: args['skip-publish'] === true });
      break;
    }

    case 'status': {
      const runId = args['run-id'];
      const run = runId ? state.load(runId) : state.latestRun();
      if (!run) { err('CLI', 'No runs found'); process.exit(1); }
      printStatus(run);
      break;
    }

    case 'list': {
      const runs = state.listRuns();
      if (!runs.length) { dim('No runs yet.'); break; }
      for (const r of runs) {
        const icon = r.currentStage === 'done' ? '✓' : r.currentStage === 'failed' ? '✗' : '⟳';
        console.log(`  ${icon} ${r.runId.padEnd(35)} ${r.currentStage.padEnd(10)} ${r.createdAt.slice(0, 10)}`);
      }
      break;
    }

    default:
      console.log('Animal Stash Pipeline');
      console.log('');
      console.log('Commands:');
      console.log('  run      --animal <name> --location <place> [--dry-run] [--skip-publish]');
      console.log('  resume   --run-id <id> [--skip-publish]');
      console.log('  retry    --run-id <id> --stage <name> [--skip-publish]');
      console.log('  status   [--run-id <id>]');
      console.log('  list');
  }
}

main().catch(e => { err('FATAL', e.message); process.exit(1); });
