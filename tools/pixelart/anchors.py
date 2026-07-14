#!/usr/bin/env python3
"""anchors.py — per-sprite anchor extraction for the gear-fitting system.

Reads every character 1x PNG referenced by the manifest, computes body/head/
torso/hand anchors from the alpha silhouette, and writes them back into
manifest.json (each character gains an "anchors" object). Gear entries gain a
"fit" key (head | torso | handL | handR | body) derived from their slot.

Stdlib-only; reuses the PNG codec from genai.py in this directory.

Usage:
    python3 tools/pixelart/anchors.py [assets_dir]

assets_dir defaults to life-gamification/public/assets/characters relative to
the repo root (two levels up from this file).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from genai import png_read  # noqa: E402

# Weapons authored held on the left side of the canvas; all other weapons
# were drawn on the right.
LEFT_HAND_WEAPONS = {"murim-jian", "frost-spear"}

SLOT_FIT = {
    "headgear": "head",
    "chest": "torso",
    "cape": "body",
    "aura": "body",
}

ALPHA_MIN = 8  # ignore near-transparent antialiasing residue


def row_stats(px, y):
    """(width, [alpha columns]) of row y, or (0, []) when fully transparent."""
    cols = [x for x, p in enumerate(px[y]) if p[3] >= ALPHA_MIN]
    if not cols:
        return 0, cols
    return cols[-1] - cols[0] + 1, cols


def band_centroid_x(px, y0, y1):
    """Alpha-pixel centroid x over rows y0..y1 inclusive (None if empty)."""
    total, count = 0.0, 0
    for y in range(y0, y1 + 1):
        for x, p in enumerate(px[y]):
            if p[3] >= ALPHA_MIN:
                total += x
                count += 1
    return (total / count) if count else None


def median(values):
    vals = sorted(values)
    n = len(vals)
    if n == 0:
        return 0.0
    mid = n // 2
    return float(vals[mid]) if n % 2 else (vals[mid - 1] + vals[mid]) / 2.0


def r1(v):
    return round(float(v), 1)


def compute_anchors(px):
    """Anchor dict from a decoded RGBA pixel grid, or None if fully transparent."""
    h = len(px)
    alpha_rows = [y for y in range(h) if any(p[3] >= ALPHA_MIN for p in px[y])]
    if not alpha_rows:
        return None
    body_top, body_bot = alpha_rows[0], alpha_rows[-1]
    body_h = body_bot - body_top + 1

    def band(f0, f1):
        """Clamped inclusive row range [bodyTop + f0*bodyH, bodyTop + f1*bodyH)."""
        y0 = body_top + int(round(f0 * body_h))
        y1 = body_top + int(round(f1 * body_h)) - 1
        y0 = max(body_top, min(y0, body_bot))
        y1 = max(y0, min(y1, body_bot))
        return y0, y1

    # --- head: top 40% of the body ---
    head_y0, head_y1 = band(0.0, 0.40)
    head_widths = [row_stats(px, y)[0] for y in range(head_y0, head_y1 + 1)]
    head_w = max(head_widths) if head_widths else 0
    # headTop: first band row whose width reaches 60% of headW — skips thin
    # hair spikes / antennae so hats sit on the skull, not the topmost strand.
    head_top = body_top
    for y in range(head_y0, head_y1 + 1):
        if row_stats(px, y)[0] >= 0.6 * head_w:
            head_top = y
            break
    head_cx = band_centroid_x(px, head_y0, head_y1)
    if head_cx is None:
        head_cx = (len(px[0]) - 1) / 2.0

    # --- torso: 45%..70% of the body ---
    torso_y0, torso_y1 = band(0.45, 0.70)
    torso_widths = [w for w in (row_stats(px, y)[0] for y in range(torso_y0, torso_y1 + 1)) if w > 0]
    torso_w = median(torso_widths) if torso_widths else head_w
    torso_h = torso_y1 - torso_y0 + 1
    torso_cx = band_centroid_x(px, torso_y0, torso_y1)
    if torso_cx is None:
        torso_cx = head_cx

    # --- hands: extreme alpha columns in the 55%..75% band ---
    hand_y0, hand_y1 = band(0.55, 0.75)
    hand_l = hand_r = None
    for y in range(hand_y0, hand_y1 + 1):
        _, cols = row_stats(px, y)
        if not cols:
            continue
        if hand_l is None or cols[0] < hand_l[0]:
            hand_l = (cols[0], y)
        if hand_r is None or cols[-1] > hand_r[0]:
            hand_r = (cols[-1], y)
    if hand_l is None:  # tiny sprites (slime blob): fall back to torso center
        fallback = (torso_cx, (torso_y0 + torso_y1) / 2.0)
        hand_l = hand_r = fallback

    return {
        "headTop": r1(head_top),
        "headCx": r1(head_cx),
        "headW": r1(head_w),
        "torsoTop": r1(torso_y0),
        "torsoCx": r1(torso_cx),
        "torsoW": r1(torso_w),
        "torsoH": r1(torso_h),
        "handLx": r1(hand_l[0]),
        "handLy": r1(hand_l[1]),
        "handRx": r1(hand_r[0]),
        "handRy": r1(hand_r[1]),
        "bodyTop": r1(body_top),
        "bodyH": r1(body_h),
    }


def gear_fit(item):
    if item.get("slot") == "weapon":
        return "handL" if item.get("id") in LEFT_HAND_WEAPONS else "handR"
    return SLOT_FIT.get(item.get("slot"))


def main():
    repo_root = Path(__file__).resolve().parents[2]
    assets = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else repo_root / "life-gamification" / "public" / "assets" / "characters"
    )
    manifest_path = assets / "manifest.json"
    manifest = json.loads(manifest_path.read_text())

    missing = []
    for char in manifest.get("characters", []):
        png_path = assets / Path(char["file"]).name
        if not png_path.exists():
            missing.append(char["id"])
            continue
        anchors = compute_anchors(png_read(png_path))
        if anchors is None:
            missing.append(char["id"])
            continue
        char["anchors"] = anchors

    for item in manifest.get("gear", []):
        fit = gear_fit(item)
        if fit:
            item["fit"] = fit

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    json.loads(manifest_path.read_text())  # validate round-trip

    done = sum(1 for c in manifest.get("characters", []) if "anchors" in c)
    print(f"anchors: {done}/{len(manifest.get('characters', []))} characters")
    print(f"fit: {sum(1 for g in manifest.get('gear', []) if 'fit' in g)}/{len(manifest.get('gear', []))} gear")
    if missing:
        print(f"skipped (missing/empty): {', '.join(missing)}")


if __name__ == "__main__":
    main()
