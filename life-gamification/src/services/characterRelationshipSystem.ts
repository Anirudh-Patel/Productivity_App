import { invoke } from '@tauri-apps/api/core';

export interface Character {
  id: string;
  name: string;
  title: string;
  avatar: string;
  description: string;
  personality: string[];
  archetype: 'mentor' | 'rival' | 'ally' | 'mysterious' | 'cheerful' | 'strict';
  unlockRequirement: {
    type: 'level' | 'achievement' | 'task_count' | 'consecutive_days';
    value: number | string;
  };
  maxAffinity: number;
  specialAbilities: string[];
  backgroundStory: string;
  voiceLines: {
    greeting: string[];
    encouragement: string[];
    achievement: string[];
    level_up: string[];
    disappointment: string[];
    farewell: string[];
  };
}

export interface CharacterRelationship {
  characterId: string;
  affinity: number; // 0-100
  relationship_level: number; // 1-10
  unlockedDialogue: string[];
  unlockedAbilities: string[];
  lastInteraction: Date;
  totalInteractions: number;
  gifts_given: number;
  tasks_completed_together: number;
  milestones_achieved: string[];
}

export interface DialogueOption {
  id: string;
  text: string;
  affinity_change: number;
  requirement?: {
    type: 'affinity' | 'level' | 'achievement';
    value: number | string;
  };
  unlocks?: string; // New dialogue or ability
}

export interface Dialogue {
  id: string;
  character_id: string;
  trigger: 'greeting' | 'task_complete' | 'level_up' | 'achievement' | 'daily_check' | 'special_event';
  affinity_required: number;
  text: string;
  character_response: string;
  options: DialogueOption[];
  one_time_only: boolean;
}

class CharacterRelationshipSystem {
  private characters: Map<string, Character> = new Map();
  private relationships: Map<string, CharacterRelationship> = new Map();
  private dialogues: Map<string, Dialogue[]> = new Map();

  constructor() {
    this.initializeCharacters();
    this.initializeDialogues();
  }

  private initializeCharacters() {
    const characters: Character[] = [
      {
        id: 'aria_mentor',
        name: 'Aria',
        title: 'The Productivity Sage',
        avatar: '👩‍🏫',
        description: 'A wise mentor who guides you on your journey to productivity mastery.',
        personality: ['wise', 'patient', 'encouraging', 'insightful'],
        archetype: 'mentor',
        unlockRequirement: { type: 'level', value: 1 },
        maxAffinity: 100,
        specialAbilities: ['bonus_xp_mentor', 'productivity_insights', 'task_suggestions'],
        backgroundStory: 'Once a struggling student herself, Aria discovered the secrets of productivity through years of dedication. Now she shares her wisdom with aspiring productivity hunters.',
        voiceLines: {
          greeting: [
            'Welcome back, young hunter. Ready to grow stronger today?',
            'I sense great potential in you. Let\'s see how far you\'ve come.',
            'Another day, another opportunity to exceed your limits.'
          ],
          encouragement: [
            'Every small step forward is progress worth celebrating.',
            'Trust in your abilities. You\'re capable of more than you know.',
            'Remember, consistency beats perfection every time.'
          ],
          achievement: [
            'Magnificent! Your dedication is truly inspiring.',
            'I knew you had it in you. This achievement is well-deserved.',
            'Your growth reminds me why I chose to be a mentor.'
          ],
          level_up: [
            'Your power grows stronger! I\'m proud of your progress.',
            'Another level achieved through hard work and determination.',
            'Feel the surge of new abilities flowing through you!'
          ],
          disappointment: [
            'Even the strongest hunters have setbacks. What matters is getting back up.',
            'I believe in your potential. Don\'t let this discourage you.',
            'Every failure is a lesson in disguise. Learn and grow stronger.'
          ],
          farewell: [
            'Until we meet again, keep pushing forward.',
            'Remember what you\'ve learned today.',
            'Your journey continues even when I\'m not here.'
          ]
        }
      },
      {
        id: 'kai_rival',
        name: 'Kai',
        title: 'The Competitive Spirit',
        avatar: '🔥',
        description: 'A fierce rival who challenges you to constantly improve and never settle.',
        personality: ['competitive', 'ambitious', 'direct', 'motivating'],
        archetype: 'rival',
        unlockRequirement: { type: 'level', value: 5 },
        maxAffinity: 100,
        specialAbilities: ['challenge_mode', 'competitive_multipliers', 'rivalry_bonuses'],
        backgroundStory: 'Kai rose through the ranks faster than anyone expected. They believe that true strength comes from competition and pushing your limits.',
        voiceLines: {
          greeting: [
            'Think you can keep up with me today?',
            'I hope you\'re ready to be challenged.',
            'Let\'s see if you\'ve gotten any stronger since yesterday.'
          ],
          encouragement: [
            'Not bad, but I know you can do better than that.',
            'You\'re getting stronger, but don\'t get cocky.',
            'Keep pushing. I won\'t go easy on you.'
          ],
          achievement: [
            'Impressive! You might actually be worthy competition.',
            'Finally! I was wondering when you\'d step up your game.',
            'Good work. Now try to keep that momentum going.'
          ],
          level_up: [
            'About time! I was starting to lap you.',
            'Not bad, but I\'m still ahead. Try to catch up!',
            'Getting stronger, I see. This rivalry is getting interesting.'
          ],
          disappointment: [
            'That\'s not the hunter I know you can be.',
            'Come on, where\'s that fighting spirit?',
            'I expected better from my rival. Don\'t disappoint me again.'
          ],
          farewell: [
            'Don\'t slack off while I\'m gone.',
            'Keep training. I\'ll be watching your progress.',
            'See you tomorrow. Try to surprise me.'
          ]
        }
      },
      {
        id: 'luna_cheerful',
        name: 'Luna',
        title: 'The Enthusiastic Supporter',
        avatar: '🌟',
        description: 'An eternally optimistic companion who celebrates every victory with you.',
        personality: ['cheerful', 'supportive', 'energetic', 'loyal'],
        archetype: 'cheerful',
        unlockRequirement: { type: 'consecutive_days', value: 7 },
        maxAffinity: 100,
        specialAbilities: ['mood_boost', 'celebration_bonuses', 'positive_energy'],
        backgroundStory: 'Luna believes that productivity should be fun and rewarding. Her infectious enthusiasm has helped countless hunters stay motivated.',
        voiceLines: {
          greeting: [
            'Yay! You\'re back! I missed you so much!',
            'Hello sunshine! Ready to make today amazing?',
            'Another day with my favorite productivity hunter!'
          ],
          encouragement: [
            'You\'re doing great! Keep up the fantastic work!',
            'I believe in you 100%! You\'ve got this!',
            'Every step forward is something to celebrate!'
          ],
          achievement: [
            'OMG! This is so exciting! You did it!',
            'I\'m so proud of you! Let\'s celebrate!',
            'You\'re absolutely amazing! This calls for a party!'
          ],
          level_up: [
            'LEVEL UP! This is the best day ever!',
            'Wow wow wow! You\'re getting so strong!',
            'I can feel your power growing! So exciting!'
          ],
          disappointment: [
            'Hey, it\'s okay! Tomorrow is a new day full of possibilities!',
            'Don\'t worry! I know you\'ll bounce back stronger than ever!',
            'Everyone has tough days. I\'m here to support you!'
          ],
          farewell: [
            'See you soon! I\'ll be cheering for you!',
            'Bye bye! Dream of all the amazing things you\'ll do tomorrow!',
            'Can\'t wait to hear about your adventures!'
          ]
        }
      },
      {
        id: 'shadow_mysterious',
        name: 'Shadow',
        title: 'The Enigmatic Guide',
        avatar: '🌙',
        description: 'A mysterious figure who appears when you least expect it, offering cryptic but valuable advice.',
        personality: ['mysterious', 'wise', 'cryptic', 'perceptive'],
        archetype: 'mysterious',
        unlockRequirement: { type: 'achievement', value: 'night_owl' },
        maxAffinity: 100,
        specialAbilities: ['hidden_bonuses', 'secret_quests', 'mystery_rewards'],
        backgroundStory: 'Little is known about Shadow\'s past. They appear at crucial moments to offer guidance that seems nonsensical at first, but proves invaluable later.',
        voiceLines: {
          greeting: [
            'We meet again in the space between moments...',
            'The threads of productivity weave an interesting pattern around you.',
            'Time flows differently for those who truly understand their path.'
          ],
          encouragement: [
            'The answer you seek lies not in the destination, but in the journey.',
            'Power comes not from rushing, but from understanding.',
            'Every shadow cast by progress reveals new light.'
          ],
          achievement: [
            'You have glimpsed the true nature of accomplishment.',
            'This achievement opens doors you cannot yet see.',
            'Well done. The path ahead becomes clearer.'
          ],
          level_up: [
            'Another layer of understanding unfolds before you.',
            'Growth is not always visible to those who experience it.',
            'Your transformation continues in ways beyond measure.'
          ],
          disappointment: [
            'Sometimes we must walk backward to find the correct path forward.',
            'This setback is but a shadow cast by future success.',
            'In every ending lies the seed of a new beginning.'
          ],
          farewell: [
            'I exist in the spaces between your thoughts.',
            'Until the next crossroads calls...',
            'Remember: the greatest strength is knowing when to be still.'
          ]
        }
      }
    ];

    characters.forEach(char => this.characters.set(char.id, char));
  }

  private initializeDialogues() {
    // Sample dialogues for each character
    const dialogues: Dialogue[] = [
      {
        id: 'aria_first_meeting',
        character_id: 'aria_mentor',
        trigger: 'greeting',
        affinity_required: 0,
        text: 'Welcome, new hunter. I\'m Aria, and I\'ll be guiding you on your productivity journey.',
        character_response: 'I see great potential in you. Are you ready to begin?',
        options: [
          { id: 'eager', text: 'I\'m ready to learn everything!', affinity_change: 5 },
          { id: 'cautious', text: 'I\'ll do my best.', affinity_change: 2 },
          { id: 'confident', text: 'I don\'t need much guidance.', affinity_change: -1 }
        ],
        one_time_only: true
      },
      {
        id: 'kai_challenge',
        character_id: 'kai_rival',
        trigger: 'greeting',
        affinity_required: 0,
        text: 'So you\'re the new hunter everyone\'s talking about?',
        character_response: 'We\'ll see if you can keep up with me.',
        options: [
          { id: 'accept', text: 'Bring it on!', affinity_change: 5 },
          { id: 'polite', text: 'I look forward to learning from you.', affinity_change: 1 },
          { id: 'dismiss', text: 'I\'m not interested in competition.', affinity_change: -3 }
        ],
        one_time_only: true
      }
    ];

    // Group dialogues by character
    dialogues.forEach(dialogue => {
      if (!this.dialogues.has(dialogue.character_id)) {
        this.dialogues.set(dialogue.character_id, []);
      }
      this.dialogues.get(dialogue.character_id)!.push(dialogue);
    });
  }

  // Check if character should be unlocked
  async checkCharacterUnlocks(userId: number): Promise<string[]> {
    const newlyUnlocked: string[] = [];
    
    for (const [charId, character] of this.characters) {
      if (this.relationships.has(charId)) continue; // Already unlocked
      
      const shouldUnlock = await this.checkUnlockRequirement(character.unlockRequirement, userId);
      if (shouldUnlock) {
        await this.unlockCharacter(charId, userId);
        newlyUnlocked.push(charId);
      }
    }
    
    return newlyUnlocked;
  }

  private async checkUnlockRequirement(requirement: Character['unlockRequirement'], userId: number): Promise<boolean> {
    try {
      switch (requirement.type) {
        case 'level':
          const user = await invoke('get_user') as any;
          return user.level >= requirement.value;
          
        case 'achievement':
          const achievements = await invoke('get_user_achievements') as any[];
          return achievements.some(a => a.achievement.id === requirement.value);
          
        case 'task_count':
          const tasks = await invoke('get_tasks') as any[];
          const completed = tasks.filter(t => t.status === 'completed');
          return completed.length >= requirement.value;
          
        case 'consecutive_days':
          // Would need to implement consecutive days tracking
          return true; // Simplified for now
          
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // Unlock a character
  async unlockCharacter(characterId: string, userId: number): Promise<void> {
    const relationship: CharacterRelationship = {
      characterId,
      affinity: 0,
      relationship_level: 1,
      unlockedDialogue: [],
      unlockedAbilities: [],
      lastInteraction: new Date(),
      totalInteractions: 0,
      gifts_given: 0,
      tasks_completed_together: 0,
      milestones_achieved: []
    };
    
    this.relationships.set(characterId, relationship);
    
    // You could save this to the database here
    console.log(`Character ${characterId} unlocked!`);
  }

  // Improve relationship with character
  async improveRelationship(characterId: string, points: number, reason: string = 'interaction'): Promise<void> {
    const relationship = this.relationships.get(characterId);
    if (!relationship) return;
    
    const oldAffinity = relationship.affinity;
    relationship.affinity = Math.min(100, relationship.affinity + points);
    relationship.lastInteraction = new Date();
    relationship.totalInteractions++;
    
    // Check for relationship level increases
    const newLevel = Math.floor(relationship.affinity / 10) + 1;
    if (newLevel > relationship.relationship_level) {
      relationship.relationship_level = newLevel;
      await this.unlockRelationshipRewards(characterId, newLevel);
    }
    
    // Check for milestone unlocks
    await this.checkAffinityMilestones(characterId, oldAffinity, relationship.affinity);
    
    console.log(`Relationship with ${characterId} improved by ${points} (${reason})`);
  }

  private async unlockRelationshipRewards(characterId: string, level: number): Promise<void> {
    const character = this.characters.get(characterId);
    const relationship = this.relationships.get(characterId);
    if (!character || !relationship) return;
    
    // Unlock new dialogue at certain levels
    const dialogueThresholds = [3, 5, 7, 10];
    if (dialogueThresholds.includes(level)) {
      // Add new dialogue options
      relationship.unlockedDialogue.push(`level_${level}_dialogue`);
    }
    
    // Unlock special abilities
    if (level >= 5 && !relationship.unlockedAbilities.includes('special_ability_1')) {
      relationship.unlockedAbilities.push('special_ability_1');
    }
    
    if (level >= 8 && !relationship.unlockedAbilities.includes('special_ability_2')) {
      relationship.unlockedAbilities.push('special_ability_2');
    }
    
    console.log(`${character.name} reached relationship level ${level}!`);
  }

  private async checkAffinityMilestones(characterId: string, oldAffinity: number, newAffinity: number): Promise<void> {
    const milestones = [25, 50, 75, 100];
    const relationship = this.relationships.get(characterId);
    if (!relationship) return;
    
    for (const milestone of milestones) {
      if (oldAffinity < milestone && newAffinity >= milestone) {
        const milestoneKey = `affinity_${milestone}`;
        if (!relationship.milestones_achieved.includes(milestoneKey)) {
          relationship.milestones_achieved.push(milestoneKey);
          await this.grantMilestoneReward(characterId, milestone);
        }
      }
    }
  }

  private async grantMilestoneReward(characterId: string, milestone: number): Promise<void> {
    const character = this.characters.get(characterId);
    if (!character) return;
    
    // Grant rewards based on character and milestone
    const rewards = {
      25: { type: 'dialogue', value: 'personal_story_1' },
      50: { type: 'ability', value: 'companion_bonus' },
      75: { type: 'dialogue', value: 'deep_conversation' },
      100: { type: 'special_quest', value: 'character_quest_finale' }
    };
    
    const reward = rewards[milestone as keyof typeof rewards];
    if (reward) {
      console.log(`Milestone reward for ${character.name}: ${reward.type} - ${reward.value}`);
    }
  }

  // Get character's dialogue for a specific trigger
  getCharacterDialogue(characterId: string, trigger: Dialogue['trigger']): Dialogue | null {
    const relationship = this.relationships.get(characterId);
    const dialogues = this.dialogues.get(characterId) || [];
    
    if (!relationship) return null;
    
    // Find appropriate dialogue based on trigger and affinity
    const availableDialogues = dialogues.filter(d => 
      d.trigger === trigger && 
      relationship.affinity >= d.affinity_required &&
      (!d.one_time_only || !relationship.unlockedDialogue.includes(d.id))
    );
    
    if (availableDialogues.length === 0) return null;
    
    // Return random dialogue from available options
    return availableDialogues[Math.floor(Math.random() * availableDialogues.length)];
  }

  // Handle dialogue selection
  async selectDialogueOption(characterId: string, dialogueId: string, optionId: string): Promise<void> {
    const dialogue = this.dialogues.get(characterId)?.find(d => d.id === dialogueId);
    const option = dialogue?.options.find(o => o.id === optionId);
    
    if (!dialogue || !option) return;
    
    // Apply affinity change
    await this.improveRelationship(characterId, option.affinity_change, 'dialogue_choice');
    
    // Mark dialogue as used if one-time only
    if (dialogue.one_time_only) {
      const relationship = this.relationships.get(characterId);
      if (relationship) {
        relationship.unlockedDialogue.push(dialogue.id);
      }
    }
    
    // Unlock new content if specified
    if (option.unlocks) {
      const relationship = this.relationships.get(characterId);
      if (relationship && !relationship.unlockedDialogue.includes(option.unlocks)) {
        relationship.unlockedDialogue.push(option.unlocks);
      }
    }
  }

  // Give gift to character
  async giveGift(characterId: string, giftType: 'common' | 'rare' | 'epic'): Promise<void> {
    const relationship = this.relationships.get(characterId);
    if (!relationship) return;
    
    const affinityGain = { common: 2, rare: 5, epic: 10 }[giftType];
    relationship.gifts_given++;
    
    await this.improveRelationship(characterId, affinityGain, `gift_${giftType}`);
  }

  // Get all unlocked characters
  getUnlockedCharacters(): (Character & { relationship: CharacterRelationship })[] {
    return Array.from(this.relationships.entries()).map(([charId, relationship]) => ({
      ...this.characters.get(charId)!,
      relationship
    }));
  }

  // Get character by ID
  getCharacter(characterId: string): Character | undefined {
    return this.characters.get(characterId);
  }

  // Get relationship by character ID
  getRelationship(characterId: string): CharacterRelationship | undefined {
    return this.relationships.get(characterId);
  }

  // Trigger character reactions to events
  async triggerCharacterReactions(event: 'task_complete' | 'level_up' | 'achievement' | 'daily_check', data?: any): Promise<void> {
    const unlockedCharacters = this.getUnlockedCharacters();
    
    for (const character of unlockedCharacters) {
      const dialogue = this.getCharacterDialogue(character.id, event);
      if (dialogue) {
        // You could show this dialogue in the UI
        console.log(`${character.name}: ${dialogue.character_response}`);
        
        // Auto-improve relationship for positive events
        if (['task_complete', 'level_up', 'achievement'].includes(event)) {
          await this.improveRelationship(character.id, 1, event);
        }
      }
    }
  }
}

// Export singleton instance
export const characterRelationshipSystem = new CharacterRelationshipSystem();

// Convenience functions
export const unlockCharacters = (userId: number) => 
  characterRelationshipSystem.checkCharacterUnlocks(userId);

export const improveRelationship = (characterId: string, points: number, reason?: string) =>
  characterRelationshipSystem.improveRelationship(characterId, points, reason);

export const getCharacterDialogue = (characterId: string, trigger: Dialogue['trigger']) =>
  characterRelationshipSystem.getCharacterDialogue(characterId, trigger);

export const triggerReactions = (event: 'task_complete' | 'level_up' | 'achievement' | 'daily_check', data?: any) =>
  characterRelationshipSystem.triggerCharacterReactions(event, data);