/**
 * Stage 1: Brief — generate creative brief from animal + location.
 * @param {object} run - Pipeline run state
 * @returns {object} - Brief JSON output
 */
const claude = require('../clients/claude');

module.exports = async function brief(run) {
  const result = await claude.generateBrief(run.animal, run.location);
  return result;
};
