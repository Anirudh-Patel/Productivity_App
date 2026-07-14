#!/usr/bin/env python3
"""Reference-conditioned sprite generation via Gemini image models.

Zero third-party deps (urllib + zlib/struct PNG codec). API key read from
macOS Keychain (service 'life-gamification', account 'gemini_api_key').

Commands:
  generate <name> <prompt-file-or-text> [ref1.png ref2.png ...]
      Calls Gemini with optional reference images, saves raw model output
      to raw/<name>.png.
  pixelize <name> [--w 32 --h 48 --colors 16]
      Post-processes raw/<name>.png -> out/<name>.png (1x) + out/<name>@8x.png:
      crops to subject bounds, nearest-neighbor downscales into a WxH grid,
      quantizes to <=colors, knocks out the background (corner flood).
  all <name> <prompt...>   generate + pixelize with defaults.

Only PNG references are supported (JPEG refs: convert first with `sips -s
format png in.jpg --out out.png`).
"""
import base64
import json
import struct
import subprocess
import sys
import urllib.request
import zlib
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
MODEL = "gemini-3.1-flash-image"


# ---------- PNG codec (RGBA8) ----------

def png_read(path):
    data = Path(path).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, w, h, bitd, color, idat = 8, 0, 0, 0, 0, b""
    palette, trns = None, None
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if tag == b"IHDR":
            w, h, bitd, color = struct.unpack(">IIBB", chunk[:10])
        elif tag == b"PLTE":
            palette = [tuple(chunk[i:i + 3]) for i in range(0, len(chunk), 3)]
        elif tag == b"tRNS":
            trns = chunk
        elif tag == b"IDAT":
            idat += chunk
        elif tag == b"IEND":
            break
        pos += 12 + ln
    assert bitd == 8, f"unsupported bit depth {bitd}"
    raw = zlib.decompress(idat)
    nch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    stride = w * nch
    px, prev = [], bytearray(stride)
    pos = 0
    for _ in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos + stride]); pos += stride
        if f == 1:
            for i in range(nch, stride):
                line[i] = (line[i] + line[i - nch]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                b = prev[i]
                c = prev[i - nch] if i >= nch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        prev = line
        row = []
        for x in range(w):
            o = x * nch
            if color == 6:
                row.append((line[o], line[o + 1], line[o + 2], line[o + 3]))
            elif color == 2:
                row.append((line[o], line[o + 1], line[o + 2], 255))
            elif color == 0:
                row.append((line[o], line[o], line[o], 255))
            elif color == 4:
                row.append((line[o], line[o], line[o], line[o + 1]))
            elif color == 3:
                r, g, b = palette[line[o]]
                a = trns[line[o]] if trns and line[o] < len(trns) else 255
                row.append((r, g, b, a))
        px.append(row)
    return px


def png_write(path, px):
    h, w = len(px), len(px[0])
    def chunk(tag, d):
        c = struct.pack(">I", len(d)) + tag + d
        return c + struct.pack(">I", zlib.crc32(tag + d) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"".join(struct.pack("4B", *p) for p in row) for row in px)
    Path(path).write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b""))


# ---------- Gemini ----------

def api_key():
    return subprocess.run(
        ["security", "find-generic-password", "-s", "life-gamification",
         "-a", "gemini_api_key", "-w"],
        capture_output=True, text=True, check=True).stdout.strip()


def generate(name, prompt, refs):
    parts = [{"text": prompt}]
    for r in refs:
        parts.append({"inline_data": {
            "mime_type": "image/png",
            "data": base64.b64encode(Path(r).read_bytes()).decode()}})
    body = json.dumps({
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key()})
    with urllib.request.urlopen(req, timeout=120) as resp:
        out = json.load(resp)
    for part in out["candidates"][0]["content"]["parts"]:
        if "inlineData" in part:
            raw = base64.b64decode(part["inlineData"]["data"])
            (HERE / "raw").mkdir(exist_ok=True)
            dest = HERE / "raw" / f"{name}.png"
            dest.write_bytes(raw)
            if raw[:8] != b"\x89PNG\r\n\x1a\n":  # model often returns JPEG
                subprocess.run(["sips", "-s", "format", "png", str(dest),
                                "--out", str(dest)], capture_output=True, check=True)
            print(f"raw -> {dest} ({len(raw)} bytes, {part['inlineData'].get('mimeType')})")
            return dest
    raise SystemExit(f"no image in response: {json.dumps(out)[:400]}")


# ---------- pixelize ----------

def pixelize(name, gw=32, gh=48, ncolors=16, scale=8):
    src = HERE / "raw" / f"{name}.png"
    px = png_read(src)
    H, W = len(px), len(px[0])

    # Background = dominant border color; knock out via tolerance match.
    border = [px[0][x] for x in range(W)] + [px[H - 1][x] for x in range(W)] + \
             [px[y][0] for y in range(H)] + [px[y][W - 1] for y in range(H)]
    bg = Counter((p[0] // 24, p[1] // 24, p[2] // 24) for p in border).most_common(1)[0][0]

    def is_bg(p):
        return p[3] < 40 or (p[0] // 24, p[1] // 24, p[2] // 24) == bg or \
            (abs(p[0] - bg[0] * 24 - 12) < 36 and abs(p[1] - bg[1] * 24 - 12) < 36
             and abs(p[2] - bg[2] * 24 - 12) < 36)

    # Subject bounds
    xs = [x for y in range(H) for x in range(W) if not is_bg(px[y][x])]
    ys = [y for y in range(H) for x in range(W) if not is_bg(px[y][x])]
    if not xs:
        raise SystemExit("no subject found (all background)")
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)

    # Fit into grid preserving aspect
    sw, sh = x1 - x0 + 1, y1 - y0 + 1
    ratio = min(gw / sw, gh / sh)
    tw, th = max(1, round(sw * ratio)), max(1, round(sh * ratio))
    ox, oy = (gw - tw) // 2, gh - th  # bottom-anchor like hand-made sprites

    grid = [[(0, 0, 0, 0)] * gw for _ in range(gh)]
    for ty in range(th):
        for tx in range(tw):
            # majority-vote block sample
            bx0 = x0 + int(tx * sw / tw); bx1 = max(bx0 + 1, x0 + int((tx + 1) * sw / tw))
            by0 = y0 + int(ty * sh / th); by1 = max(by0 + 1, y0 + int((ty + 1) * sh / th))
            block = [px[y][x] for y in range(by0, min(by1, H)) for x in range(bx0, min(bx1, W))]
            fg = [p for p in block if not is_bg(p)]
            if len(fg) * 2 < len(block):
                continue
            c = Counter((p[0] // 16 * 16 + 8, p[1] // 16 * 16 + 8, p[2] // 16 * 16 + 8) for p in fg)
            grid[oy + ty][ox + tx] = (*c.most_common(1)[0][0], 255)

    # Quantize to <=ncolors by frequency, merge nearest
    counts = Counter(p for row in grid for p in row if p[3])
    pal = [c for c, _ in counts.most_common(ncolors)]
    def nearest(p):
        return min(pal, key=lambda q: (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2)
    grid = [[(nearest(p) if p[3] else p) for p in row] for row in grid]

    (HERE / "out").mkdir(exist_ok=True)
    png_write(HERE / "out" / f"{name}.png", grid)
    big = [[c for c in row for _ in range(scale)] for row in grid for _ in range(scale)]
    png_write(HERE / "out" / f"{name}@{scale}x.png", big)
    print(f"pixelized -> out/{name}.png ({gw}x{gh}, {len(pal)} colors) + @{scale}x")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, name = sys.argv[1], sys.argv[2]
    if cmd == "generate":
        prompt = Path(sys.argv[3]).read_text() if Path(sys.argv[3]).exists() else sys.argv[3]
        generate(name, prompt, sys.argv[4:])
    elif cmd == "pixelize":
        args = {k.lstrip('-'): int(v) for k, v in zip(sys.argv[3::2], sys.argv[4::2])}
        pixelize(name, args.get("w", 32), args.get("h", 48), args.get("colors", 16))
    elif cmd == "all":
        prompt = Path(sys.argv[3]).read_text() if Path(sys.argv[3]).exists() else sys.argv[3]
        generate(name, prompt, sys.argv[4:])
        pixelize(name)
    else:
        sys.exit(__doc__)
