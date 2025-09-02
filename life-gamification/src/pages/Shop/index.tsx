import { useState } from 'react'
import { ShoppingBag, Coins, Heart, Zap, Star, Crown, Shield, Sparkles } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'
import { FadeIn, StaggeredList } from '../../shared/components/ui/AnimatedComponents'
import { useToast } from '../../shared/components/ui/Toast'

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  category: 'consumables' | 'cosmetics' | 'upgrades'
  icon: React.ReactNode
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  effect?: string
}

const shopItems: ShopItem[] = [
  // Consumables
  {
    id: 'health_potion_small',
    name: 'Minor Health Potion',
    description: 'Restores 25 health points',
    price: 50,
    category: 'consumables',
    icon: <Heart className="w-6 h-6" />,
    rarity: 'common',
    effect: 'Restore 25 HP'
  },
  {
    id: 'health_potion_large',
    name: 'Major Health Potion',
    description: 'Restores 100 health points',
    price: 150,
    category: 'consumables',
    icon: <Heart className="w-6 h-6" />,
    rarity: 'uncommon',
    effect: 'Restore 100 HP'
  },
  {
    id: 'xp_boost',
    name: 'XP Boost Elixir',
    description: '2x XP for the next 5 completed quests',
    price: 200,
    category: 'consumables',
    icon: <Zap className="w-6 h-6" />,
    rarity: 'rare',
    effect: '2x XP (5 quests)'
  },
  
  // Cosmetics
  {
    id: 'title_novice',
    name: 'Title: Quest Novice',
    description: 'Show your dedication to the quest system',
    price: 100,
    category: 'cosmetics',
    icon: <Star className="w-6 h-6" />,
    rarity: 'common',
    effect: 'Cosmetic Title'
  },
  {
    id: 'title_master',
    name: 'Title: Quest Master',
    description: 'For those who have mastered the art of questing',
    price: 500,
    category: 'cosmetics',
    icon: <Crown className="w-6 h-6" />,
    rarity: 'epic',
    effect: 'Cosmetic Title'
  },
  
  // Upgrades
  {
    id: 'inventory_expansion',
    name: 'Inventory Expansion',
    description: 'Increase your inventory slots by 10',
    price: 300,
    category: 'upgrades',
    icon: <Shield className="w-6 h-6" />,
    rarity: 'uncommon',
    effect: '+10 Inventory Slots'
  },
  {
    id: 'auto_sort',
    name: 'Auto-Sort Feature',
    description: 'Automatically organize your quest list',
    price: 400,
    category: 'upgrades',
    icon: <Sparkles className="w-6 h-6" />,
    rarity: 'rare',
    effect: 'Auto-organize quests'
  }
]

const rarityColors = {
  common: 'border-gray-600 bg-gray-900/50',
  uncommon: 'border-green-500 bg-green-900/20',
  rare: 'border-blue-500 bg-blue-900/20',
  epic: 'border-purple-500 bg-purple-900/20',
  legendary: 'border-orange-500 bg-orange-900/20'
}

const rarityTextColors = {
  common: 'text-gray-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400'
}

const Shop = () => {
  const { user } = useGameStore()
  const toast = useToast()
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'consumables' | 'cosmetics' | 'upgrades'>('all')
  
  const filteredItems = shopItems.filter(item => 
    selectedCategory === 'all' || item.category === selectedCategory
  )
  
  const handlePurchase = (item: ShopItem) => {
    if (!user) return
    
    if (user.gold < item.price) {
      toast.error('Not enough gold!')
      return
    }
    
    // TODO: Implement actual purchase logic when backend supports it
    toast.success(`Purchased ${item.name}! (Feature coming soon)`)
  }
  
  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Merchant's Shop</h1>
          <p className="text-gray-400">Spend your hard-earned gold on powerful items</p>
          <div className="flex items-center gap-2 mt-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="text-yellow-500 font-semibold">{user?.gold || 0} Gold</span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'consumables', label: 'Consumables' },
            { id: 'cosmetics', label: 'Cosmetics' },
            { id: 'upgrades', label: 'Upgrades' }
          ].map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id as any)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedCategory === category.id
                  ? 'bg-solo-accent border-solo-accent text-white'
                  : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Shop Items Grid */}
        <StaggeredList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border-2 ${rarityColors[item.rarity]} transition-all hover:scale-105`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-gray-800/50 ${rarityTextColors[item.rarity]}`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className={`text-xs capitalize ${rarityTextColors[item.rarity]}`}>
                      {item.rarity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Coins className="w-4 h-4" />
                  <span className="font-semibold">{item.price}</span>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm mb-2">{item.description}</p>
              
              {item.effect && (
                <p className="text-solo-accent text-sm mb-3">Effect: {item.effect}</p>
              )}
              
              <button
                onClick={() => handlePurchase(item)}
                disabled={!user || user.gold < item.price}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  !user || user.gold < item.price
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-solo-accent hover:bg-solo-accent/80 text-white'
                }`}
              >
                {!user || user.gold < item.price ? 'Not Enough Gold' : 'Purchase'}
              </button>
            </div>
          ))}
        </StaggeredList>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No items found in this category</p>
          </div>
        )}
      </div>
    </FadeIn>
  )
}

export default Shop