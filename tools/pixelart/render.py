#!/usr/bin/env python3
"""Render character pixel-art JSON specs to PNG (1x + preview upscale).

Zero dependencies — writes PNGs via zlib/struct directly.

Spec format (JSON):
{
  "name": "sung-jinwoo",
  "palette": {".": null, "K": "#0d0d12", "S": "#e8c9a8", ...},  // char -> hex or null (transparent)
  "rows": ["....KKKK....", ...]   // equal-length strings, one char per pixel
}

Usage:
  python3 render.py characters/sung-jinwoo.json [outdir]
Outputs: <outdir>/<name>.png (1x) and <outdir>/<name>@8x.png (preview).
"""
import json
import struct
import sys
import zlib
from pathlib import Path


def hex_to_rgba(h):
    if h is None:
        return (0, 0, 0, 0)
    h = h.lstrip("#")
    if len(h) == 6:
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        return (r, g, b, 255)
    if len(h) == 8:
        r, g, b, a = (int(h[i:i + 2], 16) for i in (0, 2, 4, 6))
        return (r, g, b, a)
    raise ValueError(f"bad color {h!r}")


def write_png(path, width, height, pixels):
    """pixels: list of rows, each row list of (r,g,b,a)."""
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(
        b"\x00" + b"".join(struct.pack("4B", *px) for px in row) for row in pixels
    )
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    Path(path).write_bytes(png)


def render(spec_path, outdir=None, scale=8):
    spec = json.loads(Path(spec_path).read_text())
    name = spec["name"]
    palette = {k: hex_to_rgba(v) for k, v in spec["palette"].items()}
    rows = spec["rows"]
    w = len(rows[0])
    for i, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(f"row {i} width {len(r)} != {w}")
        for ch in r:
            if ch not in palette:
                raise ValueError(f"row {i}: unknown palette char {ch!r}")
    px = [[palette[ch] for ch in row] for row in rows]
    outdir = Path(outdir or Path(spec_path).parent.parent / "out")
    outdir.mkdir(parents=True, exist_ok=True)
    write_png(outdir / f"{name}.png", w, len(rows), px)
    big = [[c for c in row for _ in range(scale)] for row in px for _ in range(scale)]
    write_png(outdir / f"{name}@{scale}x.png", w * scale, len(rows) * scale, big)
    print(f"{name}: {w}x{len(rows)} -> {outdir}/{name}.png (+@{scale}x preview)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
