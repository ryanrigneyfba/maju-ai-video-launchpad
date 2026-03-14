'use strict';

// Stage 1 — Generate creative brief via Claude
// Output: { brief } — the full JSON brief object

const { generateBrief }    = require('../clients/claude');
const { check: checkBrief } = require('../qc/brief-check');
const { RETRY_ATTEMPTS, RETRY_DELAYS } = require('../config');
const { sleep } = require('../clients/http');

async function run(state) {
  const { animal, location } = state;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      console.log(`  [brief] retry ${attempt}/${RETRY_ATTEMPTS - 1}...`);
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    try {
      console.log(`  [brief] generating brief for ${animal} in ${location}...`);
      const brief = await generateBrief(animal, location);

      const errors = checkBrief(brief);
      if (errors.length) {
        console.warn(`  [brief] QC failed:\n    ${errors.join('\n    ')}`);
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        throw new Error(`Brief QC failed: ${errors.join('; ')}`);
      }

      console.log(`  [brief] OK — "${brief.hookLine}"`);
      return { brief };
    } catch (err) {
      if (attempt === RETRY_ATTEMPTS - 1) throw err;
      console.warn(`  [brief] attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
}

module.exports = { run };
