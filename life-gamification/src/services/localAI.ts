import * as tf from '@tensorflow/tfjs';

export interface TaskAnalysis {
  category: string;
  confidence: number;
  suggestedTags: string[];
  estimatedDuration: number;
  difficulty: number;
  priority: number;
}

export interface ProductivityInsight {
  type: 'pattern' | 'suggestion' | 'warning' | 'achievement';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  suggestions?: string[];
}

export interface OptimalTiming {
  workDuration: number; // minutes
  breakDuration: number; // minutes
  confidence: number;
  reasoning: string;
}

class LocalAI {
  private taskClassifier: tf.LayersModel | null = null;
  private productivityPredictor: tf.LayersModel | null = null;
  private initialized = false;

  // Common task keywords for classification
  private taskKeywords = {
    work: ['meeting', 'project', 'deadline', 'report', 'presentation', 'email', 'call', 'review'],
    personal: ['grocery', 'shopping', 'family', 'friend', 'birthday', 'appointment', 'errands'],
    health: ['exercise', 'workout', 'gym', 'run', 'walk', 'yoga', 'meditation', 'doctor', 'medicine'],
    learning: ['study', 'course', 'book', 'tutorial', 'practice', 'homework', 'research', 'learn'],
    creative: ['design', 'art', 'music', 'write', 'create', 'photo', 'video', 'drawing', 'painting'],
    maintenance: ['clean', 'organize', 'fix', 'repair', 'maintain', 'update', 'backup', 'install']
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Set TensorFlow.js backend (prefer WebGL for performance)
      await tf.ready();
      console.log('TensorFlow.js backend:', tf.getBackend());

      // Create simple models (in production, you'd load pre-trained models)
      await this.createTaskClassificationModel();
      await this.createProductivityPredictionModel();

      this.initialized = true;
      console.log('Local AI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Local AI:', error);
    }
  }

  private async createTaskClassificationModel(): Promise<void> {
    // Simple task classification model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [20], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 6, activation: 'softmax' }) // 6 categories
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.taskClassifier = model;
  }

  private async createProductivityPredictionModel(): Promise<void> {
    // Simple productivity prediction model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 2, activation: 'linear' }) // work duration, break duration
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });

    this.productivityPredictor = model;
  }

  // Convert text to feature vector for classification
  private textToFeatures(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const features = new Array(20).fill(0);

    // Simple feature extraction based on keyword presence
    Object.entries(this.taskKeywords).forEach(([category, keywords], categoryIndex) => {
      const categoryScore = keywords.reduce((score, keyword) => {
        return score + (words.some(word => word.includes(keyword)) ? 1 : 0);
      }, 0) / keywords.length;
      
      features[categoryIndex] = categoryScore;
    });

    // Additional features
    features[6] = Math.min(words.length / 10, 1); // Length score
    features[7] = words.filter(w => w.match(/urgent|asap|important/i)).length > 0 ? 1 : 0; // Urgency
    features[8] = words.filter(w => w.match(/easy|simple|quick/i)).length > 0 ? 1 : 0; // Difficulty
    features[9] = words.filter(w => w.match(/today|tomorrow|deadline/i)).length > 0 ? 1 : 0; // Time sensitivity

    // Pad remaining features with random noise to simulate complexity
    for (let i = 10; i < 20; i++) {
      features[i] = Math.random() * 0.1;
    }

    return features;
  }

  async categorizeTask(description: string): Promise<TaskAnalysis> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const features = this.textToFeatures(description);
      const tensor = tf.tensor2d([features]);

      // Use simple rule-based classification for now (simulate ML prediction)
      const categories = ['work', 'personal', 'health', 'learning', 'creative', 'maintenance'];
      
      // Calculate scores based on keyword matching
      const scores = categories.map((category, index) => {
        const keywords = this.taskKeywords[category as keyof typeof this.taskKeywords];
        const words = description.toLowerCase().split(/\s+/);
        const matches = keywords.filter(keyword => 
          words.some(word => word.includes(keyword))
        ).length;
        return matches / keywords.length;
      });

      const maxIndex = scores.indexOf(Math.max(...scores));
      const confidence = Math.max(...scores);

      // Extract suggested tags
      const suggestedTags = this.extractTags(description);

      // Estimate duration based on complexity
      const estimatedDuration = this.estimateDuration(description);

      // Calculate difficulty
      const difficulty = this.calculateDifficulty(description);

      // Calculate priority
      const priority = this.calculatePriority(description);

      tensor.dispose();

      return {
        category: categories[maxIndex],
        confidence: confidence || 0.5,
        suggestedTags,
        estimatedDuration,
        difficulty,
        priority
      };
    } catch (error) {
      console.error('Task categorization failed:', error);
      return {
        category: 'personal',
        confidence: 0.5,
        suggestedTags: [],
        estimatedDuration: 30,
        difficulty: 5,
        priority: 3
      };
    }
  }

  private extractTags(description: string): string[] {
    const words = description.toLowerCase().split(/\s+/);
    const tags: string[] = [];

    // Extract common tags
    if (words.some(w => w.match(/urgent|asap|important/i))) tags.push('urgent');
    if (words.some(w => w.match(/easy|simple|quick/i))) tags.push('easy');
    if (words.some(w => w.match(/complex|difficult|hard/i))) tags.push('complex');
    if (words.some(w => w.match(/creative|design|art/i))) tags.push('creative');
    if (words.some(w => w.match(/meeting|call|social/i))) tags.push('social');
    if (words.some(w => w.match(/focus|concentration|deep/i))) tags.push('deep-work');

    return tags;
  }

  private estimateDuration(description: string): number {
    const words = description.toLowerCase().split(/\s+/);
    let baseDuration = 30; // Default 30 minutes

    // Adjust based on keywords
    if (words.some(w => w.match(/quick|fast|short/i))) baseDuration = 15;
    if (words.some(w => w.match(/long|extended|comprehensive/i))) baseDuration = 90;
    if (words.some(w => w.match(/meeting/i))) baseDuration = 60;
    if (words.some(w => w.match(/project|complex/i))) baseDuration = 120;

    // Adjust based on length
    if (description.length > 100) baseDuration += 15;
    if (description.length > 200) baseDuration += 30;

    return Math.min(baseDuration, 240); // Cap at 4 hours
  }

  private calculateDifficulty(description: string): number {
    const words = description.toLowerCase().split(/\s+/);
    let difficulty = 5; // Default medium

    if (words.some(w => w.match(/easy|simple|quick|basic/i))) difficulty = 2;
    if (words.some(w => w.match(/complex|difficult|advanced|challenging/i))) difficulty = 8;
    if (words.some(w => w.match(/expert|master|professional/i))) difficulty = 9;

    return Math.max(1, Math.min(10, difficulty));
  }

  private calculatePriority(description: string): number {
    const words = description.toLowerCase().split(/\s+/);
    let priority = 3; // Default medium

    if (words.some(w => w.match(/urgent|asap|critical|emergency/i))) priority = 5;
    if (words.some(w => w.match(/important|priority|must/i))) priority = 4;
    if (words.some(w => w.match(/optional|maybe|someday/i))) priority = 1;
    if (words.some(w => w.match(/low|minor/i))) priority = 2;

    return Math.max(1, Math.min(5, priority));
  }

  async predictOptimalWorkTime(
    currentHour: number = new Date().getHours(),
    energyLevel: number = 0.7,
    recentProductivity: number = 0.8,
    taskComplexity: number = 0.5
  ): Promise<OptimalTiming> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Simple heuristic-based prediction (simulate ML)
      const features = [
        currentHour / 24,
        energyLevel,
        recentProductivity,
        taskComplexity,
        // Add circadian rhythm factors
        Math.sin((currentHour - 6) * Math.PI / 12), // Peak around 2 PM
        Math.cos((currentHour - 6) * Math.PI / 12),
        // Weekend factor
        new Date().getDay() % 6 === 0 ? 0.8 : 1.0,
        // Time of day factor
        currentHour >= 9 && currentHour <= 17 ? 1.0 : 0.7,
        // Energy-complexity matching
        Math.abs(energyLevel - taskComplexity),
        // Random factor for variation
        Math.random() * 0.1
      ];

      // Calculate optimal work duration (25-90 minutes)
      let workDuration = 25 + (energyLevel * recentProductivity * 65);
      
      // Adjust for time of day
      if (currentHour >= 9 && currentHour <= 11) workDuration *= 1.2; // Morning boost
      if (currentHour >= 14 && currentHour <= 16) workDuration *= 1.1; // Afternoon focus
      if (currentHour >= 20 || currentHour <= 6) workDuration *= 0.7; // Evening/night reduction

      // Adjust for task complexity
      workDuration *= (0.5 + taskComplexity * 0.8);

      // Calculate break duration (5-20 minutes)
      let breakDuration = 5 + (1 - energyLevel) * 15;
      if (workDuration > 60) breakDuration += 5; // Longer breaks for longer work sessions

      const confidence = (energyLevel + recentProductivity) / 2;

      return {
        workDuration: Math.round(Math.max(15, Math.min(90, workDuration))),
        breakDuration: Math.round(Math.max(5, Math.min(20, breakDuration))),
        confidence,
        reasoning: this.generateRecommendationReasoning(currentHour, energyLevel, taskComplexity)
      };
    } catch (error) {
      console.error('Productivity prediction failed:', error);
      return {
        workDuration: 25,
        breakDuration: 5,
        confidence: 0.5,
        reasoning: 'Using default Pomodoro technique timing'
      };
    }
  }

  private generateRecommendationReasoning(hour: number, energy: number, complexity: number): string {
    const timeOfDay = hour >= 9 && hour <= 11 ? 'morning' : 
                     hour >= 14 && hour <= 16 ? 'afternoon' : 
                     hour >= 18 && hour <= 20 ? 'evening' : 'off-peak';
    
    const energyLevel = energy > 0.8 ? 'high' : energy > 0.5 ? 'moderate' : 'low';
    const taskLevel = complexity > 0.7 ? 'complex' : complexity > 0.4 ? 'moderate' : 'simple';

    return `Based on ${timeOfDay} timing, ${energyLevel} energy, and ${taskLevel} task complexity`;
  }

  async generateProductivityInsights(userStats: {
    tasksCompleted: number;
    averageCompletionTime: number;
    streakDays: number;
    preferredCategories: string[];
    productivityHours: number[];
  }): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = [];

    // Pattern recognition
    if (userStats.productivityHours.length > 0) {
      const peakHour = userStats.productivityHours.indexOf(Math.max(...userStats.productivityHours));
      insights.push({
        type: 'pattern',
        title: 'Peak Productivity Hour Detected',
        description: `You're most productive around ${peakHour}:00. Consider scheduling important tasks during this time.`,
        confidence: 0.8,
        actionable: true,
        suggestions: [
          `Block ${peakHour}:00-${peakHour + 2}:00 for deep work`,
          'Avoid meetings during your peak hours',
          'Tackle your most challenging tasks during this window'
        ]
      });
    }

    // Streak analysis
    if (userStats.streakDays >= 7) {
      insights.push({
        type: 'achievement',
        title: 'Consistency Master',
        description: `Amazing! You've maintained a ${userStats.streakDays}-day streak. Consistency is the key to long-term success.`,
        confidence: 1.0,
        actionable: false
      });
    } else if (userStats.streakDays === 0) {
      insights.push({
        type: 'suggestion',
        title: 'Start Small for Big Wins',
        description: 'Building a habit starts with just one day. Complete at least one small task today to begin your streak.',
        confidence: 0.9,
        actionable: true,
        suggestions: [
          'Choose one 15-minute task to complete today',
          'Set a reminder for the same time tomorrow',
          'Celebrate small wins to build momentum'
        ]
      });
    }

    // Task completion analysis
    if (userStats.averageCompletionTime > 60) {
      insights.push({
        type: 'suggestion',
        title: 'Break Down Large Tasks',
        description: 'Your average task takes over an hour. Breaking large tasks into smaller chunks can improve completion rates.',
        confidence: 0.7,
        actionable: true,
        suggestions: [
          'Use the 2-minute rule for quick tasks',
          'Break tasks larger than 30 minutes into subtasks',
          'Focus on one small step at a time'
        ]
      });
    }

    // Category preference analysis
    if (userStats.preferredCategories.length > 0) {
      const topCategory = userStats.preferredCategories[0];
      insights.push({
        type: 'pattern',
        title: 'Category Preference Identified',
        description: `You excel at ${topCategory} tasks. Consider leveraging this strength to tackle challenging work.`,
        confidence: 0.6,
        actionable: true,
        suggestions: [
          `Start your day with ${topCategory} tasks to build momentum`,
          `Use ${topCategory} tasks as rewards for completing difficult work`,
          'Consider developing expertise in this area'
        ]
      });
    }

    return insights;
  }

  // Cleanup resources
  dispose(): void {
    if (this.taskClassifier) {
      this.taskClassifier.dispose();
      this.taskClassifier = null;
    }
    if (this.productivityPredictor) {
      this.productivityPredictor.dispose();
      this.productivityPredictor = null;
    }
    this.initialized = false;
  }
}

// Export singleton instance
export const localAI = new LocalAI();

// Convenience functions
export const analyzeTask = (description: string) => localAI.categorizeTask(description);
export const predictOptimalTiming = (hour?: number, energy?: number, productivity?: number, complexity?: number) =>
  localAI.predictOptimalWorkTime(hour, energy, productivity, complexity);
export const generateInsights = (userStats: any) => localAI.generateProductivityInsights(userStats);
export const initializeAI = () => localAI.initialize();