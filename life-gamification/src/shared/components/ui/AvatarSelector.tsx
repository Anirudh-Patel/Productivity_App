import { useState } from 'react';
import { User, Camera, Shuffle } from 'lucide-react';
import { useRenderPerformance } from '../../../utils/performance';
import { FadeIn } from './AnimatedComponents';

export interface Avatar {
  id: string;
  name: string;
  image: string;
  theme: string;
  unlockLevel: number;
}

// Placeholder avatars - in real app these would be actual images
const avatars: Avatar[] = [
  { id: 'hunter-1', name: 'Shadow Hunter', image: '🗡️', theme: 'solo-leveling', unlockLevel: 1 },
  { id: 'hunter-2', name: 'Ice Monarch', image: '❄️', theme: 'solo-leveling', unlockLevel: 10 },
  { id: 'hunter-3', name: 'Dragon Slayer', image: '🐉', theme: 'solo-leveling', unlockLevel: 25 },
  
  { id: 'soldier-1', name: 'Scout Regiment', image: '⚔️', theme: 'attack-on-titan', unlockLevel: 1 },
  { id: 'soldier-2', name: 'Titan Shifter', image: '⚡', theme: 'attack-on-titan', unlockLevel: 15 },
  { id: 'soldier-3', name: 'Commander', image: '👑', theme: 'attack-on-titan', unlockLevel: 30 },
  
  { id: 'pirate-1', name: 'Rookie Pirate', image: '🏴‍☠️', theme: 'one-piece', unlockLevel: 1 },
  { id: 'pirate-2', name: 'Devil Fruit User', image: '🍎', theme: 'one-piece', unlockLevel: 12 },
  { id: 'pirate-3', name: 'Pirate King', image: '👒', theme: 'one-piece', unlockLevel: 50 },
  
  { id: 'slayer-1', name: 'Water Breathing', image: '🌊', theme: 'demon-slayer', unlockLevel: 1 },
  { id: 'slayer-2', name: 'Thunder Breathing', image: '⚡', theme: 'demon-slayer', unlockLevel: 18 },
  { id: 'slayer-3', name: 'Hashira', image: '🔥', theme: 'demon-slayer', unlockLevel: 40 },
];

interface AvatarSelectorProps {
  currentTheme: string;
  userLevel: number;
  selectedAvatar?: string;
  onAvatarSelect: (avatarId: string) => void;
}

export const AvatarSelector = ({ 
  currentTheme, 
  userLevel, 
  selectedAvatar, 
  onAvatarSelect 
}: AvatarSelectorProps) => {
  useRenderPerformance('AvatarSelector', process.env.NODE_ENV === 'development');
  
  const [viewMode, setViewMode] = useState<'theme' | 'all'>('theme');
  
  const filteredAvatars = viewMode === 'theme' 
    ? avatars.filter(avatar => avatar.theme === currentTheme)
    : avatars;
  
  const availableAvatars = filteredAvatars.filter(avatar => avatar.unlockLevel <= userLevel);
  const lockedAvatars = filteredAvatars.filter(avatar => avatar.unlockLevel > userLevel);

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('theme')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'theme'
              ? 'bg-solo-accent/20 text-solo-accent border border-solo-accent/30'
              : 'bg-solo-primary text-gray-400 hover:text-solo-text border border-gray-800'
          }`}
        >
          Current Theme
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'all'
              ? 'bg-solo-accent/20 text-solo-accent border border-solo-accent/30'
              : 'bg-solo-primary text-gray-400 hover:text-solo-text border border-gray-800'
          }`}
        >
          All Avatars
        </button>
      </div>

      {/* Available Avatars */}
      {availableAvatars.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Available ({availableAvatars.length})
          </h4>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {availableAvatars.map((avatar, index) => (
              <FadeIn key={avatar.id} delay={index * 50}>
                <button
                  onClick={() => onAvatarSelect(avatar.id)}
                  className={`aspect-square p-4 rounded-lg border transition-all hover:scale-105 ${
                    selectedAvatar === avatar.id
                      ? 'border-solo-accent/50 bg-solo-accent/20'
                      : 'border-gray-700 hover:border-gray-600 bg-solo-bg'
                  }`}
                  title={avatar.name}
                >
                  <div className="text-2xl mb-1">{avatar.image}</div>
                  <div className="text-xs text-gray-400 truncate">{avatar.name}</div>
                </button>
              </FadeIn>
            ))}
          </div>
        </div>
      )}

      {/* Locked Avatars */}
      {lockedAvatars.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2 text-gray-500">
            <Camera className="w-4 h-4" />
            Locked ({lockedAvatars.length})
          </h4>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {lockedAvatars.map((avatar, index) => (
              <FadeIn key={avatar.id} delay={index * 50}>
                <div
                  className="aspect-square p-4 rounded-lg border border-gray-800 bg-gray-900/50 opacity-50"
                  title={`${avatar.name} - Unlock at level ${avatar.unlockLevel}`}
                >
                  <div className="text-2xl mb-1 filter grayscale">{avatar.image}</div>
                  <div className="text-xs text-gray-500 truncate">Lv.{avatar.unlockLevel}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      )}

      {/* Random Avatar Button */}
      <div className="flex justify-center">
        <button
          onClick={() => {
            const available = availableAvatars;
            if (available.length > 0) {
              const randomAvatar = available[Math.floor(Math.random() * available.length)];
              onAvatarSelect(randomAvatar.id);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-solo-secondary text-gray-300 rounded-lg hover:bg-solo-accent/20 hover:text-solo-accent transition-colors"
        >
          <Shuffle className="w-4 h-4" />
          Random Avatar
        </button>
      </div>
    </div>
  );
};