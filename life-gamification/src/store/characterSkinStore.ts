// Character Skin Store
// Loads the character sprite manifest from /assets/characters/manifest.json,
// tracks the selected skin id, and persists the selection in localStorage.
// The avatar_configs DB table exists, but a display-only skin preference is
// intentionally kept client-side (localStorage) to stay simple.

import { create } from 'zustand';

const STORAGE_KEY = 'character-skin';

/** A single selectable character sprite, as described in manifest.json. */
export interface CharacterSkin {
  id: string;
  displayName: string;
  series: string;
  /** Absolute path from the public root, e.g. "/assets/characters/goku.png". */
  file: string;
  width: number;
  height: number;
}

interface CharacterSkinManifest {
  characters: CharacterSkin[];
}

interface CharacterSkinState {
  skins: CharacterSkin[];
  selectedId: string | null;
  loading: boolean;
  loaded: boolean;
  /** Fetches the manifest. Tolerates a missing/invalid manifest by falling back to an empty list. */
  loadManifest: () => Promise<void>;
  /** Selects a skin (or clears the selection) and persists it to localStorage. */
  selectSkin: (id: string | null) => void;
  /** Convenience selector: the currently selected skin object, or null. */
  getSelectedSkin: () => CharacterSkin | null;
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

function isCharacterSkin(value: unknown): value is CharacterSkin {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.displayName === 'string' &&
    typeof c.series === 'string' &&
    typeof c.file === 'string' &&
    typeof c.width === 'number' &&
    typeof c.height === 'number'
  );
}

export const useCharacterSkinStore = create<CharacterSkinState>((set, get) => ({
  skins: [],
  selectedId: readStoredSelection(),
  loading: false,
  loaded: false,

  loadManifest: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/assets/characters/manifest.json');
      if (!response.ok) {
        // 404 or similar — manifest absent. Graceful empty list.
        set({ skins: [], loading: false, loaded: true });
        return;
      }

      const data: unknown = await response.json();
      const rawList =
        data && typeof data === 'object' && Array.isArray((data as CharacterSkinManifest).characters)
          ? (data as CharacterSkinManifest).characters
          : [];
      const skins = rawList.filter(isCharacterSkin);

      // If the persisted selection is no longer valid, clear it.
      const stored = get().selectedId;
      const selectedId = stored && skins.some((s) => s.id === stored) ? stored : null;
      if (selectedId !== stored) {
        writeStoredSelection(selectedId);
      }

      set({ skins, selectedId, loading: false, loaded: true });
    } catch {
      // Network error, malformed JSON, etc. — treat as empty.
      set({ skins: [], loading: false, loaded: true });
    }
  },

  selectSkin: (id: string | null) => {
    writeStoredSelection(id);
    set({ selectedId: id });
  },

  getSelectedSkin: () => {
    const { skins, selectedId } = get();
    if (!selectedId) return null;
    return skins.find((s) => s.id === selectedId) ?? null;
  },
}));
