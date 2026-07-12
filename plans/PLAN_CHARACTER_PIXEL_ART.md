# Plan: Anime/Manga/Manhwa Character Pixel Art

**Date:** 2026-07-12 · **Status:** Approved (interview answered with recommended options; user explicitly requested character art) · **Executor:** Claude (pilot) + subagents (roster)

## Problem

User wants pixel art of popular anime/manga/manhwa/manhua characters in the app (personal use). Avatar/equipment system renders placeholder colored shapes; schema has sprite columns waiting.

## Interview

**Q1: Generation method?**
- (a) **[RECOMMENDED]** Code-authored pixel grids (JSON palette+rows → PNG via Python/Pillow), iterated visually by Claude reading the rendered upscaled previews. Deterministic, recolorable, no external services.
- (b) AI image gen (needs API key).
- **Chosen: (a)**; (b) optional later for portraits.

**Q2: Sprite spec?**
- (a) **[RECOMMENDED]** 32×48 character sprites (chibi proportions, ~40% head), transparent background, ≤16 colors per sprite from a shared master palette + per-character accents; 8× upscaled preview PNGs for review. Optional 2-frame idle bob animation later.
- **Chosen: (a)** — 32×48 gives enough room for recognizable hair/outfit silhouettes, chibi reads well at dashboard sizes.

**Q3: Roster (popular picks, Solo Leveling theme first)?**
- Wave 1 pilot: Sung Jin-Woo (Solo Leveling — matches app theme).
- Wave 2: Goku (DBZ), Luffy (One Piece), Naruto, Tanjiro (Demon Slayer), Gojo (JJK), Levi (AoT), Ichigo (Bleach), Saitama (OPM), Yuji Itadori (JJK), Eren (AoT), Zoro (One Piece).
- Recognizability levers: hair shape+color, signature outfit colors, one iconic accessory (scar, blindfold, straw hat, cape…).

**Q4: Where used in app?**
- (a) **[RECOMMENDED]** New `public/assets/characters/` sprites; avatar page character-skin picker (avatar_configs already exists), dashboard avatar widget, optional shop unlockables ("Character Skins" using existing inventory/unlock_content systems).
- **Chosen: (a)**.

**Q5: Public repo / copyright?**
- Personal use fan art; BUT repo is public → `life-gamification/public/assets/characters/` added to .gitignore; generator scripts + palette (original work) committed, character pixel-data JSON kept local. README note explains regeneration.
- **Chosen: keep character assets untracked.**

## Implementation

1. `tools/pixelart/` — `render.py` (JSON → PNG at 1× + 8× preview; shared palette; transparency), `spec.md` (grid format docs). Committed (original work).
2. Character JSONs in `tools/pixelart/characters/` (gitignored) — pilot Sung Jin-Woo, iterate visually until recognizable.
3. Wave 2 roster via subagents (each authors + visually iterates 3-4 characters using the pilot as style reference).
4. App wiring: character-skin picker on avatar page reading `public/assets/characters/manifest.json`; skin persisted in avatar_configs; dashboard widget renders selected skin.
5. .gitignore entries + README regeneration note.

## Verification

Each sprite reviewed visually at 8× by generating agent; pilot reviewed before fan-out. App shows selected skin on dashboard + avatar page; build passes.
