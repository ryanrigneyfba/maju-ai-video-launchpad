'use strict';

const { qcVideo } = require('../clients/ffmpeg');

async function check(filePath) {
  return qcVideo(filePath);
}

module.exports = { check };
