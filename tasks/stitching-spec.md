# MAJU Video Stitching Specification

## Overview
The stitch pipeline takes individual video segments (from Higgsfield/Kling generation) and combines them into a single Instagram Reel using FFmpeg. This spec MUST be followed for every stitch operation.

## Video Format
- **Resolution**: 1080x1920 (9:16 vertical, Instagram Reels)
- **Codec**: H.264 (libx264)
- **Audio Codec**: AAC
- **Container**: MP4

## Caption (ASS Subtitle) Requirements

### Font & Style
- **Font**: Arial, **size 64px** (bold)
- **Color**: White (`&H00FFFFFF`) with black outline
- **Outline**: 4px, **Shadow**: 2px
- **Alignment**: 2 (bottom-center, positioned via MarginV)

### Positioning — Instagram Safe Zone
- **MarginV: 500px from bottom** (default)
- This places captions at ~74% from top on a 1920px tall video
- **Why 500px**: Instagram Reels UI covers the bottom ~300px (like/comment/share buttons, username, caption text). Captions at MarginV 80 get completely hidden. 500px clears the UI comfortably.
- **Face protection**: The subject's face is typically in the upper 40-50% of frame. MarginV 500 ensures captions stay well below the face area.
- **Override**: Pass `captionMarginV` in stitch options to customize per-job

### Per-Caption Styles
- Individual captions can have custom `marginV` values
- Per-caption styles inherit the same font size (64), outline (4), shadow (2) as defaults
- Only the marginV differs

## Music/Audio Requirements
- **audioBg**: Filename from server's AUDIO_DIR (e.g., `herbal-morning-ambient.mp3`)
- Audio is mixed with `-shortest` flag to match video duration
- **CRITICAL**: Both auto-stitch AND re-stitch MUST pass `audioBg` in options
- Re-stitch falls back to dashboard audio selector if no stored audioBg

## Re-stitch Parity
The re-stitch handler MUST pass the same options as auto-stitch:
1. `options.captions` — from stored queue item
2. `options.audioBg` — from stored queue item, fallback to audio-select dropdown
3. `options.maxClipDuration` — default 3 seconds
4. `captionsSrt` / `captionsAss` — if stored on queue item

## Segment Completeness — ALL Segments Required
- The pipeline defines segments in `aiPrompt.segments` (typically 4: Hook, Reveal, Demo, The Glow/CTA)
- **ALL segments MUST generate successfully before stitching**
- If any segment fails (no preloaded image, API error, timeout), the pipeline ABORTS
- A partial video (e.g., 3/4 segments, missing CTA) MUST NEVER reach the approval queue
- The pipeline logs which segments are missing and marks the item as `failed`
- To recover: regenerate the missing segment or borrow from another queue item, then re-stitch

## Lessons Learned
1. **Captions too small**: Font size 22 is unreadable on 1080x1920. Must be 64+.
2. **Captions hidden by Instagram UI**: MarginV 80 gets buried. Must be 500.
3. **Music disappearing on re-stitch**: Re-stitch handler wasn't passing audioBg. Always pass it.
4. **Captions disappearing on re-stitch**: Re-stitch handler wasn't passing captions array. Always pass it.
5. **Caption position must not block face**: MarginV 500 keeps captions in lower 26% of frame, safely below subject's face.
6. **Missing CTA segment**: Pipeline silently dropped failed segments and stitched partial video (3/4). Now aborts if any segment fails. All segments (especially CTA) are required for a complete Reel.
