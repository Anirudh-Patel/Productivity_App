import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface Equipment {
  id: number;
  name: string;
  slot: 'head' | 'chest' | 'legs' | 'weapon' | 'accessory' | 'background';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  spriteData: {
    color: string;
    glow?: boolean;
    backgroundType?: 'solid' | 'gradient' | 'image' | 'animated';
    backgroundData?: {
      colors?: string[];
      imageUrl?: string;
      animationFrames?: string[];
    };
  };
}

interface AvatarState {
  equipped: {
    head: Equipment | null;
    chest: Equipment | null;
    legs: Equipment | null;
    weapon: Equipment | null;
    accessory: Equipment | null;
    background: Equipment | null;
  };
  inventory: Equipment[];
  config: {
    skinColor: string;
    hairColor: string;
    eyeColor: string;
    scale: number;
    animationSpeed: number;
  };
  currentAnimation: 'idle' | 'walk' | 'attack' | 'jump';
  animationFrame: number;
  
  // Actions
  loadUserEquipment: (userId: number) => Promise<void>;
  equipItem: (item: Equipment) => Promise<void>;
  unequipItem: (slot: string) => Promise<void>;
  setAnimation: (animation: 'idle' | 'walk' | 'attack' | 'jump') => void;
  nextFrame: () => void;
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  equipped: {
    head: null,
    chest: null,
    legs: null,
    weapon: null,
    accessory: null,
    background: {
      id: 999,
      name: 'Test Background',
      slot: 'background' as const,
      rarity: 'common' as const,
      spriteData: {
        color: '#E74C3C',
        backgroundType: 'gradient',
        backgroundData: {
          colors: ['#E74C3C', '#8E44AD']
        }
      }
    },
  },
  inventory: [],
  config: {
    skinColor: '#F5DEB3',
    hairColor: '#4A4A4A',
    eyeColor: '#4A90E2',
    scale: 2,
    animationSpeed: 8,
  },
  currentAnimation: 'idle',
  animationFrame: 0,

  loadUserEquipment: async (userId) => {
    try {
      const equipment = await invoke('get_user_equipment', { userId }) as Equipment[];
      
      // Process equipment and separate equipped vs inventory
      const equipped = {
        head: null,
        chest: null,
        legs: null,
        weapon: null,
        accessory: null,
        background: null,
      };
      const inventory: Equipment[] = [];

      // For now, put first of each type in equipped slots, rest in inventory
      const equipmentBySlot: Record<string, Equipment[]> = {};
      
      equipment.forEach(item => {
        // Convert spriteData from backend format
        const processedItem = {
          ...item,
          spriteData: typeof item.spriteData === 'object' ? item.spriteData : { color: '#808080' }
        } as Equipment;
        
        if (!equipmentBySlot[item.slot]) {
          equipmentBySlot[item.slot] = [];
        }
        equipmentBySlot[item.slot].push(processedItem);
      });

      // Equip first item of each slot type, put rest in inventory
      Object.entries(equipmentBySlot).forEach(([slot, items]) => {
        if (items.length > 0 && slot in equipped) {
          equipped[slot as keyof typeof equipped] = items[0];
          // Add remaining items to inventory
          inventory.push(...items.slice(1));
        }
      });

      // Add test background for now
      equipped.background = {
        id: 999,
        name: 'Test Background',
        slot: 'background' as const,
        rarity: 'common' as const,
        spriteData: {
          color: '#E74C3C',
          backgroundType: 'gradient',
          backgroundData: {
            colors: ['#E74C3C', '#8E44AD']
          }
        }
      };

      set({ equipped, inventory });

      // Also load avatar config
      const config = await invoke('get_avatar_config', { userId }) as {
        skin_color: string;
        hair_color: string;
        eye_color: string;
        scale: number;
        animation_speed: number;
      };
      
      set({
        config: {
          skinColor: config.skin_color,
          hairColor: config.hair_color,
          eyeColor: config.eye_color,
          scale: config.scale,
          animationSpeed: config.animation_speed,
        }
      });
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  },

  equipItem: async (item) => {
    const { equipped } = get();
    const slot = item.slot as keyof typeof equipped;
    
    // Unequip existing item in slot if present
    if (equipped[slot]) {
      await get().unequipItem(slot);
    }
    
    set((state) => ({
      equipped: { ...state.equipped, [slot]: item },
      inventory: state.inventory.filter(i => i.id !== item.id)
    }));
    
    // Call Tauri command to persist
    try {
      await invoke('equip_item', { userId: 1, itemId: item.id, slot: item.slot });
    } catch (error) {
      console.error('Failed to equip item:', error);
    }
  },

  unequipItem: async (slot) => {
    const { equipped } = get();
    const item = equipped[slot as keyof typeof equipped];
    if (!item) return;
    
    set((state) => ({
      equipped: { ...state.equipped, [slot]: null },
      inventory: [...state.inventory, item]
    }));
    
    try {
      await invoke('unequip_item', { userId: 1, slot });
    } catch (error) {
      console.error('Failed to unequip item:', error);
    }
  },

  setAnimation: (animation) => {
    set({ currentAnimation: animation, animationFrame: 0 });
  },

  nextFrame: () => {
    set((state) => ({
      animationFrame: (state.animationFrame + 1) % 4 // 4 frames per animation
    }));
  },
}));