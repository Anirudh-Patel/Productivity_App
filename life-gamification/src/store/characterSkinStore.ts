// Character Skin Store
// Loads the character sprite manifest from /assets/characters/manifest.json,
// tracks the selected skin id, and persists the selection in localStorage.
// The avatar_configs DB table exists, but a display-only skin preference is
// intentionally kept client-side (localStorage) to stay simple.

import { create } from 'zustand';

const STORAGE_KEY = 'character-skin';
const GEAR_STORAGE_KEY = 'character-gear';

/**
 * Per-sprite anchor points computed from the alpha silhouette by
 * tools/pixelart/anchors.py. All values are in native sprite pixel units.
 * Used by LayeredSprite to fit gear overlays to each character's proportions.
 */
export interface SpriteAnchors {
  headTop: number;
  headCx: number;
  headW: number;
  torsoTop: number;
  torsoCx: number;
  torsoW: number;
  torsoH: number;
  handLx: number;
  handLy: number;
  handRx: number;
  handRy: number;
  bodyTop: number;
  bodyH: number;
}

/** A single selectable character sprite, as described in manifest.json. */
export interface CharacterSkin {
  id: string;
  displayName: string;
  series: string;
  /** Optional evolution/form variant label (e.g. "Base", "Awakened"). */
  form?: string;
  /** Absolute path from the public root, e.g. "/assets/characters/goku.png". */
  file: string;
  width: number;
  height: number;
  /** Optional fitting anchors; absent on older manifests (gear renders unfitted). */
  anchors?: SpriteAnchors;
}

/** Equipment slots a gear item can occupy. One item may be equipped per slot. */
export type GearSlot = 'weapon' | 'headgear' | 'chest' | 'cape' | 'aura';

/**
 * Draw order relative to the base character sprite.
 * - "over": drawn on top of the base (chest, weapon, headgear).
 * - "under": drawn behind the base (capes, auras).
 */
export type GearZIndex = 'over' | 'under';

/**
 * Which character anchor a gear layer is fitted to at render time:
 * headgear → "head", chest → "torso", weapons → "handL"/"handR",
 * capes/auras → "body". Absent = render untransformed (legacy behavior).
 */
export type GearFit = 'head' | 'torso' | 'handL' | 'handR' | 'body';

/** A single equippable gear sprite, as described in the manifest `gear` section. */
export interface GearItem {
  id: string;
  displayName: string;
  slot: GearSlot;
  zIndex: GearZIndex;
  /** Absolute path from the public root, e.g. "/assets/characters/gear/straw-hat.png". */
  file: string;
  width: number;
  height: number;
  /** Optional fit target; absent on older manifests (gear renders unfitted). */
  fit?: GearFit;
}

/** All slots, in a stable display order for the Equipment page. */
export const GEAR_SLOTS: readonly GearSlot[] = ['weapon', 'headgear', 'chest', 'cape', 'aura'];

/** Human-readable slot labels. */
export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Weapon',
  headgear: 'Headgear',
  chest: 'Chest',
  cape: 'Cape',
  aura: 'Aura',
};

/** One equipped gear id per slot. Absent slots are empty. */
export type EquippedGear = Partial<Record<GearSlot, string>>;

interface CharacterSkinManifest {
  characters: CharacterSkin[];
  gear?: GearItem[];
}

interface CharacterSkinState {
  skins: CharacterSkin[];
  gear: GearItem[];
  selectedId: string | null;
  /** Map of slot -> equipped gear id. */
  equippedGear: EquippedGear;
  loading: boolean;
  loaded: boolean;
  /** Fetches the manifest. Tolerates a missing/invalid manifest by falling back to empty lists. */
  loadManifest: () => Promise<void>;
  /** Selects a skin (or clears the selection) and persists it to localStorage. */
  selectSkin: (id: string | null) => void;
  /** Equips a gear id into its slot, or clears the slot when id is null. Persists to localStorage. */
  equipGear: (slot: GearSlot, id: string | null) => void;
  /** Clears all equipped gear. */
  unequipAllGear: () => void;
  /** Convenience selector: the currently selected skin object, or null. */
  getSelectedSkin: () => CharacterSkin | null;
  /** Convenience selector: the equipped gear items, resolved to objects. */
  getEquippedGearItems: () => GearItem[];
}

function readStoredSelection(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSelection(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // localStorage unavailable (e.g. privacy mode) — selection is simply not persisted.
  }
}

function readStoredGear(): EquippedGear {
  try {
    const raw = localStorage.getItem(GEAR_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: EquippedGear = {};
    for (const slot of GEAR_SLOTS) {
      const value = (parsed as Record<string, unknown>)[slot];
      if (typeof value === 'string') result[slot] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writeStoredGear(gear: EquippedGear): void {
  try {
    if (Object.keys(gear).length === 0) {
      localStorage.removeItem(GEAR_STORAGE_KEY);
    } else {
      localStorage.setItem(GEAR_STORAGE_KEY, JSON.stringify(gear));
    }
  } catch {
    // localStorage unavailable — selection is simply not persisted.
  }
}

function isCharacterSkin(value: unknown): value is CharacterSkin {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.displayName === 'string' &&
    typeof c.series === 'string' &&
    (c.form === undefined || typeof c.form === 'string') &&
    typeof c.file === 'string' &&
    typeof c.width === 'number' &&
    typeof c.height === 'number'
  );
}

const ANCHOR_KEYS: readonly (keyof SpriteAnchors)[] = [
  'headTop',
  'headCx',
  'headW',
  'torsoTop',
  'torsoCx',
  'torsoW',
  'torsoH',
  'handLx',
  'handLy',
  'handRx',
  'handRy',
  'bodyTop',
  'bodyH',
];

/** Lenient anchor parse: any missing/non-numeric field ⇒ undefined (no fitting). */
function parseAnchors(value: unknown): SpriteAnchors | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const rec = value as Record<string, unknown>;
  const result: Partial<SpriteAnchors> = {};
  for (const key of ANCHOR_KEYS) {
    const v = rec[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    result[key] = v;
  }
  return result as SpriteAnchors;
}

const GEAR_FITS: readonly GearFit[] = ['head', 'torso', 'handL', 'handR', 'body'];

/** Lenient fit parse: unknown values ⇒ undefined (no fitting). */
function parseFit(value: unknown): GearFit | undefined {
  return (GEAR_FITS as readonly unknown[]).includes(value) ? (value as GearFit) : undefined;
}

function isGearItem(value: unknown): value is GearItem {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    typeof g.displayName === 'string' &&
    typeof g.slot === 'string' &&
    (GEAR_SLOTS as readonly string[]).includes(g.slot) &&
    (g.zIndex === 'over' || g.zIndex === 'under') &&
    typeof g.file === 'string' &&
    typeof g.width === 'number' &&
    typeof g.height === 'number'
  );
}

export const useCharacterSkinStore = create<CharacterSkinState>((set, get) => ({
  skins: [],
  gear: [],
  selectedId: readStoredSelection(),
  equippedGear: readStoredGear(),
  loading: false,
  loaded: false,

  loadManifest: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/assets/characters/manifest.json');
      if (!response.ok) {
        // 404 or similar — manifest absent. Graceful empty lists.
        set({ skins: [], gear: [], loading: false, loaded: true });
        return;
      }

      const data: unknown = await response.json();
      const isManifest = data && typeof data === 'object';
      const rawSkins =
        isManifest && Array.isArray((data as CharacterSkinManifest).characters)
          ? (data as CharacterSkinManifest).characters
          : [];
      const skins = rawSkins.filter(isCharacterSkin).map((s) => ({
        ...s,
        anchors: parseAnchors((s as { anchors?: unknown }).anchors),
      }));

      // Gear section is optional — older manifests omit it (gear features hidden).
      const rawGear =
        isManifest && Array.isArray((data as CharacterSkinManifest).gear)
          ? (data as CharacterSkinManifest).gear ?? []
          : [];
      const gear = rawGear.filter(isGearItem).map((g) => ({
        ...g,
        fit: parseFit((g as { fit?: unknown }).fit),
      }));

      // If the persisted skin selection is no longer valid, clear it.
      const storedSkin = get().selectedId;
      const selectedId = storedSkin && skins.some((s) => s.id === storedSkin) ? storedSkin : null;
      if (selectedId !== storedSkin) {
        writeStoredSelection(selectedId);
      }

      // Drop any equipped gear whose id no longer exists in the manifest.
      const storedGear = get().equippedGear;
      const equippedGear: EquippedGear = {};
      for (const slot of GEAR_SLOTS) {
        const id = storedGear[slot];
        if (id && gear.some((g) => g.id === id && g.slot === slot)) {
          equippedGear[slot] = id;
        }
      }
      if (Object.keys(equippedGear).length !== Object.keys(storedGear).length) {
        writeStoredGear(equippedGear);
      }

      set({ skins, gear, selectedId, equippedGear, loading: false, loaded: true });
    } catch {
      // Network error, malformed JSON, etc. — treat as empty.
      set({ skins: [], gear: [], loading: false, loaded: true });
    }
  },

  selectSkin: (id: string | null) => {
    writeStoredSelection(id);
    set({ selectedId: id });
  },

  equipGear: (slot: GearSlot, id: string | null) => {
    const next: EquippedGear = { ...get().equippedGear };
    if (id === null) {
      delete next[slot];
    } else {
      next[slot] = id;
    }
    writeStoredGear(next);
    set({ equippedGear: next });
  },

  unequipAllGear: () => {
    writeStoredGear({});
    set({ equippedGear: {} });
  },

  getSelectedSkin: () => {
    const { skins, selectedId } = get();
    if (!selectedId) return null;
    return skins.find((s) => s.id === selectedId) ?? null;
  },

  getEquippedGearItems: () => {
    const { gear, equippedGear } = get();
    const items: GearItem[] = [];
    for (const slot of GEAR_SLOTS) {
      const id = equippedGear[slot];
      if (!id) continue;
      const item = gear.find((g) => g.id === id);
      if (item) items.push(item);
    }
    return items;
  },
}));
