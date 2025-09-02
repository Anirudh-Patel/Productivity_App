import { useState } from 'react';
import { Zap, RefreshCw, Wand2 } from 'lucide-react';
import { QuestTemplate } from '../../../types';
import { quickQuestCategories, generateQuestFromTemplate, getRandomTemplate } from '../../../data/questTemplates';
import { autoAdjustTaskDifficulty, analyzeUserPerformance } from '../../../utils/difficultyAdjustment';
import { FadeIn, StaggeredList } from './AnimatedComponents';
import { useRenderPerformance } from '../../../utils/performance';

interface QuickCreateQuestProps {
  userLevel: number;
  completedTasks: any[];
  onCreateQuest: (questData: any) => void;
}

export const QuickCreateQuest = ({ userLevel, completedTasks, onCreateQuest }: QuickCreateQuestProps) => {
  useRenderPerformance('QuickCreateQuest', process.env.NODE_ENV === 'development');
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<QuestTemplate | null>(null);
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({});
  const [generatedQuest, setGeneratedQuest] = useState<{ title: string; description: string } | null>(null);

  const handleCategorySelect = (categoryId: string) => {
    const category = quickQuestCategories.find(c => c.id === categoryId);
    if (!category) return;
    
    const template = category.templates[Math.floor(Math.random() * category.templates.length)];
    setSelectedTemplate(template);
    setSelectedCategory(categoryId);
    
    // Generate initial quest with random variables
    const quest = generateQuestFromTemplate(template);
    setGeneratedQuest(quest);
    setCustomVariables({});
  };

  const handleRegenerateQuest = () => {
    if (!selectedTemplate) return;
    
    const quest = generateQuestFromTemplate(selectedTemplate, customVariables);
    setGeneratedQuest(quest);
  };

  const handleRandomQuest = () => {
    const template = getRandomTemplate();
    setSelectedTemplate(template);
    setSelectedCategory(null);
    
    const quest = generateQuestFromTemplate(template);
    setGeneratedQuest(quest);
    setCustomVariables({});
  };

  const handleCreateQuest = () => {
    if (!selectedTemplate || !generatedQuest) return;

    // Analyze user performance for difficulty adjustment
    const userStats = analyzeUserPerformance(
      {} as any, // Would pass real user data
      completedTasks,
      []
    );

    // Auto-adjust difficulty based on performance
    const { adjustedDifficulty, adjustmentReason } = autoAdjustTaskDifficulty(
      selectedTemplate.difficulty,
      selectedTemplate.category,
      userStats,
      userLevel
    );

    const questData = {
      title: generatedQuest.title,
      description: generatedQuest.description,
      category: selectedTemplate.category,
      difficulty: adjustedDifficulty,
      task_type: 'standard',
      priority: 5
    };

    onCreateQuest(questData);
    
    // Reset state
    setSelectedTemplate(null);
    setSelectedCategory(null);
    setGeneratedQuest(null);
    setCustomVariables({});
  };

  return (
    <div className="space-y-6">
      {!selectedTemplate ? (
        <>
          {/* Quick Categories */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Quick Create
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StaggeredList delay={50}>
                {quickQuestCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className="p-4 bg-theme-primary border border-gray-800 rounded-lg hover:border-gray-600 transition-all hover:scale-105 text-center"
                  >
                    <div className="text-2xl mb-2">{category.icon}</div>
                    <div className="text-sm font-medium">{category.name}</div>
                  </button>
                ))}
              </StaggeredList>
            </div>
          </div>

          {/* Random Quest Generator */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-3">Or try something random</div>
            <button
              onClick={handleRandomQuest}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 mx-auto"
            >
              <Wand2 className="w-4 h-4" />
              Surprise Me!
            </button>
          </div>
        </>
      ) : (
        /* Quest Customization */
        <FadeIn>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Customize Your Quest</h3>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setSelectedCategory(null);
                  setGeneratedQuest(null);
                }}
                className="text-sm text-gray-400 hover:text-theme-fg"
              >
                Back to Categories
              </button>
            </div>

            {/* Generated Quest Preview */}
            {generatedQuest && (
              <div className="p-4 bg-theme-bg rounded-lg border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-theme-fg mb-2">{generatedQuest.title}</h4>
                    <p className="text-sm text-gray-400 mb-3">{generatedQuest.description}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="bg-gray-800 px-2 py-1 rounded">
                        {selectedTemplate.category}
                      </span>
                      <span className="text-yellow-400">
                        Difficulty: {selectedTemplate.difficulty}/10
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleRegenerateQuest}
                    className="p-2 text-gray-400 hover:text-theme-accent transition-colors"
                    title="Generate new variation"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Variable Customization */}
            {selectedTemplate.variables && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Customize Details:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(selectedTemplate.variables).map(([variable, options]) => (
                    <div key={variable}>
                      <label className="block text-xs text-gray-400 mb-1 capitalize">
                        {variable.replace('_', ' ')}
                      </label>
                      <select
                        value={customVariables[variable] || ''}
                        onChange={(e) => {
                          const newVariables = { ...customVariables, [variable]: e.target.value };
                          setCustomVariables(newVariables);
                          if (generatedQuest) {
                            const newQuest = generateQuestFromTemplate(selectedTemplate, newVariables);
                            setGeneratedQuest(newQuest);
                          }
                        }}
                        className="w-full px-3 py-2 bg-theme-primary border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent text-sm"
                      >
                        <option value="">Random</option>
                        {options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="flex gap-3">
              <button
                onClick={handleRegenerateQuest}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Another
              </button>
              <button
                onClick={handleCreateQuest}
                className="flex-1 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent/80 transition-colors"
              >
                Create Quest
              </button>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
};