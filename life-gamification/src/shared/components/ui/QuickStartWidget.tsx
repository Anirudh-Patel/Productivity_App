import { useState, useEffect } from 'react';
import { Plus, Zap, Target, Trophy, Clock, Sparkles, Wand2, Rocket } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import { useToast } from './Toast';
import { FadeIn } from './AnimatedComponents';

interface QuickStartTemplate {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  difficulty: number;
  estimatedTime: number;
  xpReward: number;
  description: string;
  gradient: string;
}

const QuickStartWidget = () => {
  const { createTask, user, getRecommendedDifficulty } = useGameStore();
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [templates, setTemplates] = useState<QuickStartTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<QuickStartTemplate | null>(null);

  // Quick task templates
  const quickTemplates: QuickStartTemplate[] = [
    {
      id: 'focus_work',
      name: 'Deep Focus Session',
      category: 'productivity',
      icon: Target,
      color: 'text-blue-400',
      gradient: 'from-blue-500 to-cyan-500',
      difficulty: 3,
      estimatedTime: 90,
      xpReward: 150,
      description: 'Concentrated work session with zero distractions'
    },
    {
      id: 'quick_win',
      name: 'Quick Victory',
      category: 'personal',
      icon: Zap,
      color: 'text-yellow-400',
      gradient: 'from-yellow-500 to-orange-500',
      difficulty: 1,
      estimatedTime: 15,
      xpReward: 50,
      description: 'Small task for instant momentum boost'
    },
    {
      id: 'skill_building',
      name: 'Skill Builder',
      category: 'learning',
      icon: Trophy,
      color: 'text-purple-400',
      gradient: 'from-purple-500 to-pink-500',
      difficulty: 4,
      estimatedTime: 60,
      xpReward: 200,
      description: 'Level up your abilities with focused practice'
    },
    {
      id: 'wellness',
      name: 'Wellness Break',
      category: 'health',
      icon: Sparkles,
      color: 'text-green-400',
      gradient: 'from-green-500 to-teal-500',
      difficulty: 2,
      estimatedTime: 30,
      xpReward: 80,
      description: 'Restore energy and maintain balance'
    }
  ];

  useEffect(() => {
    // Add some randomization and personalization to templates
    const personalizedTemplates = quickTemplates.map(template => ({
      ...template,
      xpReward: Math.floor(template.xpReward * (1 + Math.random() * 0.3)) // ±30% variation
    }));
    setTemplates(personalizedTemplates);
  }, [user]);

  const handleQuickCreate = async (template: QuickStartTemplate) => {
    if (isCreating) return;
    
    setIsCreating(true);
    setSelectedTemplate(template);

    try {
      const recommendedDiff = await getRecommendedDifficulty(template.category);
      const finalDifficulty = Math.max(1, Math.min(5, recommendedDiff || template.difficulty));

      await createTask({
        title: template.name,
        description: template.description,
        category: template.category,
        difficulty: finalDifficulty,
        base_experience_reward: template.xpReward,
        estimated_time: template.estimatedTime,
        task_type: 'simple' as const,
        priority: 'medium' as const
      });

      toast.success(
        'Quest Created! 🚀',
        `"${template.name}" has been added to your active quests`,
        3000
      );

      // Add a small delay for visual feedback
      setTimeout(() => {
        setSelectedTemplate(null);
      }, 1000);

    } catch (error) {
      console.error('Failed to create quick task:', error);
      toast.error(
        'Quest Creation Failed',
        'Unable to create your quest. Please try again.',
        true
      );
    } finally {
      setIsCreating(false);
    }
  };

  const CustomTaskButton = () => (
    <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg border border-gray-600 p-4 hover:border-theme-accent hover:shadow-lg hover:shadow-theme-accent/20 transition-all duration-300 cursor-pointer group">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-theme-accent/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-theme-accent/20 transition-colors">
          <Plus className="w-6 h-6 text-theme-accent" />
        </div>
        <h3 className="font-semibold text-gray-200 mb-1">Custom Quest</h3>
        <p className="text-xs text-gray-400 mb-3">Create your own adventure</p>
        <div className="text-xs text-theme-accent font-medium">Design Quest</div>
      </div>
    </div>
  );

  const TemplateCard = ({ template }: { template: QuickStartTemplate }) => {
    const Icon = template.icon;
    const isSelected = selectedTemplate?.id === template.id;
    const isCurrentlyCreating = isCreating && isSelected;

    return (
      <div 
        className={`relative bg-gradient-to-br ${template.gradient} rounded-lg p-4 cursor-pointer transition-all duration-300 ${
          isCurrentlyCreating 
            ? 'scale-105 shadow-xl animate-pulse' 
            : 'hover:scale-102 hover:shadow-lg hover:shadow-current/20'
        } ${isCreating && !isSelected ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => !isCreating && handleQuickCreate(template)}
      >
        {/* Animated background for selected template */}
        {isCurrentlyCreating && (
          <div className="absolute inset-0 bg-white/20 rounded-lg animate-pulse" />
        )}
        
        <div className="relative flex flex-col items-center justify-center text-center text-white">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
            {isCurrentlyCreating ? (
              <Wand2 className="w-6 h-6 animate-spin" />
            ) : (
              <Icon className="w-6 h-6" />
            )}
          </div>
          
          <h3 className="font-semibold mb-1 text-sm">{template.name}</h3>
          <p className="text-xs opacity-90 mb-3 line-clamp-2">{template.description}</p>
          
          <div className="flex items-center justify-between w-full text-xs">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{template.estimatedTime}m</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{template.xpReward} XP</span>
            </div>
          </div>
          
          <div className="mt-2 text-xs font-medium">
            Difficulty: {'★'.repeat(template.difficulty)}{'☆'.repeat(5 - template.difficulty)}
          </div>
          
          {isCurrentlyCreating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 text-white font-medium">
                <Rocket className="w-4 h-4 animate-bounce" />
                Creating...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <FadeIn>
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-6 h-6 text-theme-accent" />
            Quick Start
          </h2>
          <div className="text-sm text-gray-400">
            Launch quests instantly
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
          
          <CustomTaskButton />
        </div>

        {/* Stats about quick starts */}
        <div className="mt-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-400">
              Ready to embark on your next adventure?
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-green-400">
                <Target className="w-3 h-3" />
                <span>Auto-difficulty</span>
              </div>
              <div className="flex items-center gap-1 text-blue-400">
                <Sparkles className="w-3 h-3" />
                <span>Smart rewards</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};

export default QuickStartWidget;