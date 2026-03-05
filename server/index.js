/* ═══════════════════════════════════════════
   MAJU AI Video Launchpad — Backend Server
   FFmpeg stitching + job management
   v1.2.2 — redeploy
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
// Based on Selfcare Snack Reel SOP v2.0 — Anti-Puffy Face Snack Format
const SOP_SEGMENTS = {
  'selfcare-snack-reel': [
    { name: 'hook', label: 'Hook (0-3s)', maxDuration: 3 },
    { name: 'reveal', label: 'The Reveal — Pour (3-6s)', maxDuration: 3 },
    { name: 'demo', label: 'The Demo — Eating (6-11s)', maxDuration: 5 },
    { name: 'result', label: 'Result + Benefits (11-13s)', maxDuration: 2 },
    { name: 'glow', label: 'The Glow — CTA (13-15s)', maxDuration: 2 },
  ],
};

// ─── Persistent Config (API keys synced across devices) ───
const CONFIG_PATH = path.join(__dirname, '.maju-config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// ─── Routes ───

// Get stored API keys
app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

// Save API keys
app.post('/api/config', (req, res) => {
  const keys = req.body;
  if (!keys || typeof keys !== 'object') return res.status(400).json({ error: 'Invalid body' });
  writeConfig(keys);
  res.json({ ok: true });
});

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

// Debug: validate Higgsfield API key (no generations — just checks auth via motions list)
async function runHiggsDebugTests(apiKey) {
  const colonIdx = apiKey.indexOf(':');
  const keyId = colonIdx > -1 ? apiKey.substring(0, colonIdx) : apiKey;
  const keySecret = colonIdx > -1 ? apiKey.substring(colonIdx + 1) : '';
  const keyInfo = { length: apiKey.length, hasColon: apiKey.includes(':'), keyIdLength: keyId.length, keySecretLength: keySecret.length };
  const results = [];
  // V1 auth test — motions list (read-only, no credits used)
  try {
    const v1 = await proxyRequest('https://platform.higgsfield.ai/v1/motions', 'GET', higgsV1Headers(apiKey));
    results.push({ label: 'V1 Auth (motions)', status: v1.status, motionCount: Array.isArray(v1.data) ? v1.data.length : 0 });
  } catch (err) { results.push({ label: 'V1 Auth', error: err.message }); }
  // V2 auth test — seedream (will queue but confirms V2 works)
  try {
    const v2 = await proxyRequest('https://platform.higgsfield.ai/bytedance/seedream/v4/text-to-image', 'POST',
      { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' }, { prompt: 'test' });
    results.push({ label: 'V2 Auth (seedream)', status: v2.status, id: v2.data?.request_id });
  } catch (err) { results.push({ label: 'V2 Auth', error: err.message }); }
  return { keyInfo, results, apiSpec: {
    v1: { endpoint: 'POST /v1/image2video/dop', models: ['dop-turbo', 'dop-lite', 'dop-preview'], auth: 'hf-api-key + hf-secret headers', maxConcurrent: 4, maxImages: 1 },
    v2: { endpoint: 'POST /<model>/text-to-image', auth: 'Authorization: Key KEY_ID:KEY_SECRET' },
  }};
}

// POST handler (safer for keys with special chars)
app.post('/api/debug/higgsfield-endpoints', express.json(), async (req, res) => {
  const apiKey = req.body?.key;
  if (!apiKey) return res.status(400).json({ error: 'POST JSON body: { "key": "KEY_ID:KEY_SECRET" }' });
  res.json(await runHiggsDebugTests(apiKey));
});
// GET handler
app.get('/api/debug/higgsfield-endpoints', async (req, res) => {
  if (req.query.key) {
    return res.json(await runHiggsDebugTests(req.query.key));
  }
  // Otherwise show a simple form
  res.send(`<!DOCTYPE html><html><body style="font-family:monospace;max-width:800px;margin:40px auto">
    <h2>Higgsfield API Debug</h2>
    <p>Enter your API key (KEY_ID:KEY_SECRET) to test endpoints:</p>
    <input id="key" type="password" style="width:100%;padding:8px;font-size:16px" placeholder="KEY_ID:KEY_SECRET" />
    <button onclick="runTest()" style="margin-top:10px;padding:8px 20px;font-size:16px">Test</button>
    <pre id="out" style="margin-top:20px;background:#111;color:#0f0;padding:20px;border-radius:8px;overflow:auto;max-height:600px"></pre>
    <script>
    async function runTest() {
      const key = document.getElementById('key').value;
      document.getElementById('out').textContent = 'Testing...';
      try {
        const r = await fetch('/api/debug/higgsfield-endpoints', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({key})
        });
        const data = await r.json();
        document.getElementById('out').textContent = JSON.stringify(data, null, 2);
      } catch(e) { document.getElementById('out').textContent = 'Error: ' + e.message; }
    }
    </script></body></html>`);
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

  // Create concat file list for FFmpeg
  const concatListPath = path.join(UPLOAD_DIR, `${jobId}-concat.txt`);
  const concatContent = clips
    .map((c) => `file '${path.join(UPLOAD_DIR, c.filename)}'`)
    .join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  // Build video filter chain
  const [w, h] = resolution.split('x');
  const vfParts = [
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
  ];

  // Burn-in captions from SOP segments
  // options.captions: array of { text, startTime, endTime } for each segment
  if (options.captions && options.captions.length) {
    // Generate SRT subtitle file
    const srtPath = path.join(UPLOAD_DIR, `${jobId}-captions.srt`);
    const srtContent = options.captions.map((cap, i) => {
      const start = formatSrtTime(cap.startTime || 0);
      const end = formatSrtTime(cap.endTime || (cap.startTime || 0) + 3);
      return `${i + 1}\n${start} --> ${end}\n${cap.text}\n`;
    }).join('\n');
    fs.writeFileSync(srtPath, srtContent);

    // Burn subtitles with bold white text, black outline — reel-style captions
    const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    vfParts.push(
      `subtitles='${escapedSrt}':force_style='FontSize=22,FontName=Arial,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=80'`
    );
  }

  // Static text overlay if provided (separate from captions)
  if (options.overlayText) {
    const escaped = options.overlayText.replace(/'/g, "'\\''").replace(/:/g, '\\:');
    vfParts.push(
      `drawtext=text='${escaped}':fontsize=48:fontcolor=white:x=(w-tw)/2:y=h-80:shadowcolor=black:shadowx=2:shadowy=2`
    );
  }

  // Build FFmpeg args
  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-vf', vfParts.join(','),
  ];

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
    // Clean up temp files
    try { fs.unlinkSync(concatListPath); } catch {}
    try { fs.unlinkSync(path.join(UPLOAD_DIR, `${jobId}-captions.srt`)); } catch {}

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

// Format seconds to SRT time format (HH:MM:SS,mmm)
function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// ─── Auto-Stitch from URLs ───
// Downloads video clips from URLs (e.g. Higgsfield output) and stitches them automatically
app.post('/api/auto-stitch', async (req, res) => {
  const { clips, options = {} } = req.body;
  // clips: array of { url, label } — each is a video URL to download
  if (!clips || !clips.length) {
    return res.status(400).json({ error: 'No clips provided' });
  }

  const jobId = uuidv4();
  const outputFile = `${jobId}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFile);

  jobs.set(jobId, {
    id: jobId,
    status: 'downloading',
    progress: 0,
    clips: clips.length,
    outputFile: null,
    error: null,
    createdAt: new Date().toISOString(),
  });

  res.json({ jobId, status: 'downloading' });

  // Download all clips in parallel, then stitch
  try {
    const downloadedClips = [];
    const downloadPromises = clips.map(async (clip, i) => {
      const ext = '.mp4';
      const filename = `${jobId}-clip-${i}${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      await downloadFile(clip.url, filepath);
      downloadedClips[i] = { filename };

      const job = jobs.get(jobId);
      const dlProgress = Math.round(((downloadedClips.filter(Boolean).length) / clips.length) * 40);
      job.progress = dlProgress;
    });

    await Promise.all(downloadPromises);

    const job = jobs.get(jobId);
    job.status = 'processing';
    job.progress = 45;

    // Stitch the downloaded clips in order
    runStitch(jobId, downloadedClips, outputPath, options);
  } catch (err) {
    const job = jobs.get(jobId);
    job.status = 'error';
    job.error = `Download failed: ${err.message}`;
  }
});

// Download a file from URL to local path
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === 'https:' ? https : http;

    const doRequest = (requestUrl) => {
      const parsed = new URL(requestUrl);
      const t = parsed.protocol === 'https:' ? https : http;
      t.get(requestUrl, (response) => {
        // Follow redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          doRequest(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} downloading ${requestUrl}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
      }).on('error', reject);
    };

    doRequest(url);
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
// V1 API (DoP): https://platform.higgsfield.ai/v1/
// Auth: hf-api-key (UUID) + hf-secret (64-char) as separate headers
// V2 API (Seedream, Flux): Authorization: Key KEY_ID:KEY_SECRET

// Helper: split "KEY_ID:KEY_SECRET" into V1 auth headers
function higgsV1Headers(apiKey) {
  const colonIdx = apiKey.indexOf(':');
  return {
    'hf-api-key': colonIdx > -1 ? apiKey.substring(0, colonIdx) : apiKey,
    'hf-secret': colonIdx > -1 ? apiKey.substring(colonIdx + 1) : '',
    'Content-Type': 'application/json',
  };
}

// ── V1 DoP: Generate image-to-video ──
app.post('/api/proxy/higgsfield/v1/generate', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    const result = await proxyRequest(
      'https://platform.higgsfield.ai/v1/image2video/dop',
      'POST',
      higgsV1Headers(apiKey),
      req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── V1 DoP: Poll generation status ──
app.get('/api/proxy/higgsfield/v1/status/:generationId', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    // Try the generation endpoint directly (returns updated jobs array)
    const result = await proxyRequest(
      `https://platform.higgsfield.ai/v1/image2video/${encodeURIComponent(req.params.generationId)}`,
      'GET',
      higgsV1Headers(apiKey)
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── V1: List available motions ──
app.get('/api/proxy/higgsfield/v1/motions', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    const result = await proxyRequest(
      'https://platform.higgsfield.ai/v1/motions',
      'GET',
      higgsV1Headers(apiKey)
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── V2 (legacy): Generate via arbitrary endpoint ──
app.post('/api/proxy/higgsfield/generate', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    // endpoint comes from the frontend (e.g. 'kling-v3.0-pro-text-to-video')
    // The Higgsfield API uses the endpoint as the URL path, with input as the body
    const { endpoint, input } = req.body;
    const apiPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = await proxyRequest(
      `https://platform.higgsfield.ai${apiPath}`,
      'POST',
      { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      input || req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/proxy/higgsfield/revise', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    const { endpoint, input } = req.body;
    const apiPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const result = await proxyRequest(
      `https://platform.higgsfield.ai${apiPath}`,
      'POST',
      { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      input || req.body
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/proxy/higgsfield/status/:requestId', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    const result = await proxyRequest(
      `https://platform.higgsfield.ai/requests/${encodeURIComponent(req.params.requestId)}/status`,
      'GET',
      { 'Authorization': `Key ${apiKey}` }
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
  console.log(`MAJU Backend v1.1.1 running on http://localhost:${PORT}`);
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
