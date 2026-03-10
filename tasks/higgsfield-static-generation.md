# Higgsfield Soul — Static Image Generation Rules

## CRITICAL: Product @ Tag is MANDATORY

The single most important rule: **Every prompt MUST contain the product identity `@` tag inline in the prompt text.** Without it, Higgsfield Soul will hallucinate a generic bottle that does NOT match the real MAJU product.

### What Goes Wrong Without @ Tags

- Soul generates its own interpretation of "a dark bottle with gold label"
- The label text, design, proportions, and colors will be wrong every time
- Text descriptions alone (e.g., "MAJU BLACK SEED OIL bottle") are NOT sufficient
- The model cannot reliably reproduce branded product packaging from text alone

### What the Correct Product Looks Like

The MAJU Cold-Pressed Black Seed Oil 8oz bottle has:
- **Dark amber/black glass** round bottle
- **Black screw cap**
- **Yellow/gold dotted banner** across the very top of the label with "MAJU" in small text
- **"COLD-PRESSED"** in smaller text below the banner
- **"BLACK SEED OIL"** in large bold white/gold text — the dominant visual feature
- **Dark label background** with yellow/gold text accents
- Compact 8oz size, easily held in one hand

Reference image URL: `https://ryanrigneyfba.github.io/maju-ai-video-launchpad/assets/bso-8oz-front.jpg`

---

## Prompt Structure (MUST follow this format)

### Required Elements in Every Prompt

1. **Person @ tag** — `@Patient Maya` (or the specific character Soul ID)
2. **Product @ tag** — `@majurenderedproduct` (the product Soul ID)
3. **Scene description** — What's happening, setting, lighting, mood
4. **Product placement instruction** — Where the bottle is in the frame and how it's positioned
5. **Format spec** — `9:16 vertical`, `photorealistic`

### Correct Prompt Template

```
@Patient Ma... [scene description with person action], @majurende... [product placement — e.g., "MAJU Cold-Pressed Black Seed Oil bottle prominently on the table" or "holding the MAJU bottle up toward camera"], [lighting/mood], photorealistic, 9:16 vertical
```

### Example — CORRECT (story-1 hook):
```
@Patient Ma... A young woman with her hair in a bun wearing a black tank top stands in a dark moody kitchen with warm golden lighting. She holds a whole red onion near her face, holding it up toward the camera with a slight smile. @majurende... A dark glass bottle labeled "MAJU BLACK SEED OIL" sits prominently on the wooden counter beside her. Minimal movement, mostly still pose. Cinematic warm golden-hour lighting from a window, dark cabinets in background. Vertical 9:16 format.
```

### Example — WRONG (what NOT to do):
```
Young woman drizzling black seed oil from a dark glass bottle onto a colorful winter wellness salad, the dark bottle with gold label reading "MAJU" is prominently in the center of frame, photorealistic, 9:16 vertical format
```
**Why it's wrong:** No `@` tags at all. Just text descriptions. The model will generate a random bottle.

---

## Higgsfield Soul UI Workflow

### Before Generating

1. Verify **Patient Maya** character tag is attached (bottom right, pink thumbnail)
2. Verify **GENERAL** product tag is attached (bottom right, product thumbnail)
3. Verify prompt text contains **both** `@Patient Ma...` and `@majurende...` inline
4. Set count to `4/4` for 4 variations
5. Set format to `9:16`
6. Set resolution to `2k`
7. Ensure `Higgsfield Soul` model is selected

### After Generating

- **CHECK**: Does the bottle match the reference image? Look for:
  - Yellow/gold dotted banner at top
  - "COLD-PRESSED" text
  - "BLACK SEED OIL" as the dominant text
  - Dark glass bottle with black cap
- If the bottle looks generic or wrong → the `@` tag was likely missing from the prompt
- Pick the best variation for each segment

---

## Pipeline API Calls (Programmatic)

When the MAJU Launchpad pipeline calls the Higgsfield API:

- The API call MUST include `person_id` (Patient Maya Soul ID: `6bceded1-e872-41d7-824b-8476faf87fa4`)
- The API call MUST include `object_id` (Product Soul ID: `b360f0d3-51f4-4801-85e7-be9adacc6a47`)
- The prompt text sent to the API should still describe the product placement
- The API handles the @ tag resolution via the Soul IDs

---

## Story-2 Winter Wellness Salad — Segment Prompts

All 4 segment prompts for story-2 must follow this pattern:

### Hook (0-3s)
```
@Patient Ma... Young woman in a cozy cream knit sweater drizzling oil onto a colorful winter wellness salad at a rustic wooden table, snowy window in background, warm golden hour lighting. @majurende... MAJU Cold-Pressed Black Seed Oil bottle sitting prominently on the table next to the salad bowl, label facing camera. Close-up of hands, salad, and bottle. Photorealistic, 9:16 vertical.
```

### Reveal (3-6s)
```
@Patient Ma... Young woman in cream sweater holding up the bottle next to her face with a warm smile, cozy kitchen with snowy window, golden warm lighting, the winter salad bowl visible on the table behind her. @majurende... She holds the MAJU Cold-Pressed Black Seed Oil bottle at chest level, label clearly visible and facing camera. Medium close-up portrait. Photorealistic, 9:16 vertical.
```

### Demo (6-9s)
```
@Patient Ma... Young woman in cream sweater taking a bite of winter wellness salad at wooden dining table, soft satisfied expression, warm cozy room with candles and snowy window. @majurende... MAJU Cold-Pressed Black Seed Oil bottle on the table beside the salad bowl, label clearly readable, warm golden glow on bottle. Photorealistic, 9:16 vertical.
```

### Glow+CTA (9-12s)
```
@Patient Ma... Close-up portrait of young woman with radiant glowing skin, soft smile, warm amber skin-glow tones, cozy winter setting with soft bokeh background, candles visible. @majurende... MAJU Cold-Pressed Black Seed Oil bottle held near her face or on the table beside her, label clearly visible. Wellness lifestyle aesthetic, hygge mood. Photorealistic, 9:16 vertical.
```

---

## Lessons Learned

| Date | Mistake | Root Cause | Fix |
|------|---------|-----------|-----|
| 2026-03-10 | Generated statics with wrong/generic bottle | Prompt had text description of bottle but no @ product tag | ALWAYS use `@majurende...` inline in prompt |
| 2026-03-10 | Multiple regeneration attempts still wrong | Kept writing text descriptions instead of @ tags | Created this document as permanent reference |

---

## Checklist Before Every Generation

- [ ] Person `@` tag is in the prompt text (not just attached at bottom)
- [ ] Product `@` tag is in the prompt text (not just attached at bottom)
- [ ] Both reference thumbnails visible at bottom right of prompt area
- [ ] Product placement is explicitly described (where in frame, which direction label faces)
- [ ] Format is 9:16 vertical
- [ ] After generation: visually verify bottle matches reference image
