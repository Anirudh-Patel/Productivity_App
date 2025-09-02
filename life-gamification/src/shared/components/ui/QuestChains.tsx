import { useState } from 'react';
import { Play, Lock, CheckCircle, BookOpen, Users, Crown } from 'lucide-react';
import { QuestChain, QuestTemplate } from '../../../types';
import { questChains, chainQuestTemplates, getAvailableChains, generateChainQuestData } from '../../../data/questChains';
import { useGameStore } from '../../../store/gameStore';
import { useTheme } from '../../../contexts/ThemeContext';
import { FadeIn, StaggeredList } from './AnimatedComponents';
import { useRenderPerformance } from '../../../utils/performance';

interface QuestChainsProps {
  userLevel: number;
  onStartChainQuest: (questData: any) => void;
}

export const QuestChains = ({ userLevel, onStartChainQuest }: QuestChainsProps) => {
  useRenderPerformance('QuestChains', process.env.NODE_ENV === 'development');
  
  const { currentTheme } = useTheme();
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const availableChains = getAvailableChains(userLevel);
  const lockedChains = Object.values(questChains).filter(
    chain => chain.unlock_requirements?.level && userLevel < chain.unlock_requirements.level
  );

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'solo-leveling': return '⚔️';
      case 'attack-on-titan': return '🛡️';
      case 'one-piece': return '🏴‍☠️';
      case 'demon-slayer': return '🗡️';
      default: return '📜';
    }
  };

  const getChainStatusColor = (chain: QuestChain) => {
    if (chain.is_completed) return 'text-green-400';
    if (chain.completed_quests > 0) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const handleStartChain = (chain: QuestChain) => {
    const templates = chainQuestTemplates[chain.id];
    if (!templates || templates.length === 0) return;

    const firstQuest = templates[0];
    const questData = generateChainQuestData(firstQuest, chain.id, 0);
    onStartChainQuest(questData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-theme-accent" />
        <div>
          <h2 className="text-xl font-bold">Quest Chains</h2>
          <p className="text-sm text-gray-400">Epic storylines with connected quests</p>
        </div>
      </div>

      {/* Available Chains */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Play className="w-4 h-4" />
          Available Chains ({availableChains.length})
        </h3>
        
        <StaggeredList delay={100}>
          {availableChains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              isSelected={selectedChain === chain.id}
              onSelect={() => setSelectedChain(selectedChain === chain.id ? null : chain.id)}
              onStart={() => handleStartChain(chain)}
              themeIcon={getThemeIcon(chain.theme)}
              statusColor={getChainStatusColor(chain)}
              isLocked={false}
            />
          ))}
        </StaggeredList>
      </div>

      {/* Locked Chains */}
      {lockedChains.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-gray-500">
            <Lock className="w-4 h-4" />
            Locked Chains ({lockedChains.length})
          </h3>
          
          <StaggeredList delay={100}>
            {lockedChains.map((chain) => (
              <ChainCard
                key={chain.id}
                chain={chain}
                isSelected={false}
                onSelect={() => {}}
                onStart={() => {}}
                themeIcon={getThemeIcon(chain.theme)}
                statusColor="text-gray-600"
                isLocked={true}
              />
            ))}
          </StaggeredList>
        </div>
      )}

      {/* Chain Details Modal */}
      {selectedChain && (
        <ChainDetailsModal
          chain={questChains[selectedChain]}
          templates={chainQuestTemplates[selectedChain] || []}
          onClose={() => setSelectedChain(null)}
          onStart={() => handleStartChain(questChains[selectedChain])}
        />
      )}
    </div>
  );
};

interface ChainCardProps {
  chain: QuestChain;
  isSelected: boolean;
  onSelect: () => void;
  onStart: () => void;
  themeIcon: string;
  statusColor: string;
  isLocked: boolean;
}

const ChainCard = ({ 
  chain, 
  isSelected, 
  onSelect, 
  onStart, 
  themeIcon, 
  statusColor,
  isLocked 
}: ChainCardProps) => {
  const progressPercent = (chain.completed_quests / chain.total_quests) * 100;
  
  return (
    <div className={`bg-theme-primary rounded-lg border transition-all cursor-pointer ${
      isSelected 
        ? 'border-theme-accent bg-theme-accent/5' 
        : 'border-gray-800 hover:border-gray-700'
    } ${isLocked ? 'opacity-50' : ''}`}>
      <div className="p-4" onClick={onSelect}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">{themeIcon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">{chain.title}</h3>
              {chain.is_completed && <CheckCircle className="w-4 h-4 text-green-400" />}
              {isLocked && <Lock className="w-4 h-4 text-gray-600" />}
            </div>
            <p className="text-sm text-gray-400 mb-3">{chain.description}</p>
            
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{chain.completed_quests} / {chain.total_quests} quests</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-theme-accent h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs">
                <span className={`${statusColor} font-medium`}>
                  {chain.is_completed ? 'Completed' : 
                   chain.completed_quests > 0 ? 'In Progress' : 'Not Started'}
                </span>
                {isLocked && (
                  <span className="text-gray-600">
                    Unlock at Level {chain.unlock_requirements?.level}
                  </span>
                )}
              </div>
              
              {!isLocked && !chain.is_completed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart();
                  }}
                  className="px-3 py-1 bg-theme-accent/20 text-theme-accent rounded text-xs font-medium hover:bg-theme-accent/30 transition-colors"
                >
                  {chain.completed_quests === 0 ? 'Start Chain' : 'Continue'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Expanded Details */}
      {isSelected && !isLocked && (
        <div className="border-t border-gray-700 p-4 bg-theme-bg/50">
          <div className="text-sm text-gray-300 italic mb-3">
            "{chain.story_text}"
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Quest Progression:</h4>
            <div className="space-y-1">
              {chainQuestTemplates[chain.id]?.map((template, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                    index < chain.completed_quests ? 'bg-green-400 text-black' :
                    index === chain.completed_quests ? 'bg-theme-accent text-white' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={index < chain.completed_quests ? 'text-green-400' : 
                                   index === chain.completed_quests ? 'text-theme-accent' : 
                                   'text-gray-400'}>
                    {template.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ChainDetailsModalProps {
  chain: QuestChain;
  templates: QuestTemplate[];
  onClose: () => void;
  onStart: () => void;
}

const ChainDetailsModal = ({ chain, templates, onClose, onStart }: ChainDetailsModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-primary border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-theme-accent" />
              <h2 className="text-xl font-bold">{chain.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-theme-bg rounded-lg transition-colors"
            >
              ×
            </button>
          </div>
          
          <p className="text-gray-300 mb-4">{chain.description}</p>
          <p className="text-gray-400 italic mb-6">"{chain.story_text}"</p>
          
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold">Quest Chain Overview:</h3>
            {templates.map((template, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-theme-bg rounded-lg">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                  index < chain.completed_quests ? 'bg-green-400 text-black' :
                  index === chain.completed_quests ? 'bg-theme-accent text-white' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{template.name}</h4>
                  <p className="text-sm text-gray-400 mb-2">{template.description_template}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="bg-gray-800 px-2 py-1 rounded">
                      {template.category}
                    </span>
                    <span className="text-yellow-400">
                      Difficulty: {template.difficulty}/10
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            {!chain.is_completed && (
              <button
                onClick={() => {
                  onStart();
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent/80 transition-colors"
              >
                {chain.completed_quests === 0 ? 'Start Chain' : 'Continue Chain'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};