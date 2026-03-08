#!/usr/bin/env node

// Standalone script to run a research cycle directly
// Usage: node src/run-cycle.js
// Or: npm run research

require('dotenv/config');
const { runFullCycle } = require('./research-cycle');

runFullCycle()
  .then(result => {
    console.log('\nDone! Cycle ID:', result.cycleId);
    process.exit(0);
  })
  .catch(err => {
    console.error('Cycle failed:', err);
    process.exit(1);
  });
