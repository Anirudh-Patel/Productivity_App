import { QuestChain, QuestTemplate } from '../types';

// Pre-defined quest chains with storylines
export const questChains: Record<string, QuestChain> = {
  'shadow-monarch': {
    id: 'shadow-monarch',
    title: 'Path of the Shadow Monarch',
    description: 'Follow in the footsteps of Sung Jin-Woo and rise from E-rank to become the Shadow Monarch',
    theme: 'solo-leveling',
    total_quests: 5,
    completed_quests: 0,
    is_completed: false,
    story_text: 'You start as the weakest of all hunters, but fate has different plans...',
    unlock_requirements: {
      level: 1
    }
  },
  'survey-corps': {
    id: 'survey-corps',
    title: 'Survey Corps Training',
    description: 'Train to become a member of the elite Survey Corps and defend humanity',
    theme: 'attack-on-titan',
    total_quests: 4,
    completed_quests: 0,
    is_completed: false,
    story_text: 'The walls have been breached. Humanity needs brave soldiers to venture beyond...',
    unlock_requirements: {
      level: 5
    }
  },
  'pirate-king': {
    id: 'pirate-king',
    title: 'Journey to Pirate King',
    description: 'Set sail on the Grand Line and chase your dreams to become the Pirate King',
    theme: 'one-piece',
    total_quests: 6,
    completed_quests: 0,
    is_completed: false,
    story_text: 'The age of pirates has begun. Will you find the legendary treasure One Piece?',
    unlock_requirements: {
      level: 10
    }
  },
  'demon-slayer': {
    id: 'demon-slayer',
    title: 'Demon Slayer Corps',
    description: 'Master breathing techniques and join the Demon Slayer Corps to protect humanity',
    theme: 'demon-slayer',
    total_quests: 4,
    completed_quests: 0,
    is_completed: false,
    story_text: 'Demons lurk in the darkness. Only those with strong will can master the breath...',
    unlock_requirements: {
      level: 8
    }
  },
  'hero-academia': {
    id: 'hero-academia',
    title: 'My Hero Academia: Plus Ultra!',
    description: 'Train to become the #1 Hero and master your unique quirk',
    theme: 'my-hero-academia',
    total_quests: 5,
    completed_quests: 0,
    is_completed: false,
    story_text: 'Everyone has a quirk... except you thought you didn\'t. Time to go Plus Ultra!',
    unlock_requirements: {
      level: 6
    }
  },
  'jujutsu-sorcerer': {
    id: 'jujutsu-sorcerer',
    title: 'Jujutsu Sorcerer Path',
    description: 'Master cursed energy and become a Grade 1 Jujutsu Sorcerer',
    theme: 'jujutsu-kaisen',
    total_quests: 4,
    completed_quests: 0,
    is_completed: false,
    story_text: 'Cursed energy flows through negative emotions. Turn your struggles into strength.',
    unlock_requirements: {
      level: 12
    }
  },
  'ninja-way': {
    id: 'ninja-way',
    title: 'The Way of the Ninja',
    description: 'Follow the ninja way and become Hokage through perseverance and bonds',
    theme: 'naruto',
    total_quests: 6,
    completed_quests: 0,
    is_completed: false,
    story_text: 'Believe it! The path of a ninja is never easy, but with determination, anything is possible.',
    unlock_requirements: {
      level: 7
    }
  },
  'cyber-runner': {
    id: 'cyber-runner',
    title: 'Cyberpunk: Digital Nomad',
    description: 'Navigate the digital landscape and become a legendary cyber-runner',
    theme: 'cyberpunk',
    total_quests: 5,
    completed_quests: 0,
    is_completed: false,
    story_text: 'In Night City, data is power. Master technology to control your destiny.',
    unlock_requirements: {
      level: 15
    }
  },
  'space-explorer': {
    id: 'space-explorer',
    title: 'Stellar Odyssey',
    description: 'Explore the cosmos and build your interstellar legacy',
    theme: 'space-opera',
    total_quests: 7,
    completed_quests: 0,
    is_completed: false,
    story_text: 'The universe is vast and full of possibilities. Chart your course among the stars.',
    unlock_requirements: {
      level: 20
    }
  }
};

// Quest templates for each chain
export const chainQuestTemplates: Record<string, QuestTemplate[]> = {
  'shadow-monarch': [
    {
      id: 'sm-1',
      name: 'First Steps',
      category: 'health',
      difficulty: 2,
      title_template: 'Begin Your Training (Day 1)',
      description_template: 'Even the Shadow Monarch started with basic training. Complete a simple workout to begin your journey.',
      tags: ['beginner', 'health', 'training']
    },
    {
      id: 'sm-2',
      name: 'System Awakening',
      category: 'work',
      difficulty: 4,
      title_template: 'Complete Your Daily Quests',
      description_template: 'The System has awakened! Complete your most important work task to gain power.',
      tags: ['work', 'productivity', 'system']
    },
    {
      id: 'sm-3',
      name: 'Shadow Extraction',
      category: 'learning',
      difficulty: 5,
      title_template: 'Learn a New Skill',
      description_template: 'Extract knowledge like shadows. Learn something new to add to your arsenal.',
      tags: ['learning', 'skill', 'growth']
    },
    {
      id: 'sm-4',
      name: 'Arise, Shadow Army',
      category: 'social',
      difficulty: 6,
      title_template: 'Help Others Succeed',
      description_template: 'A true monarch leads by example. Help someone else achieve their goals.',
      tags: ['leadership', 'social', 'mentoring']
    },
    {
      id: 'sm-5',
      name: 'Shadow Monarch Ascension',
      category: 'personal',
      difficulty: 8,
      title_template: 'Overcome Your Greatest Challenge',
      description_template: 'Face the Sovereign of Destruction within yourself. Complete your most difficult personal goal.',
      tags: ['challenge', 'personal', 'mastery']
    }
  ],
  'survey-corps': [
    {
      id: 'sc-1',
      name: 'Cadet Training',
      category: 'health',
      difficulty: 3,
      title_template: 'Physical Conditioning',
      description_template: 'Train your body to survive beyond the walls. Complete an intense workout.',
      tags: ['health', 'training', 'endurance']
    },
    {
      id: 'sc-2',
      name: 'ODM Gear Mastery',
      category: 'work',
      difficulty: 5,
      title_template: 'Master Your Tools',
      description_template: 'Learn to use your tools efficiently. Complete a work task using new methods or tools.',
      tags: ['work', 'efficiency', 'tools']
    },
    {
      id: 'sc-3',
      name: 'First Expedition',
      category: 'learning',
      difficulty: 6,
      title_template: 'Venture Into Unknown Territory',
      description_template: 'Explore new knowledge like venturing beyond the walls. Learn about something completely unfamiliar.',
      tags: ['learning', 'exploration', 'courage']
    },
    {
      id: 'sc-4',
      name: 'Dedicate Your Heart',
      category: 'personal',
      difficulty: 7,
      title_template: 'Sacrifice for the Greater Good',
      description_template: 'True soldiers put others first. Complete a challenging personal goal that benefits others.',
      tags: ['sacrifice', 'service', 'dedication']
    }
  ],
  'pirate-king': [
    {
      id: 'pk-1',
      name: 'Set Sail',
      category: 'personal',
      difficulty: 2,
      title_template: 'Begin Your Adventure',
      description_template: 'Every pirate needs a dream. Define and start working towards a personal goal.',
      tags: ['adventure', 'dreams', 'beginning']
    },
    {
      id: 'pk-2',
      name: 'Gather Your Crew',
      category: 'social',
      difficulty: 4,
      title_template: 'Build Your Network',
      description_template: 'No pirate king sails alone. Connect with others who share your goals.',
      tags: ['social', 'networking', 'friendship']
    },
    {
      id: 'pk-3',
      name: 'Devil Fruit Power',
      category: 'learning',
      difficulty: 5,
      title_template: 'Develop Unique Skills',
      description_template: 'Gain powers like a Devil Fruit user. Master a skill that sets you apart.',
      tags: ['skills', 'uniqueness', 'mastery']
    },
    {
      id: 'pk-4',
      name: 'Grand Line Challenges',
      category: 'work',
      difficulty: 6,
      title_template: 'Navigate Dangerous Waters',
      description_template: 'The Grand Line tests all pirates. Overcome a major work challenge.',
      tags: ['work', 'challenge', 'navigation']
    },
    {
      id: 'pk-5',
      name: 'Conqueror\'s Haki',
      category: 'health',
      difficulty: 7,
      title_template: 'Unleash Your Inner Strength',
      description_template: 'Only the strongest possess Conqueror\'s Haki. Push your physical limits.',
      tags: ['health', 'strength', 'willpower']
    },
    {
      id: 'pk-6',
      name: 'One Piece Discovery',
      category: 'personal',
      difficulty: 9,
      title_template: 'Achieve Your Greatest Dream',
      description_template: 'Find your One Piece - the ultimate treasure. Complete your most ambitious goal.',
      tags: ['achievement', 'treasure', 'legacy']
    }
  ],
  'demon-slayer': [
    {
      id: 'ds-1',
      name: 'Breathing Basics',
      category: 'health',
      difficulty: 3,
      title_template: 'Master Your Breathing',
      description_template: 'Learn to control your breath like a Demon Slayer. Focus on mindfulness or meditation.',
      tags: ['breathing', 'mindfulness', 'control']
    },
    {
      id: 'ds-2',
      name: 'Blade Training',
      category: 'work',
      difficulty: 5,
      title_template: 'Sharpen Your Skills',
      description_template: 'A dull blade cannot cut demons. Improve your professional skills through practice.',
      tags: ['work', 'skills', 'precision']
    },
    {
      id: 'ds-3',
      name: 'Demon Encounter',
      category: 'personal',
      difficulty: 6,
      title_template: 'Face Your Inner Demons',
      description_template: 'Confront what holds you back. Overcome a personal fear or bad habit.',
      tags: ['personal', 'courage', 'growth']
    },
    {
      id: 'ds-4',
      name: 'Hashira Mastery',
      category: 'learning',
      difficulty: 8,
      title_template: 'Achieve Expert Level',
      description_template: 'Become a master like the Hashira. Reach expert level in a chosen skill.',
      tags: ['mastery', 'expertise', 'dedication']
    }
  ],
  'hero-academia': [
    {
      id: 'ha-1',
      name: 'Quirk Discovery',
      category: 'personal',
      difficulty: 3,
      title_template: 'Discover Your Hidden Potential',
      description_template: 'Every hero has a unique quirk. Identify and start developing a personal talent or skill.',
      tags: ['self-discovery', 'potential', 'uniqueness']
    },
    {
      id: 'ha-2',
      name: 'Hero Training',
      category: 'health',
      difficulty: 5,
      title_template: 'Plus Ultra Workout',
      description_template: 'Heroes must maintain peak physical condition. Go beyond your limits in training.',
      tags: ['health', 'training', 'plus-ultra']
    },
    {
      id: 'ha-3',
      name: 'Hero License Exam',
      category: 'work',
      difficulty: 6,
      title_template: 'Prove Your Professional Worth',
      description_template: 'Pass your professional "hero license exam" by excelling in a challenging work project.',
      tags: ['work', 'achievement', 'professionalism']
    },
    {
      id: 'ha-4',
      name: 'Save Someone',
      category: 'social',
      difficulty: 5,
      title_template: 'Be Someone\'s Hero',
      description_template: 'A true hero saves others. Help someone in need or support a friend through difficulty.',
      tags: ['heroism', 'helping', 'support']
    },
    {
      id: 'ha-5',
      name: 'Symbol of Peace',
      category: 'personal',
      difficulty: 8,
      title_template: 'Become a Symbol of Excellence',
      description_template: 'Be the symbol of peace in your field. Achieve a major personal milestone that inspires others.',
      tags: ['leadership', 'inspiration', 'excellence']
    }
  ],
  'jujutsu-sorcerer': [
    {
      id: 'js-1',
      name: 'Cursed Energy Control',
      category: 'learning',
      difficulty: 4,
      title_template: 'Master Your Inner Energy',
      description_template: 'Learn to control cursed energy by managing stress and negative emotions effectively.',
      tags: ['emotional-control', 'stress-management', 'mastery']
    },
    {
      id: 'js-2',
      name: 'Domain Expansion',
      category: 'work',
      difficulty: 7,
      title_template: 'Expand Your Domain',
      description_template: 'Create your own "domain" by taking ownership of a major work project or initiative.',
      tags: ['work', 'ownership', 'leadership']
    },
    {
      id: 'js-3',
      name: 'Exorcise Curses',
      category: 'personal',
      difficulty: 6,
      title_template: 'Eliminate Negative Patterns',
      description_template: 'Exorcise the "curses" in your life by breaking bad habits or toxic relationships.',
      tags: ['personal-growth', 'habits', 'cleansing']
    },
    {
      id: 'js-4',
      name: 'Grade 1 Promotion',
      category: 'learning',
      difficulty: 8,
      title_template: 'Achieve Master Level',
      description_template: 'Earn your Grade 1 status by achieving expert-level competency in your field.',
      tags: ['mastery', 'expertise', 'promotion']
    }
  ],
  'ninja-way': [
    {
      id: 'nw-1',
      name: 'Academy Training',
      category: 'learning',
      difficulty: 3,
      title_template: 'Master the Basics',
      description_template: 'Like at the Ninja Academy, master fundamental skills in your chosen field.',
      tags: ['fundamentals', 'learning', 'foundation']
    },
    {
      id: 'nw-2',
      name: 'Team Formation',
      category: 'social',
      difficulty: 4,
      title_template: 'Build Your Squad',
      description_template: 'Form your three-person team. Strengthen relationships with key colleagues or friends.',
      tags: ['teamwork', 'friendship', 'collaboration']
    },
    {
      id: 'nw-3',
      name: 'Chunin Exams',
      category: 'work',
      difficulty: 6,
      title_template: 'Pass the Big Test',
      description_template: 'Face your "Chunin Exams" by completing a major professional challenge or presentation.',
      tags: ['challenge', 'testing', 'advancement']
    },
    {
      id: 'nw-4',
      name: 'Protect Your Village',
      category: 'personal',
      difficulty: 5,
      title_template: 'Defend What Matters',
      description_template: 'Protect your "village" by standing up for your values or helping your community.',
      tags: ['protection', 'values', 'community']
    },
    {
      id: 'nw-5',
      name: 'Sage Mode',
      category: 'health',
      difficulty: 7,
      title_template: 'Achieve Perfect Balance',
      description_template: 'Master Sage Mode by achieving perfect work-life balance and inner harmony.',
      tags: ['balance', 'harmony', 'wellness']
    },
    {
      id: 'nw-6',
      name: 'Hokage Path',
      category: 'personal',
      difficulty: 9,
      title_template: 'Become the Leader',
      description_template: 'Follow the path to Hokage by taking on a major leadership role or responsibility.',
      tags: ['leadership', 'responsibility', 'legacy']
    }
  ],
  'cyber-runner': [
    {
      id: 'cr-1',
      name: 'Neural Interface',
      category: 'learning',
      difficulty: 4,
      title_template: 'Upgrade Your Mental Interface',
      description_template: 'Install cybernetic enhancements by learning new digital skills or technologies.',
      tags: ['technology', 'digital-skills', 'learning']
    },
    {
      id: 'cr-2',
      name: 'Data Heist',
      category: 'work',
      difficulty: 6,
      title_template: 'Execute the Perfect Job',
      description_template: 'Plan and execute a flawless "data heist" by completing a complex work project.',
      tags: ['planning', 'execution', 'complexity']
    },
    {
      id: 'cr-3',
      name: 'Corpo Infiltration',
      category: 'work',
      difficulty: 7,
      title_template: 'Navigate Corporate Networks',
      description_template: 'Infiltrate corporate systems by mastering office politics and networking.',
      tags: ['networking', 'politics', 'strategy']
    },
    {
      id: 'cr-4',
      name: 'Street Cred',
      category: 'social',
      difficulty: 5,
      title_template: 'Build Your Reputation',
      description_template: 'Earn street cred by establishing a strong professional or creative reputation.',
      tags: ['reputation', 'credibility', 'recognition']
    },
    {
      id: 'cr-5',
      name: 'Digital Immortality',
      category: 'personal',
      difficulty: 8,
      title_template: 'Create Your Digital Legacy',
      description_template: 'Achieve digital immortality by creating something that will outlast you.',
      tags: ['legacy', 'creativity', 'immortality']
    }
  ],
  'space-explorer': [
    {
      id: 'se-1',
      name: 'Space Academy',
      category: 'learning',
      difficulty: 3,
      title_template: 'Complete Astronaut Training',
      description_template: 'Begin your cosmic journey by learning fundamental skills for your chosen field.',
      tags: ['training', 'preparation', 'fundamentals']
    },
    {
      id: 'se-2',
      name: 'First Launch',
      category: 'personal',
      difficulty: 4,
      title_template: 'Launch Your Mission',
      description_template: 'Take off on your first space mission by starting a major personal project.',
      tags: ['launch', 'beginning', 'courage']
    },
    {
      id: 'se-3',
      name: 'Space Walk',
      category: 'work',
      difficulty: 6,
      title_template: 'Take a Professional Risk',
      description_template: 'Perform a spacewalk by taking on a challenging professional risk or opportunity.',
      tags: ['risk', 'challenge', 'growth']
    },
    {
      id: 'se-4',
      name: 'Alien Contact',
      category: 'social',
      difficulty: 5,
      title_template: 'Make Unusual Connections',
      description_template: 'Make first contact by networking with people outside your usual circles.',
      tags: ['networking', 'diversity', 'expansion']
    },
    {
      id: 'se-5',
      name: 'Mars Colony',
      category: 'work',
      difficulty: 7,
      title_template: 'Establish Your Base',
      description_template: 'Build your Mars colony by creating a sustainable business or career foundation.',
      tags: ['foundation', 'sustainability', 'building']
    },
    {
      id: 'se-6',
      name: 'Galaxy Mapping',
      category: 'learning',
      difficulty: 6,
      title_template: 'Chart Unknown Territory',
      description_template: 'Map new galaxies by exploring completely unfamiliar fields of knowledge.',
      tags: ['exploration', 'discovery', 'knowledge']
    },
    {
      id: 'se-7',
      name: 'Cosmic Legacy',
      category: 'personal',
      difficulty: 9,
      title_template: 'Achieve Cosmic Significance',
      description_template: 'Leave a mark on the universe by accomplishing something of lasting significance.',
      tags: ['legacy', 'significance', 'achievement']
    }
  ]
};

// Helper functions
export const getAvailableChains = (userLevel: number): QuestChain[] => {
  return Object.values(questChains).filter(
    chain => !chain.unlock_requirements?.level || userLevel >= chain.unlock_requirements.level
  );
};

export const getChainProgress = (chainId: string, _completedQuestIds: number[]): number => {
  const chain = questChains[chainId];
  if (!chain) return 0;
  
  // This would normally check against actual quest completion data
  // For now, return a mock progress
  return Math.min(chain.completed_quests / chain.total_quests * 100, 100);
};

export const getNextQuestInChain = (chainId: string, currentOrder: number): QuestTemplate | null => {
  const templates = chainQuestTemplates[chainId];
  if (!templates || currentOrder >= templates.length) return null;
  
  return templates[currentOrder];
};

export const generateChainQuestData = (template: QuestTemplate, chainId: string, order: number) => {
  return {
    title: template.title_template,
    description: template.description_template,
    category: template.category,
    difficulty: template.difficulty,
    task_type: 'standard' as const,
    chain_id: chainId,
    chain_order: order,
    priority: 5 // Chain quests get high priority
  };
};