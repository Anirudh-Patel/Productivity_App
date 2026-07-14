import { useEffect, useMemo, useState } from 'react';
import { useAvatarStore } from '../../store/slices/avatarSlice';
import { AvatarCanvas } from '../../features/avatar/components/AvatarCanvas/AvatarCanvas';
import {
  useCharacterSkinStore,
  GEAR_SLOTS,
  GEAR_SLOT_LABELS,
  type CharacterSkin,
  type GearSlot,
} from '../../store/characterSkinStore';
import { LayeredSprite } from '../../shared/components/ui/LayeredSprite';
import { Trash2, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

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

const RARITY_COLORS = {
  common: '#808080',
  uncommon: '#1EFF00',
  rare: '#0070DD',
  epic: '#A335EE',
  legendary: '#FF8000',
};

const RARITY_NAMES = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

const SLOT_NAMES = {
  head: 'Helmet',
  chest: 'Armor',
  legs: 'Leggings',
  weapon: 'Weapon',
  accessory: 'Accessory',
  background: 'Background',
};

const Equipment = () => {
  const { equipped, inventory, equipItem, unequipItem, loadUserEquipment } = useAvatarStore();
  const {
    skins,
    gear,
    selectedId,
    equippedGear,
    loadManifest,
    selectSkin,
    equipGear,
    unequipAllGear,
  } = useCharacterSkinStore();
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Currently selected skin, resolved to an object.
  const selectedSkin = selectedId ? skins.find((s) => s.id === selectedId) ?? null : null;

  // Equipped gear resolved to objects (live-updates as gear is toggled).
  const equippedGearItems = useMemo(
    () => gear.filter((g) => equippedGear[g.slot] === g.id),
    [gear, equippedGear],
  );

  // Group skins by series to keep the (57-entry) grid navigable.
  const skinsBySeries = useMemo(() => {
    const groups = new Map<string, CharacterSkin[]>();
    for (const skin of skins) {
      const list = groups.get(skin.series);
      if (list) list.push(skin);
      else groups.set(skin.series, [skin]);
    }
    return Array.from(groups.entries());
  }, [skins]);

  // Group gear by slot (only slots that actually have items are rendered).
  const gearBySlot = useMemo(() => {
    return GEAR_SLOTS.map((slot) => ({
      slot,
      items: gear.filter((g) => g.slot === slot),
    })).filter((group) => group.items.length > 0);
  }, [gear]);

  const hasEquippedGear = Object.keys(equippedGear).length > 0;

  const handleToggleGear = (slot: GearSlot, id: string) => {
    // Clicking the equipped item unequips it; otherwise equip (replacing the slot).
    equipGear(slot, equippedGear[slot] === id ? null : id);
  };

  useEffect(() => {
    // Force load equipment to ensure avatar renders with placeholders
    loadUserEquipment(1);
  }, [loadUserEquipment]);

  useEffect(() => {
    // Load the character skin manifest (tolerates a missing manifest gracefully).
    loadManifest();
  }, [loadManifest]);

  const handleEquipItem = async (item: Equipment) => {
    try {
      await equipItem(item);
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to equip item:', error);
    }
  };

  const handleUnequipItem = async (slot: string) => {
    try {
      await unequipItem(slot);
    } catch (error) {
      console.error('Failed to unequip item:', error);
    }
  };

  const EquipmentSlot = ({ slot, item }: { slot: string; item: Equipment | null }) => (
    <div className="relative">
      <div className={`w-20 h-20 border-2 rounded-lg flex items-center justify-center ${
        item 
          ? `border-${item.rarity} bg-gradient-to-br from-theme-primary to-theme-bg`
          : 'border-gray-600 bg-theme-bg'
      }`}>
        {item ? (
          <div 
            className="w-4 h-4 rounded-full cursor-pointer"
            style={{ backgroundColor: RARITY_COLORS[item.rarity] }}
            onClick={() => setSelectedItem(item)}
          />
        ) : (
          <div className="text-gray-500 text-xs text-center">
            {SLOT_NAMES[slot as keyof typeof SLOT_NAMES]}
          </div>
        )}
      </div>
      
      {item && (
        <button
          onClick={() => handleUnequipItem(slot)}
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

  // Slot symbols for the circular indicators
  const SLOT_SYMBOLS = {
    head: '⚔️', // Helmet symbol
    chest: '🛡️', // Shield symbol  
    legs: '👖', // Pants symbol
    weapon: '⚡', // Lightning/weapon symbol
    accessory: '💎', // Gem symbol
    background: '🎨', // Art symbol
  };

  const InventoryItem = ({ item }: { item: Equipment }) => (
    <div 
      className={`relative p-3 border-2 rounded-lg cursor-pointer hover:scale-105 transition-all bg-theme-bg hover:brightness-110 w-32 h-32 ${
        selectedItem?.id === item.id ? 'brightness-125' : ''
      }`}
      style={{ 
        borderColor: RARITY_COLORS[item.rarity],
        boxShadow: selectedItem?.id === item.id ? `0 0 10px ${RARITY_COLORS[item.rarity]}40` : 'none'
      }}
      onClick={() => setSelectedItem(item)}
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
    <div className="flex flex-col gap-6 p-6 max-w-7xl">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-solo-accent to-solo-secondary bg-clip-text text-transparent">
          Equipment Management
        </h1>
      </div>

      <div className="flex gap-6" style={{ width: '1024px' }}>
        {/* Avatar Preview */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <div className="bg-theme-primary rounded-xl p-6 border border-gray-800 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-semibold">Character Preview</h2>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Full Screen Preview"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center flex-1">
              <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center w-fit h-full p-0.5">
                <div className="rounded flex items-center justify-center w-full h-full p-6" style={{
                  background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)'
                }}>
                  <div key={`avatar-${equipped.head?.id || 'none'}-${equipped.chest?.id || 'none'}`}>
                    <AvatarCanvas width={100} height={120} zoom={1.8} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Slots */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <div className="bg-theme-primary rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-8 text-center">Equipped Items</h2>
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
        </div>

        {/* Item Details & Actions */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <div className="bg-theme-primary rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Item Details</h2>
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
                  <h3 className="text-lg font-semibold text-gray-200">{selectedItem.name}</h3>
                  <p className="text-sm" style={{ color: RARITY_COLORS[selectedItem.rarity] }}>
                    {RARITY_NAMES[selectedItem.rarity]}
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
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-theme-primary rounded-xl p-6 border border-gray-800" style={{ width: '1024px' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Inventory</h2>
          <button
            onClick={() => loadUserEquipment(1)}
            className="flex items-center gap-2 px-3 py-2 bg-theme-bg hover:bg-theme-secondary rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        
        {inventory.length > 0 ? (
          <div className="grid grid-cols-6 gap-2">
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

      {/* Character Skin & Gear customization — hidden when the manifest is absent/empty */}
      {skins.length > 0 && (
        <div className="flex gap-6" style={{ width: '1024px' }}>
          {/* Live layered preview: current skin + equipped gear (~6x scale) */}
          <div style={{ width: '320px', flexShrink: 0 }}>
            <div className="bg-theme-primary rounded-xl p-6 border border-gray-800 h-full flex flex-col">
              <h2 className="text-xl font-semibold mb-6 text-center">Skin Preview</h2>
              <div className="flex-1 flex items-center justify-center">
                {selectedSkin ? (
                  <div className="rounded-lg border-2 border-solo-accent/30 p-4 flex items-center justify-center" style={{
                    background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)'
                  }}>
                    <LayeredSprite skin={selectedSkin} gear={equippedGearItems} scale={6} />
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    Select a character skin to preview
                  </div>
                )}
              </div>
              {selectedSkin && (
                <div className="text-center mt-4">
                  <div className="text-sm font-semibold text-gray-200">{selectedSkin.displayName}</div>
                  <div className="text-xs text-gray-400">{selectedSkin.series}</div>
                </div>
              )}
            </div>
          </div>

          {/* Skin + Gear pickers */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            {/* Character Skin Picker — grouped by series */}
            <div className="bg-theme-primary rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Character Skin</h2>
                {selectedId && (
                  <button
                    onClick={() => selectSkin(null)}
                    className="flex items-center gap-2 px-3 py-2 bg-theme-bg hover:bg-theme-secondary rounded-lg transition-colors text-sm"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-5 max-h-[520px] overflow-y-auto pr-1">
                {skinsBySeries.map(([series, seriesSkins]) => (
                  <div key={series}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      {series}
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                      {seriesSkins.map((skin) => {
                        const isSelected = skin.id === selectedId;
                        return (
                          <button
                            key={skin.id}
                            type="button"
                            onClick={() => selectSkin(skin.id)}
                            aria-pressed={isSelected}
                            title={`${skin.displayName} — ${skin.series}`}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 bg-theme-bg transition-all hover:brightness-110 ${
                              isSelected
                                ? 'border-solo-accent ring-2 ring-solo-accent/60 shadow-lg shadow-solo-accent/20'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <img
                              src={skin.file}
                              alt={skin.displayName}
                              width={skin.width * 3}
                              height={skin.height * 3}
                              style={{ imageRendering: 'pixelated' }}
                              className="pointer-events-none"
                            />
                            <div className="text-center leading-tight">
                              <div className="text-xs font-semibold text-gray-200 truncate max-w-[6rem]">
                                {skin.displayName}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gear Picker — grouped by slot. Hidden when manifest has no gear section. */}
            {gearBySlot.length > 0 && (
              <div className="bg-theme-primary rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Gear</h2>
                  {hasEquippedGear && (
                    <button
                      onClick={unequipAllGear}
                      className="flex items-center gap-2 px-3 py-2 bg-theme-bg hover:bg-theme-secondary rounded-lg transition-colors text-sm"
                    >
                      Unequip all
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-5">
                  {gearBySlot.map(({ slot, items }) => (
                    <div key={slot}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                        {GEAR_SLOT_LABELS[slot]}
                      </h3>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                        {items.map((item) => {
                          const isEquipped = equippedGear[slot] === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleToggleGear(slot, item.id)}
                              aria-pressed={isEquipped}
                              title={item.displayName}
                              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 bg-theme-bg transition-all hover:brightness-110 ${
                                isEquipped
                                  ? 'border-solo-accent ring-2 ring-solo-accent/60 shadow-lg shadow-solo-accent/20'
                                  : 'border-gray-700 hover:border-gray-500'
                              }`}
                            >
                              <img
                                src={item.file}
                                alt={item.displayName}
                                width={item.width * 3}
                                height={item.height * 3}
                                style={{ imageRendering: 'pixelated' }}
                                className="pointer-events-none"
                              />
                              <div className="text-center leading-tight">
                                <div className="text-xs font-semibold text-gray-200 truncate max-w-[6rem]">
                                  {item.displayName}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Screen Modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setIsExpanded(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-theme-primary rounded-xl p-8 border border-gray-800 max-w-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-200">Full Screen Character Preview</h2>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center p-1">
                <div className="rounded flex items-center justify-center" style={{
                  background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)',
                  width: '384px',
                  height: '480px'
                }}>
                  <div key={`avatar-full-${equipped.head?.id || 'none'}-${equipped.chest?.id || 'none'}`}>
                    <AvatarCanvas width={300} height={360} zoom={3} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setIsExpanded(false)}
                className="px-6 py-3 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-solo-accent/25 transition-all"
              >
                Close Full Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Equipment;