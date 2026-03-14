'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const { CRACK_OVERLAY, REEL_AUDIO } = require('../config');

// ─── Build ASS subtitle file ─────────────────────────────────────────────────
function buildASS(hookLine) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Hook,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,40,40,588,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
Dialogue: 0,0:00:00.00,0:00:05.00,Hook,,0,0,0,,${hookLine}
`;
}

// ─── Run post-production via FFmpeg ──────────────────────────────────────────
async function postProduce(inputPath, outputPath, hookLine) {
  const workDir = path.dirname(outputPath);
  const assFile = path.join(workDir, 'captions.ass');

  fs.writeFileSync(assFile, buildASS(hookLine), 'utf8');

  const hasCrack = fs.existsSync(CRACK_OVERLAY);
  const hasAudio = fs.existsSync(REEL_AUDIO);

  // Build filter_complex
  // Input 0: stitched video, Input 1: crack overlay (if present), Input 2: reel audio (if present)
  const inputs = ['-i', inputPath];
  if (hasCrack) inputs.push('-i', CRACK_OVERLAY);
  if (hasAudio) inputs.push('-i', REEL_AUDIO);

  const filterParts = [];
  let videoStream = '[0:v]';

  // Burn captions (use relative filename — Windows FFmpeg subtitles trick via cwd)
  filterParts.push(`${videoStream}subtitles=captions.ass[vwithcap]`);
  videoStream = '[vwithcap]';

  // Overlay crack
  if (hasCrack) {
    const crackIdx = 1;
    filterParts.push(`${videoStream}[${crackIdx}:v]overlay=0:0:alpha=0.35[vwithcrack]`);
    videoStream = '[vwithcrack]';
  }

  // Mix audio: reel audio only (Kling clips have no audio stream)
  let audioStream = null;
  if (hasAudio) {
    const audioIdx = hasCrack ? 2 : 1;
    filterParts.push(`[${audioIdx}:a]volume=0.08,atrim=0:12,afade=t=out:st=10:d=2[reelaud]`);
    audioStream = '[reelaud]';
  }

  const args = [
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', videoStream,
    ...(audioStream ? ['-map', audioStream, '-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
    '-movflags', '+faststart',
    '-y', outputPath,
  ];

  await runFFmpeg(args, workDir);

  // Cleanup temp ASS
  try { fs.unlinkSync(assFile); } catch {}

  return outputPath;
}

// ─── FFprobe QC check ────────────────────────────────────────────────────────
async function probe(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format',
      filePath,
    ], (err, stdout) => {
      if (err) return reject(err);
      resolve(JSON.parse(stdout));
    });
  });
}

async function qcVideo(filePath, { requireAudio = true } = {}) {
  const info     = await probe(filePath);
  const duration = parseFloat(info?.format?.duration || 0);
  const vStream  = info?.streams?.find(s => s.codec_type === 'video');
  const aStream  = info?.streams?.find(s => s.codec_type === 'audio');
  const errors   = [];
  if (duration < 8)                            errors.push(`Duration too short: ${duration}s`);
  if (!vStream)                                errors.push('No video stream');
  if (vStream && vStream.width  < 720)         errors.push(`Width too small: ${vStream.width}`);
  if (vStream && vStream.height < 1280)        errors.push(`Height too small: ${vStream.height}`);
  if (requireAudio && !aStream)                errors.push('No audio stream');
  return errors;
}

function runFFmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`FFmpeg error: ${stderr?.slice(-500)}`));
      resolve();
    });
  });
}

// ─── Extract frame at timestamp for QC ──────────────────────────────────────
async function extractFrame(videoPath, timestampSec, outputPath) {
  await runFFmpeg([
    '-ss', String(timestampSec),
    '-i', videoPath,
    '-vframes', '1',
    '-y', outputPath,
  ], path.dirname(videoPath));
}

module.exports = { postProduce, qcVideo, extractFrame };
