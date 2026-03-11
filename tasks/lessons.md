# Lessons Learned

## Stitching Pipeline
- **Caption font size**: Must be 64px minimum on 1080x1920 video. 22px is unreadable.
- **Caption MarginV**: Must be 500px from bottom for Instagram Reels. 80px gets hidden under Instagram UI.
- **Caption position vs face**: MarginV 500 keeps captions at ~74% from top, well below the face (upper 40-50%) and above Instagram UI (bottom ~300px).
- **Re-stitch parity**: Re-stitch handler MUST pass `audioBg` and `captions` from stored queue item. This was the root cause of music and captions disappearing on re-stitch.
- **Per-caption style inheritance**: If per-caption styles are created (for custom marginV), they must inherit the same font size (64), outline (4), shadow (2) as the Default style. Previous bug had them at 22px.
- **Always read `tasks/stitching-spec.md`** before making any changes to the stitch pipeline.

## JWT / Soul Connection
- JWT has 55-second TTL. Extract and relay atomically when possible.
- JWT is NOT needed for re-stitching (only for video generation via Higgsfield/Kling APIs).
- CORS blocks fetch from higgsfield.ai to awsapprunner.com. Use skill-based relay approach.

## Segment Completeness
- **Never stitch partial videos.** If any segment fails generation, abort the pipeline. A video missing the CTA is useless.
- Pipeline used to silently drop failed segments and stitch whatever succeeded. This produced a 3-segment video missing the CTA that reached the approval queue.
- Fix: Pipeline now checks `segmentResults.length === segments.length` before proceeding to stitch. Partial results are marked `failed` with a clear log of which segments are missing.
- Recovery: Borrow a clip from another queue item that has the same segment type (e.g., glow_cta), patch it into `segmentVideos`, and re-stitch.

## Metricool API v2 (Instagram Scheduling)
- **Field names are case-sensitive**: `text` (not `content`), `providers` (not `networks`), `publicationDate` (not optional).
- **Provider format**: `providers: [{ network: 'INSTAGRAM' }]` — no `postType` in providers.
- **Reel type**: Must be specified as `instagramData: { type: 'REEL' }` (singular, not `REELS`). Valid types: POST, REEL, TRIAL_REEL, STORY.
- **blogId & userId**: Required as **query parameters** (not body). Fetch from `GET /api/v2/scheduler/brands` first.
- **autoPublish**: Set `autoPublish: true` to auto-post instead of requiring manual approval in Metricool app.
- **Publication date timezone**: `publicationDate.dateTime` must be in **local time** matching the specified `timezone`. Do NOT use `toISOString()` which outputs UTC — build the string from `toLocaleString()` instead.
- **Brand caching**: Cache the blogId/userId after first brands fetch to avoid redundant API calls.
- **Media format**: Must be plain URL strings `media: ['https://...']`, NOT objects `media: [{ url, type }]`. The official Metricool MCP code confirms `info` JSON is passed directly with media as a simple list. Objects cause "You need to add a picture" error at publish time despite 201 response.
- **`saveExternalMediaFiles: false`**: Metricool does NOT pre-download media at schedule time — it fetches at publish time. The video URL MUST be alive when the scheduled time arrives or the post will fail.
- **Normalize endpoint not needed**: `app.metricool.com/api/actions/normalize/image/url` just returns the same URL. The official Metricool MCP doesn't use it at all.

## App Runner / Ephemeral Storage
- **Stitched videos are ephemeral.** App Runner containers restart and lose all files in `/tmp/maju_output/`. Download URLs break after restart.
- **Since Metricool fetches media at publish time** (not schedule time), a scheduled post will fail if the container restarts between scheduling and publishing.
- **Long-term fix needed**: Upload stitched videos to persistent storage (S3 or similar) before scheduling. Use the persistent URL for Metricool.
- **Re-stitch from segments**: If the stitched .mp4 is lost, re-stitch from original Higgsfield CloudFront segment URLs (these persist longer).

## Stitch Endpoint Details
- **Captions format**: `captionsAss` (raw ASS string) or `captionsSrt` (raw SRT string) must be at **body level**, NOT inside `options`. Passing captions as `options.captions` (JSON array) is silently ignored.
- **audioBg**: Passed via `options.audioBg` (filename). Server checks `AUDIO_DIR` then `UPLOAD_DIR` for the file.

## General
- Always save audioBg and captions on queue items during auto-stitch so re-stitch can use them.
- Don't re-render videos to fix stitch issues — just re-stitch. Saves Higgsfield/Kling credits.
- When borrowing clips between queue items, verify the clip URL is still accessible (Higgsfield CDN URLs may expire).
