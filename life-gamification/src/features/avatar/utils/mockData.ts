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

const SLOT_NAMES = {
  head: ['Cap', 'Helm', 'Crown', 'Hood', 'Headband', 'Circlet', 'Mask', 'Tiara', 'Bandana', 'Headdress'],
  chest: ['Shirt', 'Armor', 'Robe', 'Vest', 'Tunic', 'Mail', 'Plate', 'Jerkin', 'Doublet', 'Breastplate'],
  legs: ['Pants', 'Leggings', 'Greaves', 'Trousers', 'Chaps', 'Skirt', 'Shorts', 'Breeches', 'Kilt', 'Legplates'],
  weapon: ['Sword', 'Staff', 'Bow', 'Dagger', 'Mace', 'Axe', 'Spear', 'Wand', 'Club', 'Hammer'],
  accessory: ['Ring', 'Amulet', 'Pendant', 'Bracelet', 'Earring', 'Brooch', 'Charm', 'Necklace', 'Anklet', 'Talisman'],
  background: ['Forest', 'Desert', 'Ocean', 'Mountain', 'Cave', 'Castle', 'Temple', 'Volcano', 'Tundra', 'Swamp']
};

const RARITY_MODIFIERS = {
  common: ['Basic', 'Simple', 'Plain', 'Common', 'Standard'],
  uncommon: ['Fine', 'Quality', 'Enhanced', 'Improved', 'Superior'],
  rare: ['Masterwork', 'Enchanted', 'Refined', 'Exceptional', 'Pristine'],
  epic: ['Legendary', 'Mythic', 'Ancient', 'Celestial', 'Divine'],
  legendary: ['Godlike', 'Eternal', 'Cosmic', 'Ultimate', 'Supreme']
};

const RARITY_COLORS = {
  common: ['#808080', '#969696', '#757575', '#898989', '#6B6B6B'],
  uncommon: ['#1EFF00', '#32FF32', '#00FF32', '#4BFF4B', '#65FF65'],
  rare: ['#0070DD', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5'],
  epic: ['#A335EE', '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8'],
  legendary: ['#FF8000', '#FF9800', '#FFB74D', '#FFCC02', '#FFC107']
};

const BACKGROUND_GRADIENTS = {
  Forest: [['#228B22', '#32CD32'], ['#006400', '#90EE90'], ['#2E8B57', '#98FB98']],
  Desert: [['#FF8C00', '#FFD700'], ['#CD853F', '#F4A460'], ['#D2691E', '#DEB887']],
  Ocean: [['#006994', '#4682B4'], ['#1E90FF', '#87CEEB'], ['#0000CD', '#4169E1']],
  Mountain: [['#696969', '#A9A9A9'], ['#2F4F4F', '#708090'], ['#36454F', '#778899']],
  Cave: [['#2F2F2F', '#4A4A4A'], ['#1C1C1C', '#3A3A3A'], ['#0D0D0D', '#2B2B2B']],
  Castle: [['#800080', '#9370DB'], ['#4B0082', '#8A2BE2'], ['#6A0DAD', '#9932CC']],
  Temple: [['#B8860B', '#DAA520'], ['#FF8C00', '#FFA500'], ['#CD853F', '#D2B48C']],
  Volcano: [['#8B0000', '#FF4500'], ['#DC143C', '#FF6347'], ['#B22222', '#FA8072']],
  Tundra: [['#E0FFFF', '#F0F8FF'], ['#B0E0E6', '#E6E6FA'], ['#F5F5DC', '#FFFAFA']],
  Swamp: [['#556B2F', '#6B8E23'], ['#808000', '#9ACD32'], ['#2E8B57', '#3CB371']]
};

export const generateMockInventory = (count: number = 25): Equipment[] => {
  const items: Equipment[] = [];
  const slots = Object.keys(SLOT_NAMES) as Array<keyof typeof SLOT_NAMES>;
  const rarities = Object.keys(RARITY_MODIFIERS) as Array<keyof typeof RARITY_MODIFIERS>;
  
  for (let i = 0; i < count; i++) {
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const modifier = RARITY_MODIFIERS[rarity][Math.floor(Math.random() * RARITY_MODIFIERS[rarity].length)];
    const baseName = SLOT_NAMES[slot][Math.floor(Math.random() * SLOT_NAMES[slot].length)];
    const color = RARITY_COLORS[rarity][Math.floor(Math.random() * RARITY_COLORS[rarity].length)];
    
    const item: Equipment = {
      id: i + 1000, // Start from 1000 to avoid conflicts with database IDs
      name: `${modifier} ${baseName}`,
      slot,
      rarity,
      spriteData: {
        color,
        glow: rarity === 'epic' || rarity === 'legendary'
      }
    };
    
    // Add special background data for background items
    if (slot === 'background') {
      const sceneName = baseName as keyof typeof BACKGROUND_GRADIENTS;
      const gradients = BACKGROUND_GRADIENTS[sceneName] || BACKGROUND_GRADIENTS.Forest;
      const selectedGradient = gradients[Math.floor(Math.random() * gradients.length)];
      
      item.spriteData = {
        ...item.spriteData,
        backgroundType: 'gradient',
        backgroundData: {
          colors: selectedGradient
        }
      };
    }
    
    items.push(item);
  }
  
  return items;
};

export const generateStarterEquipment = (): { [key: string]: Equipment } => {
  return {
    head: {
      id: 999001,
      name: 'Starter Cap',
      slot: 'head',
      rarity: 'common',
      spriteData: { color: '#8B4513' }
    },
    chest: {
      id: 999002,
      name: 'Basic Tunic',
      slot: 'chest',
      rarity: 'common',
      spriteData: { color: '#A0522D' }
    },
    legs: {
      id: 999003,
      name: 'Simple Pants',
      slot: 'legs',
      rarity: 'common',
      spriteData: { color: '#4169E1' }
    },
    weapon: {
      id: 999004,
      name: 'Wooden Stick',
      slot: 'weapon',
      rarity: 'common',
      spriteData: { color: '#8B4513' }
    },
    accessory: {
      id: 999005,
      name: 'Plain Ring',
      slot: 'accessory',
      rarity: 'common',
      spriteData: { color: '#C0C0C0' }
    },
    background: {
      id: 999006,
      name: 'Basic Forest',
      slot: 'background',
      rarity: 'common',
      spriteData: {
        color: '#228B22',
        backgroundType: 'gradient',
        backgroundData: {
          colors: ['#228B22', '#32CD32']
        }
      }
    }
  };
};

export const generateRandomLoot = (minRarity: keyof typeof RARITY_MODIFIERS = 'common', maxRarity: keyof typeof RARITY_MODIFIERS = 'legendary'): Equipment => {
  const slots = Object.keys(SLOT_NAMES) as Array<keyof typeof SLOT_NAMES>;
  const rarities = Object.keys(RARITY_MODIFIERS) as Array<keyof typeof RARITY_MODIFIERS>;
  
  const minIndex = rarities.indexOf(minRarity);
  const maxIndex = rarities.indexOf(maxRarity);
  const validRarities = rarities.slice(minIndex, maxIndex + 1);
  
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const rarity = validRarities[Math.floor(Math.random() * validRarities.length)];
  const modifier = RARITY_MODIFIERS[rarity][Math.floor(Math.random() * RARITY_MODIFIERS[rarity].length)];
  const baseName = SLOT_NAMES[slot][Math.floor(Math.random() * SLOT_NAMES[slot].length)];
  const color = RARITY_COLORS[rarity][Math.floor(Math.random() * RARITY_COLORS[rarity].length)];
  
  const item: Equipment = {
    id: Date.now() + Math.floor(Math.random() * 1000), // Unique ID
    name: `${modifier} ${baseName}`,
    slot,
    rarity,
    spriteData: {
      color,
      glow: rarity === 'epic' || rarity === 'legendary'
    }
  };
  
  // Add special background data for background items
  if (slot === 'background') {
    const sceneName = baseName as keyof typeof BACKGROUND_GRADIENTS;
    const gradients = BACKGROUND_GRADIENTS[sceneName] || BACKGROUND_GRADIENTS.Forest;
    const selectedGradient = gradients[Math.floor(Math.random() * gradients.length)];
    
    item.spriteData = {
      ...item.spriteData,
      backgroundType: 'gradient',
      backgroundData: {
        colors: selectedGradient
      }
    };
  }
  
  return item;
};

// Utility function to get rarity distribution weights
export const getRarityWeights = () => {
  return {
    common: 50,      // 50% chance
    uncommon: 25,    // 25% chance  
    rare: 15,        // 15% chance
    epic: 7,         // 7% chance
    legendary: 3     // 3% chance
  };
};

// Generate weighted random loot based on level
export const generateLevelBasedLoot = (playerLevel: number): Equipment => {
  const weights = getRarityWeights();
  
  // Increase rare+ chances based on level
  if (playerLevel >= 10) {
    weights.rare += 5;
    weights.epic += 2;
    weights.legendary += 1;
    weights.common -= 8;
  }
  
  if (playerLevel >= 25) {
    weights.epic += 5;
    weights.legendary += 3;
    weights.uncommon -= 5;
    weights.common -= 3;
  }
  
  if (playerLevel >= 50) {
    weights.legendary += 5;
    weights.epic += 5;
    weights.rare -= 5;
    weights.uncommon -= 5;
  }
  
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [rarity, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return generateRandomLoot(rarity as keyof typeof RARITY_MODIFIERS, rarity as keyof typeof RARITY_MODIFIERS);
    }
  }
  
  return generateRandomLoot('common', 'common');
};

// Export types for use elsewhere
export type { Equipment };