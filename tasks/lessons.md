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

## General
- Always save audioBg and captions on queue items during auto-stitch so re-stitch can use them.
- Don't re-render videos to fix stitch issues — just re-stitch. Saves Higgsfield/Kling credits.
