import { invoke } from '@tauri-apps/api/core';

// Define reward types and rarities
export type RewardType = 'exp' | 'gold' | 'item' | 'manhwa_page' | 'character_skin' | 'secret_chapter' | 'title';
export type RewardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Reward {
  id: string;
  type: RewardType;
  rarity: RewardRarity;
  amount?: number;
  itemId?: string;
  name: string;
  description: string;
  icon?: string;
}

export interface LootTableEntry {
  id: string;
  weight: number;
  reward: Partial<Reward>;
}

class RewardSystem {
  private pityCounter: number = 0;
  private readonly PITY_THRESHOLD = 20;
  private rollHistory: RewardRarity[] = [];
  
  // Loot table with weights (out of 100)
  private lootTable: LootTableEntry[] = [
    { id: 'common_exp', weight: 40, reward: { type: 'exp', amount: 10, rarity: 'common', name: 'Experience Points', description: 'Basic XP reward' } },
    { id: 'common_gold', weight: 20, reward: { type: 'gold', amount: 5, rarity: 'common', name: 'Gold Coins', description: 'Currency for shop purchases' } },
    { id: 'uncommon_exp', weight: 15, reward: { type: 'exp', amount: 25, rarity: 'uncommon', name: 'Bonus Experience', description: 'Extra XP boost' } },
    { id: 'uncommon_gold', weight: 10, reward: { type: 'gold', amount: 15, rarity: 'uncommon', name: 'Gold Pouch', description: 'A handful of gold coins' } },
    { id: 'rare_page', weight: 8, reward: { type: 'manhwa_page', rarity: 'rare', name: 'Story Page', description: 'Unlock a new story chapter' } },
    { id: 'rare_item', weight: 4, reward: { type: 'item', rarity: 'rare', name: 'Rare Item', description: 'A valuable consumable' } },
    { id: 'epic_skin', weight: 2, reward: { type: 'character_skin', rarity: 'epic', name: 'Character Skin', description: 'New avatar appearance' } },
    { id: 'legendary_chapter', weight: 1, reward: { type: 'secret_chapter', rarity: 'legendary', name: 'Secret Chapter', description: 'Hidden story content' } }
  ];

  // Dynamic loot table that adjusts based on user level and performance
  private getDynamicLootTable(userLevel: number, performance: number = 1.0): LootTableEntry[] {
    return this.lootTable.map(entry => {
      let adjustedWeight = entry.weight;
      
      // Increase rare+ reward chances at higher levels
      if (userLevel > 10 && ['rare', 'epic', 'legendary'].includes(entry.reward.rarity || '')) {
        adjustedWeight *= 1 + (userLevel / 100); // Up to 2x at level 100
      }
      
      // Performance multiplier (0.5 to 1.5)
      adjustedWeight *= performance;
      
      return { ...entry, weight: adjustedWeight };
    });
  }

  // Roll for a reward with variable probability
  rollReward(userLevel: number = 1, performance: number = 1.0): Reward {
    const lootTable = this.getDynamicLootTable(userLevel, performance);
    const totalWeight = lootTable.reduce((sum, item) => sum + item.weight, 0);
    const roll = Math.random() * totalWeight;
    
    let accumulated = 0;
    for (const item of lootTable) {
      accumulated += item.weight;
      if (roll <= accumulated) {
        return this.generateReward(item.reward);
      }
    }
    
    // Fallback to common reward
    return this.generateReward(lootTable[0].reward);
  }

  // Roll with pity system to ensure rare rewards after dry streaks
  rollWithPity(userLevel: number = 1, performance: number = 1.0): Reward {
    this.pityCounter++;
    
    // Guaranteed rare+ reward at pity threshold
    if (this.pityCounter >= this.PITY_THRESHOLD) {
      this.pityCounter = 0;
      return this.generateRareReward();
    }
    
    const reward = this.rollReward(userLevel, performance);
    
    // Reset pity counter on rare+ rewards
    if (['epic', 'legendary'].includes(reward.rarity)) {
      this.pityCounter = 0;
    } else if (reward.rarity === 'rare') {
      // Partial pity reset for rare rewards
      this.pityCounter = Math.floor(this.pityCounter / 2);
    }
    
    // Track roll history for analytics
    this.rollHistory.push(reward.rarity);
    if (this.rollHistory.length > 100) {
      this.rollHistory.shift();
    }
    
    return reward;
  }

  // Generate a complete reward from partial data
  private generateReward(partial: Partial<Reward>): Reward {
    const baseReward: Reward = {
      id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: partial.type || 'exp',
      rarity: partial.rarity || 'common',
      name: partial.name || 'Mystery Reward',
      description: partial.description || 'A mysterious reward awaits...',
      ...partial
    };

    // Add dynamic amounts based on rarity
    if (!baseReward.amount && (baseReward.type === 'exp' || baseReward.type === 'gold')) {
      const rarityMultipliers = {
        common: 1,
        uncommon: 2.5,
        rare: 5,
        epic: 10,
        legendary: 25
      };
      
      const baseAmount = baseReward.type === 'exp' ? 10 : 5;
      baseReward.amount = Math.floor(baseAmount * rarityMultipliers[baseReward.rarity]);
    }

    // Add icons based on type
    if (!baseReward.icon) {
      const typeIcons = {
        exp: '⭐',
        gold: '🪙',
        item: '📦',
        manhwa_page: '📖',
        character_skin: '👤',
        secret_chapter: '🔮',
        title: '👑'
      };
      baseReward.icon = typeIcons[baseReward.type] || '🎁';
    }

    return baseReward;
  }

  // Generate a guaranteed rare or better reward
  private generateRareReward(): Reward {
    const rareAndAbove = this.lootTable.filter(item => 
      ['rare', 'epic', 'legendary'].includes(item.reward.rarity || '')
    );
    
    const totalWeight = rareAndAbove.reduce((sum, item) => sum + item.weight, 0);
    const roll = Math.random() * totalWeight;
    
    let accumulated = 0;
    for (const item of rareAndAbove) {
      accumulated += item.weight;
      if (roll <= accumulated) {
        return this.generateReward(item.reward);
      }
    }
    
    // Fallback to first rare reward
    return this.generateReward(rareAndAbove[0].reward);
  }

  // Get statistics about recent rolls
  getStatistics() {
    const stats = {
      totalRolls: this.rollHistory.length,
      currentPity: this.pityCounter,
      untilPity: this.PITY_THRESHOLD - this.pityCounter,
      distribution: {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0
      }
    };

    for (const rarity of this.rollHistory) {
      stats.distribution[rarity]++;
    }

    return stats;
  }

  // Apply reward to user (integrate with backend)
  async applyReward(reward: Reward, userId: number): Promise<void> {
    try {
      switch (reward.type) {
        case 'exp':
          await invoke('add_experience', { userId, amount: reward.amount });
          break;
        case 'gold':
          await invoke('add_gold', { userId, amount: reward.amount });
          break;
        case 'item':
          await invoke('add_item_to_inventory', { userId, itemId: reward.itemId });
          break;
        case 'manhwa_page':
        case 'character_skin':
        case 'secret_chapter':
          // These would unlock content in the app
          await invoke('unlock_content', { userId, contentType: reward.type, contentId: reward.id });
          break;
        case 'title':
          await invoke('unlock_title', { userId, titleId: reward.id });
          break;
      }
    } catch (error) {
      console.error('Failed to apply reward:', error);
      throw error;
    }
  }

  // Batch reward rolling for multiple completions
  rollMultipleRewards(count: number, userLevel: number = 1, performance: number = 1.0): Reward[] {
    const rewards: Reward[] = [];
    for (let i = 0; i < count; i++) {
      rewards.push(this.rollWithPity(userLevel, performance));
    }
    return rewards;
  }

  // Special event multipliers
  applyEventMultiplier(eventType: 'weekend' | 'holiday' | 'special', lootTable = this.lootTable): LootTableEntry[] {
    const multipliers = {
      weekend: 1.5,    // 50% better chances on weekends
      holiday: 2.0,    // Double chances on holidays
      special: 3.0     // Triple chances for special events
    };

    const multiplier = multipliers[eventType];
    
    return lootTable.map(entry => {
      // Only boost rare+ rewards during events
      if (['rare', 'epic', 'legendary'].includes(entry.reward.rarity || '')) {
        return { ...entry, weight: entry.weight * multiplier };
      }
      return entry;
    });
  }

  // Reset pity counter (for testing or special cases)
  resetPity(): void {
    this.pityCounter = 0;
  }

  // Get next guaranteed rare drop info
  getNextGuaranteedInfo(): { rollsUntilGuaranteed: number; currentPity: number } {
    return {
      rollsUntilGuaranteed: this.PITY_THRESHOLD - this.pityCounter,
      currentPity: this.pityCounter
    };
  }
}

// Export singleton instance
export const rewardSystem = new RewardSystem();

// Export convenience functions
export const rollReward = (userLevel?: number, performance?: number) => 
  rewardSystem.rollWithPity(userLevel, performance);

export const getRewardStats = () => rewardSystem.getStatistics();

export const applyReward = (reward: Reward, userId: number) => 
  rewardSystem.applyReward(reward, userId);

export const getGuaranteedInfo = () => rewardSystem.getNextGuaranteedInfo();