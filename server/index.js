/* ═══════════════════════════════════════════
   MAJU AI Video Launchpad — Backend Server
   FFmpeg stitching + API proxy + job management
   Deployed on AWS App Runner
       Auth: Authorization Key format (v2)
   ═══════════════════════════════════════════ */

// chore: trigger deploy
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
const AUDIO_DIR = path.join(__dirname, 'audio');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

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
    { name: 'reveal', label: 'Reveal — Ingredients + Pour (3-6s)', maxDuration: 3 },
    { name: 'demo', label: 'Demo — Eating the Snack (6-11s)', maxDuration: 5 },
    { name: 'result', label: 'Result + Benefits (11-13s)', maxDuration: 2 },
    { name: 'glow', label: 'Glow — Result + CTA (13-15s)', maxDuration: 2 },
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

// ─── Debug Log (in-memory ring buffer) ───
const DEBUG_LOG = [];
const DEBUG_MAX = 200;
function debugLog(tag, data) {
  const entry = { t: new Date().toISOString(), tag, ...data };
  DEBUG_LOG.push(entry);
  if (DEBUG_LOG.length > DEBUG_MAX) DEBUG_LOG.shift();
  console.log(`[${tag}]`, JSON.stringify(data).slice(0, 500));
}

app.get('/api/debug/log', (req, res) => {
  res.json(DEBUG_LOG.slice(-(parseInt(req.query.n) || 50)));
});

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
    const audioPath = fs.existsSync(path.join(AUDIO_DIR, options.audioBg)) ? path.join(AUDIO_DIR, options.audioBg) : path.join(UPLOAD_DIR, options.audioBg);
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

// ─── Audio / Music Management ───
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  },
});
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Audio type ' + ext + ' not allowed'));
  },
});

app.post('/api/audio/upload', audioUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  res.json({ ok: true, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size });
});

app.get('/api/audio/list', (req, res) => {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac'].includes(path.extname(f).toLowerCase()))
      .map(f => {
        const stat = fs.statSync(path.join(AUDIO_DIR, f));
        return { filename: f, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json({ tracks: files });
  } catch (err) {
    res.json({ tracks: [] });
  }
});

app.use('/audio', express.static(AUDIO_DIR));

app.delete('/api/audio/:filename', (req, res) => {
  const filePath = path.join(AUDIO_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

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
const crypto = require('crypto');
function proxyRequest(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');
    }
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
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
    if (bodyStr) req.write(bodyStr);
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
// API: https://platform.higgsfield.ai
// Auth: Authorization: Key KEY_ID:KEY_SECRET
// Status polling: /requests/{request_id}/status

// Helper: build Higgsfield auth headers from request
// Auth format: Authorization: Key KEY_ID:KEY_SECRET (per Higgsfield JS SDK v2)
function hfAuthHeaders(req) {
  const apiKey = req.headers['x-api-key-value'] || '';
  const apiSecret = req.headers['x-api-secret-value'] || '';
  const credential = apiSecret ? `${apiKey}:${apiSecret}` : apiKey;
  return {
    'Authorization': `Key ${credential}`,
    'Content-Type': 'application/json',
  };
}

app.post('/api/proxy/higgsfield/generate', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  const apiSecret = req.headers['x-api-secret-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  const { endpoint, input } = req.body;
  const urlPath = (endpoint || '').replace(/^\/+/, '');
  const credential = apiSecret ? `${apiKey}:${apiSecret}` : apiKey;
  debugLog('hf-generate-req', { url: `https://platform.higgsfield.ai/${urlPath}`, auth: `Key ${credential.slice(0, 8)}...`, body: JSON.stringify(input).slice(0, 300) });
  try {
    const result = await proxyRequest(
      `https://platform.higgsfield.ai/${urlPath}`,
      'POST',
      hfAuthHeaders(req),
      input || {}
    );
    debugLog('hf-generate-res', { status: result.status, data: JSON.stringify(result.data).slice(0, 500) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('hf-generate-err', { error: err.message });
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/proxy/higgsfield/revise', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    const { endpoint, input } = req.body;
    const urlPath = (endpoint || '').replace(/^\/+/, '');
    debugLog('hf-revise-req', { endpoint: urlPath });
    const result = await proxyRequest(
      `https://platform.higgsfield.ai/${urlPath}`,
      'POST',
      hfAuthHeaders(req),
      input || {}
    );
    debugLog('hf-revise-res', { status: result.status, data: JSON.stringify(result.data).slice(0, 500) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('hf-revise-err', { error: err.message });
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
      hfAuthHeaders(req)
    );
    debugLog('hf-status-res', { requestId: req.params.requestId, status: result.status, data: JSON.stringify(result.data).slice(0, 300) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('hf-status-err', { requestId: req.params.requestId, error: err.message });
    res.status(502).json({ error: err.message });
  }
});

// ── Higgsfield Motions ──
app.get('/api/proxy/higgsfield/motions', async (req, res) => {
  const apiKey = req.headers['x-api-key-value'];
  if (!apiKey) return res.status(400).json({ error: 'Missing Higgsfield API key' });
  try {
    const result = await proxyRequest(
      'https://platform.higgsfield.ai/v1/motions',
      'GET',
      hfAuthHeaders(req)
    );
    debugLog('hf-motions-res', { status: result.status, count: Array.isArray(result.data) ? result.data.length : '?' });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('hf-motions-err', { error: err.message });
    res.status(502).json({ error: err.message });
  }
});

// ── Kling AI Proxy ──
// API: https://api-singapore.klingai.com
// Auth: JWT (HS256) generated from AccessKey + SecretKey

function generateKlingJwt(accessKey, secretKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secretKey).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function klingAuthHeaders(req) {
  const accessKey = req.headers['x-api-key-value'] || '';
  const secretKey = req.headers['x-api-secret-value'] || '';
  return {
    'Authorization': `Bearer ${generateKlingJwt(accessKey, secretKey)}`,
    'Content-Type': 'application/json',
  };
}

// Text-to-Video
app.post('/api/proxy/kling/text2video', async (req, res) => {
  const accessKey = req.headers['x-api-key-value'];
  if (!accessKey) return res.status(400).json({ error: 'Missing Kling API key' });
  debugLog('kling-t2v-req', { body: JSON.stringify(req.body).slice(0, 300) });
  try {
    const result = await proxyRequest(
      'https://api-singapore.klingai.com/v1/videos/text2video',
      'POST',
      klingAuthHeaders(req),
      req.body
    );
    debugLog('kling-t2v-res', { status: result.status, data: JSON.stringify(result.data).slice(0, 500) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('kling-t2v-err', { error: err.message });
    res.status(502).json({ error: err.message });
  }
});

// Image-to-Video
app.post('/api/proxy/kling/image2video', async (req, res) => {
  const accessKey = req.headers['x-api-key-value'];
  if (!accessKey) return res.status(400).json({ error: 'Missing Kling API key' });
  debugLog('kling-i2v-req', { body: JSON.stringify(req.body).slice(0, 300) });
  try {
    const result = await proxyRequest(
      'https://api-singapore.klingai.com/v1/videos/image2video',
      'POST',
      klingAuthHeaders(req),
      req.body
    );
    debugLog('kling-i2v-res', { status: result.status, data: JSON.stringify(result.data).slice(0, 500) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('kling-i2v-err', { error: err.message });
    res.status(502).json({ error: err.message });
  }
});

// Poll text2video status
app.get('/api/proxy/kling/text2video/:taskId', async (req, res) => {
  const accessKey = req.headers['x-api-key-value'];
  if (!accessKey) return res.status(400).json({ error: 'Missing Kling API key' });
  try {
    const result = await proxyRequest(
      `https://api-singapore.klingai.com/v1/videos/text2video/${encodeURIComponent(req.params.taskId)}`,
      'GET',
      klingAuthHeaders(req)
    );
    debugLog('kling-t2v-status', { taskId: req.params.taskId, status: result.status, data: JSON.stringify(result.data).slice(0, 300) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('kling-t2v-status-err', { error: err.message });
    res.status(502).json({ error: err.message });
  }
});

// Poll image2video status
app.get('/api/proxy/kling/image2video/:taskId', async (req, res) => {
  const accessKey = req.headers['x-api-key-value'];
  if (!accessKey) return res.status(400).json({ error: 'Missing Kling API key' });
  try {
    const result = await proxyRequest(
      `https://api-singapore.klingai.com/v1/videos/image2video/${encodeURIComponent(req.params.taskId)}`,
      'GET',
      klingAuthHeaders(req)
    );
    debugLog('kling-i2v-status', { taskId: req.params.taskId, status: result.status, data: JSON.stringify(result.data).slice(0, 300) });
    res.status(result.status).json(result.data);
  } catch (err) {
    debugLog('kling-i2v-status-err', { error: err.message });
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
  console.log(`  /api/proxy/kling/*       — Kling AI proxy`);
  console.log(`  /api/proxy/metricool/*   — Metricool proxy`);
  console.log(`  /api/proxy/arcads/*      — Arcads proxy`);
  console.log(`  /api/proxy/creatify/*    — Creatify proxy`);
});
