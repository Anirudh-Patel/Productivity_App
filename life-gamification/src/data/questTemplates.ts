import { QuestTemplate } from '../types';

export const questTemplates: Record<string, QuestTemplate[]> = {
  work: [
    {
      id: 'work-focus',
      name: 'Deep Work Session',
      category: 'work',
      difficulty: 5,
      title_template: 'Complete ${duration} minutes of focused work on ${project}',
      description_template: 'Eliminate distractions and focus deeply on your most important ${project} task.',
      variables: {
        duration: ['25', '45', '90', '120'],
        project: ['current project', 'top priority', 'main goal', 'key objective']
      },
      default_duration: 45,
      tags: ['focus', 'productivity', 'deep-work']
    },
    {
      id: 'work-meeting',
      name: 'Productive Meeting',
      category: 'work',
      difficulty: 3,
      title_template: 'Lead a productive ${meeting_type} meeting',
      description_template: 'Facilitate an effective ${meeting_type} meeting with clear agenda and outcomes.',
      variables: {
        meeting_type: ['team', 'client', 'planning', 'review', 'brainstorming']
      },
      tags: ['leadership', 'communication', 'teamwork']
    },
    {
      id: 'work-skill',
      name: 'Professional Development',
      category: 'work',
      difficulty: 6,
      title_template: 'Learn ${skill} for ${duration} minutes',
      description_template: 'Invest in your professional growth by learning ${skill}.',
      variables: {
        skill: ['new technology', 'industry trends', 'soft skills', 'technical skills'],
        duration: ['30', '60', '90', '120']
      },
      tags: ['learning', 'growth', 'skills']
    }
  ],
  health: [
    {
      id: 'health-workout',
      name: 'Workout Session',
      category: 'health',
      difficulty: 4,
      title_template: 'Complete ${workout_type} workout for ${duration} minutes',
      description_template: 'Train your body with a ${intensity} ${workout_type} session.',
      variables: {
        workout_type: ['strength', 'cardio', 'yoga', 'HIIT', 'stretching'],
        duration: ['20', '30', '45', '60'],
        intensity: ['light', 'moderate', 'intense', 'challenging']
      },
      tags: ['fitness', 'strength', 'endurance']
    },
    {
      id: 'health-nutrition',
      name: 'Healthy Eating',
      category: 'health',
      difficulty: 3,
      title_template: 'Eat ${meal_count} healthy meals today',
      description_template: 'Nourish your body with ${meal_count} balanced, nutritious meals.',
      variables: {
        meal_count: ['2', '3', '4', '5']
      },
      tags: ['nutrition', 'wellness', 'habits']
    },
    {
      id: 'health-mindfulness',
      name: 'Mindfulness Practice',
      category: 'health',
      difficulty: 2,
      title_template: 'Practice ${activity} for ${duration} minutes',
      description_template: 'Take care of your mental health with ${duration} minutes of ${activity}.',
      variables: {
        activity: ['meditation', 'deep breathing', 'mindfulness', 'journaling'],
        duration: ['5', '10', '15', '20', '30']
      },
      tags: ['mental-health', 'mindfulness', 'relaxation']
    }
  ],
  learning: [
    {
      id: 'learning-read',
      name: 'Reading Session',
      category: 'learning',
      difficulty: 3,
      title_template: 'Read ${pages} pages of ${subject}',
      description_template: 'Expand your knowledge by reading ${pages} pages about ${subject}.',
      variables: {
        pages: ['10', '20', '30', '50'],
        subject: ['professional development', 'personal interest', 'current project', 'new skill']
      },
      tags: ['reading', 'knowledge', 'growth']
    },
    {
      id: 'learning-course',
      name: 'Online Course',
      category: 'learning',
      difficulty: 5,
      title_template: 'Complete ${lessons} lessons of ${course_type} course',
      description_template: 'Advance your skills by completing ${lessons} lessons in ${course_type}.',
      variables: {
        lessons: ['1', '2', '3', '5'],
        course_type: ['programming', 'design', 'business', 'personal development']
      },
      tags: ['courses', 'skills', 'certification']
    },
    {
      id: 'learning-practice',
      name: 'Skill Practice',
      category: 'learning',
      difficulty: 4,
      title_template: 'Practice ${skill} for ${duration} minutes',
      description_template: 'Deliberate practice of ${skill} to build mastery.',
      variables: {
        skill: ['coding', 'writing', 'design', 'language', 'music'],
        duration: ['30', '45', '60', '90']
      },
      tags: ['practice', 'mastery', 'deliberate-practice']
    }
  ],
  personal: [
    {
      id: 'personal-organize',
      name: 'Organization Task',
      category: 'personal',
      difficulty: 2,
      title_template: 'Organize ${area} for ${duration} minutes',
      description_template: 'Create order and clarity by organizing your ${area}.',
      variables: {
        area: ['workspace', 'bedroom', 'digital files', 'schedule', 'goals'],
        duration: ['15', '30', '45', '60']
      },
      tags: ['organization', 'productivity', 'clarity']
    },
    {
      id: 'personal-creative',
      name: 'Creative Project',
      category: 'personal',
      difficulty: 5,
      title_template: 'Work on ${project_type} for ${duration} minutes',
      description_template: 'Express your creativity through ${project_type} work.',
      variables: {
        project_type: ['writing', 'art', 'music', 'photography', 'crafting'],
        duration: ['30', '60', '90', '120']
      },
      tags: ['creativity', 'expression', 'passion']
    },
    {
      id: 'personal-reflection',
      name: 'Self Reflection',
      category: 'personal',
      difficulty: 3,
      title_template: 'Reflect on ${topic} for ${duration} minutes',
      description_template: 'Take time for introspection and personal growth by reflecting on ${topic}.',
      variables: {
        topic: ['daily progress', 'long-term goals', 'recent challenges', 'personal values'],
        duration: ['10', '15', '20', '30']
      },
      tags: ['reflection', 'growth', 'self-awareness']
    }
  ],
  social: [
    {
      id: 'social-connect',
      name: 'Social Connection',
      category: 'social',
      difficulty: 3,
      title_template: 'Connect with ${person} for ${duration} minutes',
      description_template: 'Strengthen relationships by spending quality time with ${person}.',
      variables: {
        person: ['family member', 'close friend', 'colleague', 'mentor'],
        duration: ['15', '30', '60', '90']
      },
      tags: ['relationships', 'connection', 'communication']
    },
    {
      id: 'social-help',
      name: 'Help Others',
      category: 'social',
      difficulty: 4,
      title_template: 'Help someone with ${help_type}',
      description_template: 'Make a positive impact by helping someone with ${help_type}.',
      variables: {
        help_type: ['work task', 'personal problem', 'learning goal', 'life challenge']
      },
      tags: ['helping', 'service', 'impact']
    },
    {
      id: 'social-network',
      name: 'Networking',
      category: 'social',
      difficulty: 5,
      title_template: 'Reach out to ${count} new professional contacts',
      description_template: 'Expand your network by connecting with ${count} new people in your field.',
      variables: {
        count: ['1', '2', '3', '5']
      },
      tags: ['networking', 'professional', 'growth']
    }
  ]
};

// Helper functions
export const getTemplatesForCategory = (category: string): QuestTemplate[] => {
  return questTemplates[category] || [];
};

export const getAllTemplates = (): QuestTemplate[] => {
  return Object.values(questTemplates).flat();
};

export const getRandomTemplate = (category?: string): QuestTemplate => {
  const templates = category ? getTemplatesForCategory(category) : getAllTemplates();
  return templates[Math.floor(Math.random() * templates.length)];
};

export const generateQuestFromTemplate = (
  template: QuestTemplate,
  selectedVariables?: Record<string, string>
): { title: string; description: string } => {
  let title = template.title_template;
  let description = template.description_template;

  // Replace variables with selected values or random defaults
  if (template.variables) {
    for (const [variable, options] of Object.entries(template.variables)) {
      const value = selectedVariables?.[variable] || options[Math.floor(Math.random() * options.length)];
      const variablePattern = new RegExp(`\\$\\{${variable}\\}`, 'g');
      title = title.replace(variablePattern, value);
      description = description.replace(variablePattern, value);
    }
  }

  return { title, description };
};

// Pre-defined quick quest categories
export const quickQuestCategories = [
  {
    id: 'quick-work',
    name: 'Quick Work Task',
    icon: '💼',
    color: 'blue',
    templates: questTemplates.work.slice(0, 2)
  },
  {
    id: 'quick-health',
    name: 'Health & Fitness',
    icon: '💪',
    color: 'green',
    templates: questTemplates.health.slice(0, 2)
  },
  {
    id: 'quick-learning',
    name: 'Learning Goal',
    icon: '📚',
    color: 'purple',
    templates: questTemplates.learning.slice(0, 2)
  },
  {
    id: 'quick-personal',
    name: 'Personal Growth',
    icon: '🌱',
    color: 'orange',
    templates: questTemplates.personal.slice(0, 2)
  }
];