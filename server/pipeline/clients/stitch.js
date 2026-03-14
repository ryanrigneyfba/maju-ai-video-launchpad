'use strict';

const { fetchJSON, poll } = require('./http');
const { MAJU_SERVER, STITCH_TIMEOUT } = require('../config');

async function stitch(clipFilenames, captions) {
  const body = {
    clips:   clipFilenames.map(f => ({ filename: f })),
    options: { maxClipDuration: 6, audioBg: 'royalty_free_upbeat' },
  };
  if (captions) body.captionsAss = captions;

  const data = await fetchJSON(`${MAJU_SERVER}/api/stitch`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const jobId = data?.jobId;
  if (!jobId) throw new Error(`Stitch returned no jobId: ${JSON.stringify(data)}`);
  return jobId;
}

async function pollStitch(jobId) {
  return poll(
    `${MAJU_SERVER}/api/jobs/${jobId}`,
    {},
    (data) => {
      const status = (data?.status || '').toLowerCase();
      if (status === 'error') throw new Error(`Stitch job failed: ${data?.error}`);
      if (status === 'done') return data.outputFile;
      return null;
    },
    STITCH_TIMEOUT,
  );
}

function downloadURL(jobId) {
  return `${MAJU_SERVER}/api/download/${jobId}`;
}

function streamURL(jobId) {
  return `${MAJU_SERVER}/api/video/${jobId}.mp4`;
}

async function uploadClips(localPaths) {
  const FormData = (await import('node:buffer')).Blob
    ? globalThis.FormData
    : null;

  // Use fetch with FormData to upload clips
  const form = new globalThis.FormData();
  const fs   = require('fs');
  for (const p of localPaths) {
    const blob = new Blob([fs.readFileSync(p)], { type: 'video/mp4' });
    form.append('clips', blob, require('path').basename(p));
  }

  const res  = await fetch(`${MAJU_SERVER}/api/upload`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload failed: ${JSON.stringify(data)}`);
  return data.files.map(f => f.filename);
}

module.exports = { stitch, pollStitch, downloadURL, streamURL, uploadClips };
