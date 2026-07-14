// LayeredSprite
// Renders a character sprite with equipped gear composited onto a single <canvas>
// at native 32x48 logical pixels (upscaled via CSS, nearest-neighbor). Draw order
// (back to front):
//   aura → cape → base → chest → weapon → headgear
//
// Gear fitting: AI-generated skins don't share the hand-drawn canonical grid, so
// each gear layer is transformed (translate + scale) from the canonical reference
// anchors it was authored against onto the character's per-sprite anchors
// (computed by tools/pixelart/anchors.py and stored in manifest.json). The math is
// identical to the previous CSS-transform implementation, applied here via
// ctx.setTransform + drawImage in logical pixel space.
//
// Chest masking (the point of the canvas rewrite): the chest layer is alpha-masked
// to the BASE character's silhouette (dilated 2px, restricted to torso rows) so the
// armor conforms to each body's contour — a slime gets slime-shaped armor, a wide
// dress gets a wide breastplate — rather than reading as a pasted-on rectangle.
//
// Fallbacks: characters without anchors → gear drawn untransformed, chest unmasked.
// If a 2D canvas context can't be created → the legacy stacked-<img> render is used.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  CharacterSkin,
  GearFit,
  GearItem,
  GearSlot,
  SpriteAnchors,
} from '../../../store/characterSkinStore';

/** Native sprite dimensions shared by every character and gear asset. */
const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 48;

/** Slot ordering within each z-plane, back to front. */
const UNDER_ORDER: readonly GearSlot[] = ['aura', 'cape'];
const OVER_ORDER: readonly GearSlot[] = ['chest', 'weapon', 'headgear'];

/** Dilation radius (logical px) applied to the base silhouette when masking chest. */
const DILATE_RADIUS = 2;

// Canonical reference anchors of the grid the gear sprites were authored
// against (see plans/PLAN_AI_SPRITE_LIBRARY.md addendum, 2026-07-13).
const REF = {
  head: { x: 15.5, y: 1, w: 20 },
  torso: { x: 15.5, y: 19, w: 16, h: 12 },
  handL: { x: 6, y: 27 },
  handR: { x: 25, y: 27 },
  body: { cx: 15.5, cy: 21.5, h: 41 },
} as const;

interface LayeredSpriteProps {
  /** The base character skin. */
  skin: CharacterSkin;
  /** Equipped gear items to layer around the base (any order). */
  gear: GearItem[];
  /** Integer-ish multiplier applied to the 32x48 canvas. Defaults to 1. */
  scale?: number;
}

const PIXELATED: CSSProperties = { imageRendering: 'pixelated' };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface FitTransform {
  /** Reference point in sprite px — held fixed while scaling. */
  originX: number;
  originY: number;
  /** Translation in sprite px mapping the reference point onto the anchor. */
  tx: number;
  ty: number;
  sx: number;
  sy: number;
}

/**
 * Computes the layer transform (sprite pixel units) that maps a gear sprite's
 * canonical reference point onto the character's corresponding anchor, scaled
 * to the character's proportions. Identical math to the prior CSS implementation.
 */
function fitTransform(fit: GearFit, a: SpriteAnchors): FitTransform {
  switch (fit) {
    case 'head': {
      const s = clamp(a.headW / REF.head.w, 0.75, 1.5);
      return {
        originX: REF.head.x,
        originY: REF.head.y,
        tx: a.headCx - REF.head.x,
        ty: a.headTop - REF.head.y,
        sx: s,
        sy: s,
      };
    }
    case 'torso': {
      return {
        originX: REF.torso.x,
        originY: REF.torso.y,
        tx: a.torsoCx - REF.torso.x,
        ty: a.torsoTop - REF.torso.y,
        sx: clamp(a.torsoW / REF.torso.w, 0.75, 1.6),
        sy: clamp(a.torsoH / REF.torso.h, 0.75, 1.5),
      };
    }
    case 'handL': {
      return {
        originX: REF.handL.x,
        originY: REF.handL.y,
        tx: a.handLx - REF.handL.x,
        ty: a.handLy - REF.handL.y,
        sx: 1,
        sy: 1,
      };
    }
    case 'handR': {
      return {
        originX: REF.handR.x,
        originY: REF.handR.y,
        tx: a.handRx - REF.handR.x,
        ty: a.handRy - REF.handR.y,
        sx: 1,
        sy: 1,
      };
    }
    case 'body': {
      const s = clamp(a.bodyH / REF.body.h, 0.7, 1.3);
      return {
        originX: REF.body.cx,
        originY: REF.body.cy,
        tx: a.torsoCx - REF.body.cx,
        ty: a.bodyTop + a.bodyH / 2 - REF.body.cy,
        sx: s,
        sy: s,
      };
    }
  }
}

/**
 * Applies a FitTransform to a canvas context as an affine matrix, in logical
 * pixel space. Ported from the CSS `transform-origin + translate + scale` model:
 * with the reference point held fixed, `dest = (o + t) + s*(src - o)`. Expanding
 * gives the matrix [sx 0 0 sy  ex ey] where ex = ox+tx-sx*ox, ey = oy+ty-sy*oy.
 */
function applyFit(ctx: CanvasRenderingContext2D, t: FitTransform): void {
  const ex = t.originX + t.tx - t.sx * t.originX;
  const ey = t.originY + t.ty - t.sy * t.originY;
  ctx.setTransform(t.sx, 0, 0, t.sy, ex, ey);
}

/** Sorts gear items into a stable draw order by the given slot sequence. */
function orderBySlot(items: GearItem[], order: readonly GearSlot[]): GearItem[] {
  return order
    .map((slot) => items.find((g) => g.slot === slot))
    .filter((g): g is GearItem => g !== undefined);
}

// ---------- image loader cache ----------

/** Module-level cache: src → a promise resolving to a decoded HTMLImageElement. */
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
  // Don't cache rejections — allow a later retry to reload.
  promise.catch(() => imageCache.delete(src));
  imageCache.set(src, promise);
  return promise;
}

// ---------- offscreen helpers ----------

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Builds a silhouette mask for the base image: its alpha channel dilated by
 * DILATE_RADIUS px (via the 5x5 offset-draw trick), then cleared above the torso
 * band so headgear/face rows are never masked into the chest. Returns a canvas
 * whose opaque pixels are the region the chest layer is allowed to occupy.
 */
function buildChestMask(base: HTMLImageElement, anchors: SpriteAnchors): HTMLCanvasElement {
  const mask = makeCanvas(SPRITE_WIDTH, SPRITE_HEIGHT);
  const mctx = mask.getContext('2d')!;
  mctx.imageSmoothingEnabled = false;

  // Cheap, exact dilation: stamp the base at every integer offset within a
  // 2px radius disc (25-cell 5x5 grid minus corners outside the radius).
  for (let dy = -DILATE_RADIUS; dy <= DILATE_RADIUS; dy++) {
    for (let dx = -DILATE_RADIUS; dx <= DILATE_RADIUS; dx++) {
      if (dx * dx + dy * dy > DILATE_RADIUS * DILATE_RADIUS) continue;
      mctx.drawImage(base, dx, dy);
    }
  }

  // Restrict to torso rows: erase everything above torsoTop-3 so the mask can't
  // pull the chest up over the head/headband.
  const rowMin = Math.round(anchors.torsoTop - 3);
  if (rowMin > 0) {
    mctx.clearRect(0, 0, SPRITE_WIDTH, Math.max(0, rowMin));
  }
  return mask;
}

/**
 * Renders the chest gear onto an offscreen canvas with its fit transform, then
 * masks it to the (dilated, torso-restricted) base silhouette via destination-in.
 * Returns the masked chest canvas, ready to be drawn onto the main canvas at 1:1.
 */
function renderMaskedChest(
  chest: HTMLImageElement,
  base: HTMLImageElement,
  anchors: SpriteAnchors,
): HTMLCanvasElement {
  const layer = makeCanvas(SPRITE_WIDTH, SPRITE_HEIGHT);
  const lctx = layer.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;

  const t = fitTransform('torso', anchors);
  applyFit(lctx, t);
  lctx.drawImage(chest, 0, 0);
  lctx.setTransform(1, 0, 0, 1, 0, 0);

  // Keep chest pixels only where the base silhouette allows.
  const mask = buildChestMask(base, anchors);
  lctx.globalCompositeOperation = 'destination-in';
  lctx.drawImage(mask, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  return layer;
}

/** Draws a gear image with its fit transform (or untransformed if no fit/anchors). */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fit: GearFit | undefined,
  anchors: SpriteAnchors | undefined,
): void {
  if (fit && anchors) {
    applyFit(ctx, fitTransform(fit, anchors));
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.drawImage(img, 0, 0);
  }
}

/** Legacy stacked-<img> render, used only when a 2D canvas context is unavailable. */
function ImgStackFallback({ skin, gear, scale }: Required<LayeredSpriteProps>) {
  const width = SPRITE_WIDTH * scale;
  const height = SPRITE_HEIGHT * scale;

  const underGear = orderBySlot(gear.filter((g) => g.zIndex === 'under'), UNDER_ORDER);
  const overGear = orderBySlot(gear.filter((g) => g.zIndex === 'over'), OVER_ORDER);

  const fitStyle = (fit: GearFit, anchors: SpriteAnchors): CSSProperties => {
    const t = fitTransform(fit, anchors);
    return {
      transform: `translate(${t.tx * scale}px, ${t.ty * scale}px) scale(${t.sx}, ${t.sy})`,
      transformOrigin: `${t.originX * scale}px ${t.originY * scale}px`,
    };
  };

  const toLayer = (g: GearItem, plane: string) => ({
    key: `${plane}-${g.slot}-${g.id}`,
    src: g.file,
    isBase: false,
    fitCss: skin.anchors && g.fit ? fitStyle(g.fit, skin.anchors) : undefined,
  });

  const layers: Array<{ key: string; src: string; isBase: boolean; fitCss?: CSSProperties }> = [
    ...underGear.map((g) => toLayer(g, 'under')),
    { key: `base-${skin.id}`, src: skin.file, isBase: true },
    ...overGear.map((g) => toLayer(g, 'over')),
  ];

  return (
    <div className="relative" style={{ width, height }}>
      {layers.map((layer) => (
        <div
          key={layer.key}
          className="pointer-events-none absolute inset-0"
          style={{ width, height, ...layer.fitCss }}
        >
          <img
            src={layer.src}
            alt={layer.isBase ? skin.displayName : ''}
            aria-hidden={layer.isBase ? undefined : true}
            className="pointer-events-none absolute inset-0"
            style={{ width, height, ...PIXELATED }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a layered pixel-art character on a single canvas: gear behind the base,
 * the base skin, then gear in front, with the chest layer masked to the base
 * silhouette. Redraws whenever the skin, equipped gear, or scale changes.
 */
export function LayeredSprite({ skin, gear, scale = 1 }: LayeredSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasFailed, setCanvasFailed] = useState(false);

  const underGear = orderBySlot(gear.filter((g) => g.zIndex === 'under'), UNDER_ORDER);
  const overGear = orderBySlot(gear.filter((g) => g.zIndex === 'over'), OVER_ORDER);

  // Stable dependency key so the effect only re-runs on meaningful changes.
  const gearKey = [...underGear, ...overGear].map((g) => `${g.slot}:${g.id}`).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCanvasFailed(true);
      return;
    }
    ctx.imageSmoothingEnabled = false;

    let cancelled = false;

    // Collect every layer's src in draw order (chest carries the base for masking).
    const under = orderBySlot(gear.filter((g) => g.zIndex === 'under'), UNDER_ORDER);
    const over = orderBySlot(gear.filter((g) => g.zIndex === 'over'), OVER_ORDER);
    const gearSrcs = [...under, ...over].map((g) => g.file);
    const allSrcs = [skin.file, ...gearSrcs];

    Promise.all(allSrcs.map(loadImage))
      .then((imgs) => {
        if (cancelled || canvasRef.current !== canvas) return;
        const bySrc = new Map<string, HTMLImageElement>();
        allSrcs.forEach((src, i) => bySrc.set(src, imgs[i]));
        const base = bySrc.get(skin.file)!;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);

        // aura → cape (under the base)
        for (const g of under) {
          const img = bySrc.get(g.file);
          if (img) drawFitted(ctx, img, g.fit, skin.anchors);
        }

        // base
        ctx.drawImage(base, 0, 0);

        // chest → weapon → headgear (over the base)
        for (const g of over) {
          const img = bySrc.get(g.file);
          if (!img) continue;
          if (g.slot === 'chest' && g.fit === 'torso' && skin.anchors) {
            // Masked to the base silhouette so armor conforms to the body.
            const masked = renderMaskedChest(img, base, skin.anchors);
            ctx.drawImage(masked, 0, 0);
          } else {
            drawFitted(ctx, img, g.fit, skin.anchors);
          }
        }
      })
      .catch(() => {
        // An image failed to load; leave whatever is drawn. Not fatal.
      });

    return () => {
      cancelled = true;
    };
    // gearKey captures the equipped set; skin.id/anchors/file capture the skin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skin.id, skin.file, skin.anchors, gearKey, scale]);

  if (canvasFailed) {
    return <ImgStackFallback skin={skin} gear={gear} scale={scale} />;
  }

  const width = SPRITE_WIDTH * scale;
  const height = SPRITE_HEIGHT * scale;

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_WIDTH}
      height={SPRITE_HEIGHT}
      role="img"
      aria-label={skin.displayName}
      className="pointer-events-none"
      style={{ width, height, ...PIXELATED }}
    />
  );
}

export default LayeredSprite;
