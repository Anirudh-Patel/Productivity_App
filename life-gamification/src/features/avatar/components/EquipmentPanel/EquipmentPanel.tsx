import React, { useState } from 'react';
import { useAvatarStore } from '../../../../store/slices/avatarSlice';
import { Trash2 } from 'lucide-react';

const SLOT_NAMES = {
  head: 'Helmet',
  chest: 'Armor', 
  legs: 'Leggings',
  weapon: 'Weapon',
  accessory: 'Accessory',
  background: 'Background',
};

const RARITY_COLORS = {
  common: '#808080',
  uncommon: '#1EFF00',
  rare: '#0070DD',
  epic: '#A335EE',
  legendary: '#FF8000',
};

// Slot symbols for the circular indicators
const SLOT_SYMBOLS = {
  head: '⚔️', // Helmet symbol
  chest: '🛡️', // Shield symbol  
  legs: '👖', // Pants symbol
  weapon: '⚡', // Lightning/weapon symbol
  accessory: '💎', // Gem symbol
  background: '🎨', // Art symbol
};

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

export const EquipmentPanel: React.FC = () => {
  const { equipped, inventory, equipItem, unequipItem } = useAvatarStore();
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);

  const handleSlotClick = async (slot: string) => {
    if (equipped[slot as keyof typeof equipped]) {
      try {
        await unequipItem(slot);
      } catch (error) {
        console.error('Failed to unequip item:', error);
      }
    }
  };

  const handleInventoryItemClick = async (item: Equipment) => {
    try {
      setSelectedItem(item);
    } catch (error) {
      console.error('Failed to select item:', error);
    }
  };

  const handleEquipItem = async (item: Equipment) => {
    try {
      await equipItem(item);
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to equip item:', error);
    }
  };

  const EquipmentSlot = ({ slot, item }: { slot: string; item: Equipment | null }) => (
    <div className="relative">
      <div className={`w-20 h-20 border-2 rounded-lg flex items-center justify-center cursor-pointer hover:brightness-110 transition-all ${
        item 
          ? `bg-gradient-to-br from-theme-primary to-theme-bg`
          : 'border-gray-600 bg-theme-bg hover:border-gray-500'
      }`}
      style={item ? { borderColor: RARITY_COLORS[item.rarity] } : {}}
      onClick={() => handleSlotClick(slot)}>
        {item ? (
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: RARITY_COLORS[item.rarity] }}
          />
        ) : (
          <div className="text-gray-500 text-xs text-center">
            {SLOT_NAMES[slot as keyof typeof SLOT_NAMES]}
          </div>
        )}
      </div>
      
      {item && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSlotClick(slot);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
        >
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      )}
      
      <div className="text-center text-xs text-gray-400 mt-1 capitalize">
        {slot}
      </div>
    </div>
  );

  const InventoryItem = ({ item }: { item: Equipment }) => (
    <div 
      className={`relative p-3 border-2 rounded-lg cursor-pointer hover:scale-105 transition-all bg-theme-bg hover:brightness-110 w-32 h-32 ${
        selectedItem?.id === item.id ? 'brightness-125' : ''
      }`}
      style={{ 
        borderColor: RARITY_COLORS[item.rarity],
        boxShadow: selectedItem?.id === item.id ? `0 0 10px ${RARITY_COLORS[item.rarity]}40` : 'none'
      }}
      onClick={() => handleInventoryItemClick(item)}
    >
      {/* Slot symbol in top-right corner */}
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs border border-gray-500">
        {SLOT_SYMBOLS[item.slot as keyof typeof SLOT_SYMBOLS] || '?'}
      </div>
      
      {/* Equipment art area - centered */}
      <div className="flex items-center justify-center mb-2">
        <div 
          className="w-14 h-14 rounded-full"
          style={{ backgroundColor: RARITY_COLORS[item.rarity] }}
        />
      </div>
      
      {/* Item name pushed to bottom with small margin from edge */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <div className="text-sm font-semibold text-gray-200 leading-tight">{item.name}</div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-4">
      {/* Equipped Items */}
      <div className="bg-theme-primary rounded-xl p-6 border border-gray-800">
        <h3 className="text-xl font-semibold mb-4 text-center">Equipped Items</h3>
        <div className="grid grid-cols-3 gap-4 place-items-center">
          <div></div>
          <EquipmentSlot slot="head" item={equipped.head} />
          <div></div>
          
          <EquipmentSlot slot="weapon" item={equipped.weapon} />
          <EquipmentSlot slot="chest" item={equipped.chest} />
          <EquipmentSlot slot="accessory" item={equipped.accessory} />
          
          <div></div>
          <EquipmentSlot slot="legs" item={equipped.legs} />
          <div></div>
        </div>
      </div>

      {/* Item Details & Actions */}
      <div className="bg-theme-primary rounded-xl p-6 border border-gray-800 w-80">
        <h3 className="text-xl font-semibold mb-4">Item Details</h3>
        {selectedItem ? (
          <div className="space-y-4">
            <div 
              className="w-16 h-16 rounded-full mx-auto border-4"
              style={{ 
                backgroundColor: RARITY_COLORS[selectedItem.rarity],
                borderColor: RARITY_COLORS[selectedItem.rarity]
              }}
            />
            <div className="text-center">
              <h4 className="text-lg font-semibold text-gray-200">{selectedItem.name}</h4>
              <p className="text-sm capitalize" style={{ color: RARITY_COLORS[selectedItem.rarity] }}>
                {selectedItem.rarity}
              </p>
              <p className="text-sm text-gray-400 capitalize">{SLOT_NAMES[selectedItem.slot]}</p>
            </div>
            
            <button
              onClick={() => handleEquipItem(selectedItem)}
              className="w-full px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-solo-accent/25 transition-all"
            >
              Equip Item
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            Select an item to view details
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="bg-theme-primary rounded-xl p-6 border border-gray-800 flex-1">
        <h3 className="text-xl font-semibold mb-4">Inventory</h3>
        
        {inventory.length > 0 ? (
          <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {inventory.map((item) => (
              <InventoryItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            No items in inventory
          </div>
        )}
      </div>
    </div>
  );
};