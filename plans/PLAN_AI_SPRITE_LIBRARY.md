# Plan: AI-Generated Character Sprite Library + Layered Gear System

**Date:** 2026-07-13 · **Status:** Approved (interview answered with recommended options; roster from user) · **Executor:** Claude (pilot + review) + subagents (waves)

## Goal

Robust skin library from user's series list (~30 manhwa/manhua/anime titles) using reference-conditioned AI generation, plus equipment sprites rendered as overlay layers that never fully hide the base character.

## Interview

**Q1: Generation engine?**
- (a) **[RECOMMENDED]** Gemini `gemini-3.1-flash-image` (key in Keychain, supports image input): web reference image + approved style-anchor sprite → "this character as 32×48 chibi pixel sprite". Replicate ($20 credit) as fallback for stubborn subjects.
- **Chosen: (a)**.

**Q2: Post-processing?**
- (a) **[RECOMMENDED]** `tools/pixelart/genai.py` (stdlib-only, matches render.py): decode model PNG → detect sprite bounds → nearest-neighbor downscale to ≤32×48 → quantize to ≤16 colors (frequency-based palette) → background knockout (corner flood) → emit 1x PNG + @8x preview + optionally back-convert to editable JSON grid.
- **Chosen: (a)** — keeps everything reviewable/fixable in the existing pipeline.

**Q3: Roster depth?**
- (a) **[RECOMMENDED]** Default 1–2 most-popular characters per series; flagship/popular series get 2–4 + alternate forms (e.g. Rimuru slime/human, Luffy Gear 5, Ichigo bankai/hollow, Yeon-woo masked). Agents verify character identity via web reference images (many titles are niche — never generate from name alone). Target ~50–70 sprites wave 1.
- **Chosen: (a)**.

**Q4: Gear system shape?**
- (a) **[RECOMMENDED]** Gear = transparent 32×48 overlay PNGs aligned to the base grid, layered over (or under, for capes/auras) the skin via z-ordered stacked <img>s. Slots: `weapon` (held at side, cols 2-8 or 24-30), `headgear` (rows 0–8 only — face stays visible), `chest` (torso rows 19–30, arms/hands visible), `cape` (z-below base), `aura` (sparse effect pixels, z-below, full canvas). Rule: face rows 8–18 always ≥80% unobscured.
- (b) Baked full-outfit variants per character (explodes combinatorially — no).
- **Chosen: (a)** — gear inspired by the series' iconic items but generic enough for any skin.

**Q5: App wiring?**
- (a) **[RECOMMENDED]** Extend characterSkinStore → `gear` manifest section (id, displayName, slot, file, zIndex, series inspiration); Equipment page "Gear" grid per slot; selection per-slot in localStorage; LayeredSprite component (relative container, stacked pixelated imgs) used on Equipment + Dashboard.
- **Chosen: (a)**.

**Q6: Copyright/repo?**
- Same as before: all generated assets + refs gitignored (public repo), tools/manifest-code committed.

## Pipeline (per character)

1. Web-search reference image (verify visually — right character, canonical outfit/form).
2. Gemini image call: reference + style-anchor sprite + strict prompt (32×48 chibi, flat colors, plain solid background, full body, no text).
3. Post-process via genai.py → 1x + @8x preview.
4. **Visual review** (agent, then me spot-checking): likeness + style consistency; regenerate with adjusted prompt up to 3×; hand-fix via JSON grid if close.
5. Append manifest entry (id, displayName, series, form).

## Waves

- **Pilot (me):** build genai.py, run 2 characters end-to-end, validate quality bar before fan-out.
- **Wave 1 (agents, ~5 series each):** skins per roster.
- **Wave 2 (agents):** gear overlays (weapon/headgear/chest/cape/aura sets inspired by the series).
- **Wave 3 (agent):** app wiring (gear slots UI + LayeredSprite).

## Verification

Every sprite visually reviewed at 8x; manifest loads; tsc-gated build passes; layered render shows face of base skin with all slots equipped.
