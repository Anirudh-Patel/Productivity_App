// LayeredSprite
// Renders a character sprite with equipped gear stacked as absolutely-positioned
// layers. All sprites share the same 32x48 pixel canvas, so every layer is drawn
// full-size at inset 0. Draw order (back to front):
//   1. "under" gear  — aura (lowest), then cape
//   2. the base character skin
//   3. "over" gear   — chest, then weapon, then headgear
// This keeps auras/capes behind the character and weapons/headgear in front.

import type { CSSProperties } from 'react';
import type { CharacterSkin, GearItem, GearSlot } from '../../../store/characterSkinStore';

/** Native sprite dimensions shared by every character and gear asset. */
const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 48;

/** Slot ordering within each z-plane, back to front. */
const UNDER_ORDER: readonly GearSlot[] = ['aura', 'cape'];
const OVER_ORDER: readonly GearSlot[] = ['chest', 'weapon', 'headgear'];

interface LayeredSpriteProps {
  /** The base character skin. */
  skin: CharacterSkin;
  /** Equipped gear items to layer around the base (any order). */
  gear: GearItem[];
  /** Integer-ish multiplier applied to the 32x48 canvas. Defaults to 1. */
  scale?: number;
}

const PIXELATED: CSSProperties = { imageRendering: 'pixelated' };

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

  const layers: Array<{ key: string; src: string; isBase: boolean }> = [
    ...underGear.map((g) => ({ key: `under-${g.slot}-${g.id}`, src: g.file, isBase: false })),
    { key: `base-${skin.id}`, src: skin.file, isBase: true },
    ...overGear.map((g) => ({ key: `over-${g.slot}-${g.id}`, src: g.file, isBase: false })),
  ];

  return (
    <div className="relative" style={{ width, height }}>
      {layers.map((layer) => (
        <img
          key={layer.key}
          src={layer.src}
          alt={layer.isBase ? skin.displayName : ''}
          aria-hidden={layer.isBase ? undefined : true}
          className="pointer-events-none absolute inset-0"
          style={{ width, height, ...PIXELATED }}
          draggable={false}
        />
      ))}
    </div>
  );
}

export default LayeredSprite;
