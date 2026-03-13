/**
 * FFmpeg client — local post-production (captions, overlay, audio).
 * Runs FFmpeg directly as a child process.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ASSETS_DIR } = require('../config');

/**
 * Run an FFmpeg command and return stdout/stderr.
 */
function run(args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile('ffmpeg', args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`FFmpeg error: ${err.message}\n${stderr}`));
      else resolve({ stdout, stderr });
    });
  });
}

/**
 * Probe a video file and return duration, resolution, etc.
 */
function probe(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', filePath,
    ], (err, stdout) => {
      if (err) reject(new Error(`ffprobe error: ${err.message}`));
      else {
        try { resolve(JSON.parse(stdout)); }
        catch (e) { reject(new Error('ffprobe returned invalid JSON')); }
      }
    });
  });
}

/**
 * Extract a single frame from a video at a given timestamp.
 * @param {string} videoPath
 * @param {number} timeSec - timestamp in seconds
 * @param {string} outputPath - output image path
 */
async function extractFrame(videoPath, timeSec, outputPath) {
  await run([
    '-y', '-ss', String(timeSec), '-i', videoPath,
    '-frames:v', '1', '-q:v', '2', outputPath,
  ]);
  return outputPath;
}

/**
 * Build an ASS subtitle file for the hook caption.
 * Arial 52pt bold, MarginV 588, white + 3px black outline, 0-5s.
 */
function buildAssFile(text, outputPath) {
  const ass = `[Script Info]
Title: Animal Stash Caption
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,40,40,588,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,${text.replace(/\n/g, '\\N')}
`;
  fs.writeFileSync(outputPath, ass);
  return outputPath;
}

/**
 * Apply full post-production: captions + crack overlay + audio.
 * @param {object} params
 * @param {string} params.inputVideo - path to stitched video
 * @param {string} params.captionText - hook line text
 * @param {string} params.outputPath - final output path
 * @param {string} [params.crackOverlay] - path to crack PNG overlay
 * @param {string} [params.audioFile] - path to background audio
 */
async function postProduce({ inputVideo, captionText, outputPath, crackOverlay, audioFile }) {
  // Build ASS file
  const assPath = path.join(ASSETS_DIR, 'caption.ass');
  buildAssFile(captionText, assPath);

  // Build filter_complex
  const filters = [];
  const inputs = ['-i', inputVideo];
  let audioStream = null;

  if (audioFile && fs.existsSync(audioFile)) {
    inputs.push('-i', audioFile);
    audioStream = '1:a';
  }

  // Video filters
  let vFilter = `[0:v]ass='${assPath.replace(/'/g, "'\\''")}'`;
  if (crackOverlay && fs.existsSync(crackOverlay)) {
    const overlayIdx = inputs.length / 2; // next input index
    inputs.push('-i', crackOverlay);
    vFilter += `[captioned];[captioned][${overlayIdx}:v]overlay=0:0:format=auto:alpha=premultiplied`;
  }
  vFilter += '[vout]';

  const args = ['-y', ...inputs];

  // Audio filter: trim to 12s + fade out
  let aFilter = '';
  if (audioStream) {
    aFilter = `[${audioStream}]atrim=0:12,afade=t=out:st=10:d=2[aout]`;
    args.push('-filter_complex', `${vFilter};${aFilter}`);
    args.push('-map', '[vout]', '-map', '[aout]');
  } else {
    args.push('-filter_complex', vFilter);
    args.push('-map', '[vout]');
  }

  args.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-t', '12',
    outputPath
  );

  await run(args);
  return outputPath;
}

module.exports = { run, probe, extractFrame, buildAssFile, postProduce };
