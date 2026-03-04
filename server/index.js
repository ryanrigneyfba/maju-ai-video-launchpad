/* ═══════════════════════════════════════════
   MAJU AI Video Launchpad — Backend Server
   FFmpeg stitching + job management
   ═══════════════════════════════════════════ */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Directories ───
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use('/output', express.static(OUTPUT_DIR));

// ─── File Upload ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB per clip
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
});

// ─── Job Tracking ───
const jobs = new Map();

// ─── SOP Segment Definitions ───
// Based on Selfcare Snack Reel SOP
const SOP_SEGMENTS = {
  'selfcare-snack-reel': [
    { name: 'hook', label: 'Hook (0-3s)', maxDuration: 3 },
    { name: 'reveal', label: 'Reveal (3-8s)', maxDuration: 5 },
    { name: 'demo', label: 'Application/Demo (8-18s)', maxDuration: 10 },
    { name: 'result', label: 'Result + CTA (18-25s)', maxDuration: 7 },
    { name: 'endcard', label: 'End Card (25-30s)', maxDuration: 5 },
  ],
};

// ─── Routes ───

// Health check
app.get('/api/health', (req, res) => {
  // Check if ffmpeg is available
  const ffcheck = spawn('ffmpeg', ['-version']);
  let found = false;
  ffcheck.on('close', (code) => {
    if (!found) {
      found = true;
      res.json({
        status: 'ok',
        ffmpeg: code === 0,
        jobs: jobs.size,
      });
    }
  });
  ffcheck.on('error', () => {
    if (!found) {
      found = true;
      res.json({
        status: 'ok',
        ffmpeg: false,
        jobs: jobs.size,
      });
    }
  });
});

// Get SOP segment definitions
app.get('/api/sop/:name/segments', (req, res) => {
  const sop = SOP_SEGMENTS[req.params.name];
  if (!sop) return res.status(404).json({ error: 'SOP not found' });
  res.json({ segments: sop });
});

// Upload clips
app.post('/api/upload', upload.array('clips', 10), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const files = req.files.map((f) => ({
    id: path.basename(f.filename, path.extname(f.filename)),
    filename: f.filename,
    originalName: f.originalname,
    size: f.size,
    path: f.path,
  }));
  res.json({ files });
});

// Stitch video from uploaded clips
app.post('/api/stitch', (req, res) => {
  const { clips, options = {} } = req.body;

  // clips: array of { filename } in stitch order
  // options: { resolution, overlayText, audioBg, format }
  if (!clips || !clips.length) {
    return res.status(400).json({ error: 'No clips provided' });
  }

  // Validate all clip files exist
  for (const clip of clips) {
    const clipPath = path.join(UPLOAD_DIR, clip.filename);
    if (!fs.existsSync(clipPath)) {
      return res.status(400).json({ error: `Clip not found: ${clip.filename}` });
    }
  }

  const jobId = uuidv4();
  const outputFile = `${jobId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFile);

  jobs.set(jobId, {
    id: jobId,
    status: 'processing',
    progress: 0,
    clips: clips.length,
    outputFile: null,
    error: null,
    createdAt: new Date().toISOString(),
  });

  // Build FFmpeg concat command
  runStitch(jobId, clips, outputPath, options);

  res.json({ jobId, status: 'processing' });
});

// Full pipeline: upload + stitch in one request
app.post(
  '/api/pipeline',
  upload.array('clips', 10),
  (req, res) => {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'No clips uploaded' });
    }

    const options = req.body.options ? JSON.parse(req.body.options) : {};
    const clips = req.files.map((f) => ({ filename: f.filename }));

    const jobId = uuidv4();
    const outputFile = `${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    jobs.set(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
      clips: clips.length,
      outputFile: null,
      error: null,
      createdAt: new Date().toISOString(),
    });

    runStitch(jobId, clips, outputPath, options);

    res.json({
      jobId,
      status: 'processing',
      uploadedFiles: req.files.map((f) => f.filename),
    });
  }
);

// Job status
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// List all jobs
app.get('/api/jobs', (req, res) => {
  const all = Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ jobs: all });
});

// Download finished video
app.get('/api/download/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(400).json({ error: 'Job not complete' });
  const filePath = path.join(OUTPUT_DIR, job.outputFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.download(filePath);
});

// ─── FFmpeg Stitching Logic ───
function runStitch(jobId, clips, outputPath, options = {}) {
  const job = jobs.get(jobId);
  const resolution = options.resolution || '1080x1920'; // 9:16 vertical default
  const format = options.format || 'mp4';

  // Create concat file list for FFmpeg
  const concatListPath = path.join(UPLOAD_DIR, `${jobId}-concat.txt`);
  const concatContent = clips
    .map((c) => `file '${path.join(UPLOAD_DIR, c.filename)}'`)
    .join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  // Build FFmpeg args
  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
  ];

  // Scale to target resolution (9:16 vertical for Reels/TikTok/Shorts)
  const [w, h] = resolution.split('x');
  args.push(
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
  );

  // Text overlay if provided
  if (options.overlayText) {
    const escaped = options.overlayText.replace(/'/g, "'\\''");
    args.push(
      '-vf', `drawtext=text='${escaped}':fontsize=48:fontcolor=white:x=(w-tw)/2:y=h-80:shadowcolor=black:shadowx=2:shadowy=2`
    );
  }

  // Audio background track if provided
  if (options.audioBg) {
    const audioPath = path.join(UPLOAD_DIR, options.audioBg);
    if (fs.existsSync(audioPath)) {
      args.push('-i', audioPath, '-shortest');
    }
  }

  // Output settings
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath
  );

  const ffmpeg = spawn('ffmpeg', args);

  let stderrData = '';
  ffmpeg.stderr.on('data', (data) => {
    stderrData += data.toString();
    // Parse progress from FFmpeg output
    const timeMatch = data.toString().match(/time=(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      const secs = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
      // Estimate total ~30s for a selfcare snack reel
      job.progress = Math.min(95, Math.round((secs / 30) * 100));
    }
  });

  ffmpeg.on('close', (code) => {
    // Clean up concat list
    try { fs.unlinkSync(concatListPath); } catch {}

    if (code === 0) {
      job.status = 'done';
      job.progress = 100;
      job.outputFile = path.basename(outputPath);
      job.completedAt = new Date().toISOString();
    } else {
      job.status = 'error';
      job.error = `FFmpeg exited with code ${code}`;
      job.ffmpegLog = stderrData.slice(-500);
    }
  });

  ffmpeg.on('error', (err) => {
    job.status = 'error';
    job.error = err.message;
  });
}

// ─── API Proxy Routes ───
// Proxy third-party API calls to avoid CORS issues from the browser.
// Frontend sends API keys in x-api-key-value header; backend forwards them properly.

const https = require('https');
const http = require('http');

function proxyRequest(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── Claude (Anthropic) Proxy — AI Learning Loop ──
app.post('/api/proxy/claude/messages', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Claude API key' });
  try {
    const result = await proxyRequest(
      'https://api.anthropic.com/v1/messages',
      'POST',
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Higgsfield Proxy ──
app.post('/api/proxy/higgsfield/generate', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      'https://api.higgsfield.ai/v1/video/generate',
      'POST',
      { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/proxy/higgsfield/revise', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      'https://api.higgsfield.ai/v1/video/revise',
      'POST',
      { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/proxy/higgsfield/status/:videoId', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      `https://api.higgsfield.ai/v1/video/${encodeURIComponent(req.params.videoId)}`,
      'GET',
      { 'Authorization': `Bearer ${apiKey}` }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Metricool Proxy ──
app.get('/api/proxy/metricool/posts', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const qs = new URLSearchParams(req.query).toString();
    const result = await proxyRequest(
      `https://app.metricool.com/api/v2/scheduler/posts${qs ? '?' + qs : ''}`,
      'GET',
      { 'X-Mc-Auth': apiKey, 'Content-Type': 'application/json' }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/proxy/metricool/posts', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      'https://app.metricool.com/api/v2/scheduler/posts',
      'POST',
      { 'X-Mc-Auth': apiKey, 'Content-Type': 'application/json' },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Metricool Analytics Proxy ──
app.get('/api/proxy/metricool/networks', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      'https://app.metricool.com/api/v2/analytics/networks',
      'GET',
      { 'X-Mc-Auth': apiKey, 'Content-Type': 'application/json' }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/proxy/metricool/analytics/:network', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const qs = new URLSearchParams(req.query).toString();
    const result = await proxyRequest(
      `https://app.metricool.com/api/v2/analytics/${encodeURIComponent(req.params.network)}${qs ? '?' + qs : ''}`,
      'GET',
      { 'X-Mc-Auth': apiKey, 'Content-Type': 'application/json' }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/proxy/metricool/top-posts', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const qs = new URLSearchParams(req.query).toString();
    const result = await proxyRequest(
      `https://app.metricool.com/api/v2/analytics/posts${qs ? '?' + qs : ''}`,
      'GET',
      { 'X-Mc-Auth': apiKey, 'Content-Type': 'application/json' }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Arcads Proxy ──
app.post('/api/proxy/arcads/videos', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      'https://api.arcads.ai/v1/videos',
      'POST',
      { 'Authorization': `Basic ${apiKey}`, 'Content-Type': 'application/json' },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/proxy/arcads/videos/:videoId', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  try {
    const result = await proxyRequest(
      `https://api.arcads.ai/v1/videos/${encodeURIComponent(req.params.videoId)}`,
      'GET',
      { 'Authorization': `Basic ${apiKey}` }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Creatify Proxy ──
app.post('/api/proxy/creatify/gen-image', async (req, res) => {
  const apiId = req.headers['x-creatify-id'];
  const apiKey = req.headers['x-creatify-key'];
  if (!apiId || !apiKey) return res.status(400).json({ error: 'Missing Creatify credentials' });
  try {
    const result = await proxyRequest(
      'https://api.creatify.ai/api/product_to_videos/gen_image/',
      'POST',
      { 'X-API-ID': apiId, 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/proxy/creatify/:taskId/gen-video', async (req, res) => {
  const apiId = req.headers['x-creatify-id'];
  const apiKey = req.headers['x-creatify-key'];
  if (!apiId || !apiKey) return res.status(400).json({ error: 'Missing Creatify credentials' });
  try {
    const result = await proxyRequest(
      `https://api.creatify.ai/api/product_to_videos/${encodeURIComponent(req.params.taskId)}/gen_video/`,
      'POST',
      { 'X-API-ID': apiId, 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/proxy/creatify/:taskId/status', async (req, res) => {
  const apiId = req.headers['x-creatify-id'];
  const apiKey = req.headers['x-creatify-key'];
  if (!apiId || !apiKey) return res.status(400).json({ error: 'Missing Creatify credentials' });
  try {
    const result = await proxyRequest(
      `https://api.creatify.ai/api/product_to_videos/${encodeURIComponent(req.params.taskId)}/`,
      'GET',
      { 'X-API-ID': apiId, 'X-API-KEY': apiKey }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─── Serve Frontend (for local dev) ───
app.use(express.static(path.join(__dirname, '..'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  },
}));

// ─── Start ───
app.listen(PORT, () => {
  console.log(`MAJU Backend running on http://localhost:${PORT}`);
  console.log(`  Frontend:  http://localhost:${PORT} (serves index.html)`);
  console.log(`  POST /api/upload         — Upload clips`);
  console.log(`  POST /api/stitch         — Stitch clips into final video`);
  console.log(`  POST /api/pipeline       — Upload + stitch in one step`);
  console.log(`  GET  /api/jobs/:id       — Check job status`);
  console.log(`  GET  /api/download/:id   — Download finished video`);
  console.log(`  GET  /api/health         — Health check`);
  console.log(`  /api/proxy/higgsfield/*  — Higgsfield proxy`);
  console.log(`  /api/proxy/metricool/*   — Metricool proxy`);
  console.log(`  /api/proxy/arcads/*      — Arcads proxy`);
  console.log(`  /api/proxy/creatify/*    — Creatify proxy`);
});
