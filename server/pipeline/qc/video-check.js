'use strict';

const { qcVideo } = require('../clients/ffmpeg');

// requireAudio: false for pre-postprod stitched video (audio added in postprod)
async function check(filePath, { requireAudio = true } = {}) {
  return qcVideo(filePath, { requireAudio });
}

module.exports = { check };
