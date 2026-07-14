// LayeredSprite
// Renders a character sprite with equipped gear stacked as absolutely-positioned
// layers. All sprites share the same 32x48 pixel canvas. Draw order (back to front):
//   1. "under" gear  — aura (lowest), then cape
//   2. the base character skin
//   3. "over" gear   — chest, then weapon, then headgear
//
// Gear fitting: AI-generated skins don't share the hand-drawn canonical grid, so
// each gear layer is transformed (translate + scale) from the canonical reference
// anchors it was authored against onto the character's per-sprite anchors
// (computed by tools/pixelart/anchors.py and stored in manifest.json).
// Characters without anchors, or gear without a fit target, render untransformed.

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
 * to the character's proportions.
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
 * CSS transform style for a gear layer, in display units (sprite px × scale).
 * With transform-origin at the reference point, `scale()` holds that point
 * fixed and `translate()` then moves it onto the character's anchor.
 */
function fitStyle(fit: GearFit, anchors: SpriteAnchors, scale: number): CSSProperties {
  const t = fitTransform(fit, anchors);
  return {
    transform: `translate(${t.tx * scale}px, ${t.ty * scale}px) scale(${t.sx}, ${t.sy})`,
    transformOrigin: `${t.originX * scale}px ${t.originY * scale}px`,
  };
}

/** Sorts gear items into a stable draw order by the given slot sequence. */
function orderBySlot(items: GearItem[], order: readonly GearSlot[]): GearItem[] {
  return order
    .map((slot) => items.find((g) => g.slot === slot))
    .filter((g): g is GearItem => g !== undefined);
}

/**
 * Renders a layered pixel-art character: gear behind the base, the base skin,
 * then gear in front. The container is sized to the sprite canvas times `scale`.
 */
export function LayeredSprite({ skin, gear, scale = 1 }: LayeredSpriteProps) {
  const width = SPRITE_WIDTH * scale;
  const height = SPRITE_HEIGHT * scale;

  const underGear = orderBySlot(
    gear.filter((g) => g.zIndex === 'under'),
    UNDER_ORDER,
  );
  const overGear = orderBySlot(
    gear.filter((g) => g.zIndex === 'over'),
    OVER_ORDER,
  );

  const toLayer = (g: GearItem, plane: string) => ({
    key: `${plane}-${g.slot}-${g.id}`,
    src: g.file,
    isBase: false,
    // Fit only when both sides opt in; otherwise legacy untransformed render.
    fitCss: skin.anchors && g.fit ? fitStyle(g.fit, skin.anchors, scale) : undefined,
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

export default LayeredSprite;
