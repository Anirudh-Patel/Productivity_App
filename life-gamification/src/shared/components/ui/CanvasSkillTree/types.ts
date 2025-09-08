// Canvas Skill Tree Types
// Based on the POE-style skill tree implementation guide

export interface SkillNode {
  id: number;
  node_key: string;
  name: string;
  description: string;
  node_type: 'start' | 'regular' | 'specialized' | 'augmenting';
  primary_stat: 'strength' | 'intelligence' | 'luck' | 'aura' | 'will';
  secondary_stat?: string;
  
  // Position on canvas
  x_position: number;
  y_position: number;
  
  // Requirements
  level_requirement: number;
  prerequisite_nodes: string[];
  skill_point_cost: number;
  
  // Effects
  stat_bonuses: Record<string, number>;
  productivity_effects: Record<string, number>;
  game_effects: Record<string, any>;
  
  // Visual
  icon_sprite?: string;
  color_hex: string;
  size: 'small' | 'medium' | 'large' | 'massive';
  distance_from_start?: number;
}

export interface SkillTreeConnection {
  id: number;
  from_node: string;
  to_node: string;
  path_type: 'normal' | 'synergy' | 'hidden';
}

export interface UserSkillAllocation {
  id: number;
  user_id: number;
  node_key: string;
  allocated_at: string;
}

export interface UserSkillStats {
  id: number;
  user_id: number;
  total_nodes_allocated: number;
  available_skill_points: number;
  
  // Base stats from skill tree
  strength_bonus: number;
  intelligence_bonus: number;
  luck_bonus: number;
  aura_bonus: number;
  will_bonus: number;
  
  // Derived stats
  health_bonus: number;
  mana_bonus: number;
  
  // Productivity effects
  task_xp_multiplier: number;
  task_completion_bonus: number;
  streak_protection_count: number;
  
  last_calculated: string;
}

// Canvas rendering types
export interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface RenderOptions {
  allocatedNodes: Set<string>;
  hoveredNode: string | null;
  availablePoints: number;
  userLevel: number;
  lod: 'minimal' | 'simple' | 'full';
}

export type NodeStatus = 'locked' | 'available' | 'allocated';

export interface NodeRenderInfo {
  node: SkillNode;
  status: NodeStatus;
  canAllocate: boolean;
  radius: number;
  color: string;
  borderColor: string;
  glowIntensity: number;
  distanceColor: string;
}

export interface ConnectionRenderInfo {
  connection: SkillTreeConnection;
  fromNode: SkillNode;
  toNode: SkillNode;
  isActive: boolean;
  color: string;
  width: number;
  opacity: number;
}

// Skill tree configuration constants
export const SKILL_TREE_CONFIG = {
  canvasSize: { width: 4000, height: 4000 },
  center: { x: 2000, y: 2000 },
  
  startingNodes: {
    strength: { x: 1400, y: 2600, angle: 234 },
    intelligence: { x: 2000, y: 1400, angle: 90 },
    luck: { x: 2600, y: 2600, angle: 306 },
    aura: { x: 1400, y: 1400, angle: 162 },
    will: { x: 2600, y: 1400, angle: 18 }
  },
  
  nodeRadius: {
    small: 8,
    medium: 12,
    large: 16,
    massive: 24
  },
  
  nodeSpacing: {
    regular: 40,
    specialized: 60,
    augmenting: 100
  },
  
  cullingMargin: 50, // Extra pixels to render outside viewport
  maxRadiusFromStart: 800
};

export const STAT_COLORS = {
  strength: {
    primary: '#FF6B6B',
    secondary: '#FF4444',
    glow: 'rgba(255, 107, 107, 0.5)'
  },
  intelligence: {
    primary: '#4ECDC4',
    secondary: '#2AA39A',
    glow: 'rgba(78, 205, 196, 0.5)'
  },
  luck: {
    primary: '#FFE066',
    secondary: '#FFD700',
    glow: 'rgba(255, 224, 102, 0.5)'
  },
  aura: {
    primary: '#9B59B6',
    secondary: '#8E44AD',
    glow: 'rgba(155, 89, 182, 0.5)'
  },
  will: {
    primary: '#3498DB',
    secondary: '#2980B9',
    glow: 'rgba(52, 152, 219, 0.5)'
  }
};

export const NODE_STATES = {
  locked: {
    fillColor: '#2C2C2C',
    borderColor: '#555555',
    textColor: '#777777',
    glowIntensity: 0
  },
  available: {
    fillColor: '#4A4A4A',
    borderColor: '#FFAA00',
    textColor: '#FFFFFF',
    glowIntensity: 0.3
  },
  allocated: {
    fillColor: '#006600',
    borderColor: '#00AA00',
    textColor: '#FFFFFF',
    glowIntensity: 0.8
  },
  hovered: {
    glowIntensity: 1.0,
    scaleMultiplier: 1.1
  }
};

export const CONNECTION_STATES = {
  inactive: {
    color: '#444444',
    width: 1,
    opacity: 0.3
  },
  active: {
    color: '#00AA00',
    width: 2,
    opacity: 0.8
  },
  highlighted: {
    color: '#FFAA00',
    width: 3,
    opacity: 1.0
  }
};

export const LOD_THRESHOLDS = {
  minimal: 0.1,  // Below this zoom, show minimal detail
  simple: 0.5,   // Below this zoom, show simple detail
  full: Infinity // Above simple threshold, show full detail
};

// Utility type for stat totals
export interface StatTotals {
  strength: number;
  intelligence: number;
  luck: number;
  aura: number;
  will: number;
  health: number;
  mana: number;
}

// Performance monitoring
export interface PerformanceMetrics {
  frameTime: number;
  renderTime: number;
  visibleNodes: number;
  totalNodes: number;
  fps: number;
}

export interface SkillTreeState {
  nodes: SkillNode[];
  connections: SkillTreeConnection[];
  userAllocations: Set<string>;
  userStats: UserSkillStats | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  loadSkillTree: () => Promise<void>;
  allocateNode: (nodeKey: string) => Promise<void>;
  deallocateNode: (nodeKey: string) => Promise<void>;
  resetTree: () => Promise<void>;
  
  // Computed
  getNodeStatus: (nodeKey: string) => NodeStatus;
  getStatTotals: () => StatTotals;
  canAllocateNode: (nodeKey: string) => boolean;
}