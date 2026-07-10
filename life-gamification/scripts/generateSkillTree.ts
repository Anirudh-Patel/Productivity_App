/**
 * POE-Style Skill Tree Generator
 * Generates 2,050 skill nodes according to the specification:
 * - 1,500 Regular Nodes (300 per stat)
 * - 500 Specialized Nodes (100 per stat) 
 * - 50 Augmenting Nodes (10 per stat)
 * - 5 Starting Nodes (1 per stat)
 */

interface SkillNode {
  node_key: string;
  name: string;
  description: string;
  node_type: 'start' | 'regular' | 'specialized' | 'augmenting';
  primary_stat: 'strength' | 'intelligence' | 'luck' | 'aura' | 'will';
  secondary_stat?: string;
  x_position: number;
  y_position: number;
  level_requirement: number;
  prerequisite_nodes: string[];
  skill_point_cost: number;
  stat_bonuses: Record<string, number>;
  productivity_effects: Record<string, number>;
  game_effects: Record<string, any>;
  icon_sprite?: string;
  color_hex: string;
  size: 'small' | 'medium' | 'large' | 'massive';
}

interface Connection {
  from_node: string;
  to_node: string;
  path_type: 'normal' | 'synergy' | 'hidden';
}

const SKILL_TREE_CONFIG = {
  canvasSize: { width: 4000, height: 4000 },
  center: { x: 2000, y: 2000 },
  
  startingNodes: {
    strength: { x: 1400, y: 2600, angle: 234 * Math.PI / 180 }, // Southwest
    intelligence: { x: 2000, y: 1400, angle: 90 * Math.PI / 180 }, // North
    luck: { x: 2600, y: 2600, angle: 306 * Math.PI / 180 }, // Southeast
    aura: { x: 1400, y: 1400, angle: 162 * Math.PI / 180 }, // Northwest
    will: { x: 2600, y: 1400, angle: 18 * Math.PI / 180 } // Northeast
  },
  
  maxRadiusFromStart: 800,
  
  nodeDistribution: {
    regular: 300, // per stat
    specialized: 100, // per stat
    augmenting: 10 // per stat
  }
};

const STAT_COLORS = {
  strength: '#FF6B6B',
  intelligence: '#4ECDC4',
  luck: '#FFE066',
  aura: '#9B59B6',
  will: '#3498DB'
};

// Generate regular nodes for a stat
const generateRegularNodes = (
  stat: keyof typeof SKILL_TREE_CONFIG.startingNodes,
  startingNode: { x: number; y: number; angle: number }
): SkillNode[] => {
  const nodes: SkillNode[] = [];
  const { x: startX, y: startY, angle: baseAngle } = startingNode;
  
  for (let i = 1; i <= SKILL_TREE_CONFIG.nodeDistribution.regular; i++) {
    const distance = 50 + (i / 300) * (SKILL_TREE_CONFIG.maxRadiusFromStart - 50);
    const angleSpread = Math.PI / 3; // ±30° spread
    const angle = baseAngle + (Math.random() - 0.5) * angleSpread;
    
    const x = startX + Math.cos(angle) * distance;
    const y = startY + Math.sin(angle) * distance;
    
    const powerMultiplier = getNodePowerMultiplier(distance);
    const baseBonuses = getRegularNodeBonuses(stat, powerMultiplier);
    
    nodes.push({
      node_key: `${stat.toUpperCase()}_${String(i).padStart(3, '0')}`,
      name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Node ${i}`,
      description: generateRegularDescription(stat, baseBonuses),
      node_type: 'regular',
      primary_stat: stat,
      x_position: x,
      y_position: y,
      level_requirement: Math.max(1, Math.floor(distance / 100)),
      prerequisite_nodes: [], // Will be populated later based on proximity
      skill_point_cost: 1,
      stat_bonuses: baseBonuses.stats,
      productivity_effects: baseBonuses.productivity,
      game_effects: {},
      color_hex: STAT_COLORS[stat],
      size: 'small'
    });
  }
  
  return nodes;
};

// Generate specialized nodes for a stat
const generateSpecializedNodes = (
  stat: keyof typeof SKILL_TREE_CONFIG.startingNodes,
  startingNode: { x: number; y: number; angle: number }
): SkillNode[] => {
  const nodes: SkillNode[] = [];
  const { x: startX, y: startY, angle: baseAngle } = startingNode;
  
  // Create clusters of specialized nodes
  const clusterCount = 20; // 5 nodes per cluster
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const clusterDistance = 200 + (cluster / clusterCount) * 500;
    const clusterAngle = baseAngle + (cluster / clusterCount - 0.5) * (Math.PI / 2);
    
    const clusterX = startX + Math.cos(clusterAngle) * clusterDistance;
    const clusterY = startY + Math.sin(clusterAngle) * clusterDistance;
    
    // Generate 5 nodes in this cluster
    for (let i = 0; i < 5; i++) {
      const nodeAngle = clusterAngle + (i - 2) * 0.2;
      const nodeDistance = clusterDistance + (i - 2) * 20;
      
      const x = startX + Math.cos(nodeAngle) * nodeDistance;
      const y = startY + Math.sin(nodeAngle) * nodeDistance;
      
      const nodeIndex = cluster * 5 + i + 1;
      const powerMultiplier = getNodePowerMultiplier(nodeDistance);
      const specializedBonuses = getSpecializedNodeBonuses(stat, powerMultiplier, cluster);
      
      nodes.push({
        node_key: `${stat.toUpperCase()}_SPEC_${String(nodeIndex).padStart(3, '0')}`,
        name: specializedBonuses.name,
        description: specializedBonuses.description,
        node_type: 'specialized',
        primary_stat: stat,
        x_position: x,
        y_position: y,
        level_requirement: Math.max(5, Math.floor(nodeDistance / 80)),
        prerequisite_nodes: [],
        skill_point_cost: 2,
        stat_bonuses: specializedBonuses.stats,
        productivity_effects: specializedBonuses.productivity,
        game_effects: specializedBonuses.gameEffects,
        color_hex: STAT_COLORS[stat],
        size: 'medium'
      });
    }
  }
  
  return nodes;
};

// Generate augmenting nodes for a stat
const generateAugmentingNodes = (
  stat: keyof typeof SKILL_TREE_CONFIG.startingNodes,
  startingNode: { x: number; y: number; angle: number }
): SkillNode[] => {
  const nodes: SkillNode[] = [];
  const { x: startX, y: startY, angle: baseAngle } = startingNode;
  
  for (let i = 1; i <= SKILL_TREE_CONFIG.nodeDistribution.augmenting; i++) {
    const distance = SKILL_TREE_CONFIG.maxRadiusFromStart * (0.6 + (i / 10) * 0.4);
    const angleSpread = Math.PI / 6; // ±15° spread
    const angle = baseAngle + (i / 10 - 0.5) * angleSpread;
    
    const x = startX + Math.cos(angle) * distance;
    const y = startY + Math.sin(angle) * distance;
    
    const augmentingEffects = getAugmentingNodeEffects(stat, i);
    
    nodes.push({
      node_key: `${stat.toUpperCase()}_AUG_${String(i).padStart(2, '0')}`,
      name: augmentingEffects.name,
      description: augmentingEffects.description,
      node_type: 'augmenting',
      primary_stat: stat,
      x_position: x,
      y_position: y,
      level_requirement: 20 + i * 5,
      prerequisite_nodes: [],
      skill_point_cost: 5,
      stat_bonuses: augmentingEffects.stats,
      productivity_effects: augmentingEffects.productivity,
      game_effects: augmentingEffects.gameEffects,
      color_hex: STAT_COLORS[stat],
      size: 'massive'
    });
  }
  
  return nodes;
};

// Helper functions
const getNodePowerMultiplier = (distanceFromStart: number): number => {
  const maxDistance = SKILL_TREE_CONFIG.maxRadiusFromStart;
  const normalized = Math.min(distanceFromStart / maxDistance, 1);
  return 1 + (normalized ** 2) * 4; // 1x to 5x multiplier
};

const getRegularNodeBonuses = (stat: string, powerMultiplier: number) => {
  const baseStatBonus = Math.round(2 * powerMultiplier);
  const baseProductivityBonus = 0.01 * powerMultiplier;
  
  return {
    stats: {
      [stat]: baseStatBonus,
      health: stat === 'strength' ? Math.round(5 * powerMultiplier) : 0,
      mana: stat === 'intelligence' ? Math.round(5 * powerMultiplier) : 0
    },
    productivity: {
      [`${stat}_task_xp_bonus`]: baseProductivityBonus
    }
  };
};

const getSpecializedNodeBonuses = (stat: string, powerMultiplier: number, clusterIndex: number) => {
  const clusterThemes = {
    strength: [
      { name: "Titan's Endurance", focus: "health_defense" },
      { name: "Berserker's Fury", focus: "damage_offense" },
      { name: "Iron Will", focus: "persistence" },
      { name: "Physical Mastery", focus: "task_bonus" }
    ],
    intelligence: [
      { name: "Scholar's Focus", focus: "learning_bonus" },
      { name: "Mental Fortress", focus: "concentration" },
      { name: "Cognitive Enhancement", focus: "efficiency" },
      { name: "Wisdom's Path", focus: "experience" }
    ]
  };
  
  const theme = clusterThemes[stat]?.[clusterIndex % 4] || { name: `${stat} Cluster`, focus: "general" };
  
  return {
    name: theme.name,
    description: `Specialized ${stat} enhancement focused on ${theme.focus}`,
    stats: {
      [stat]: Math.round(8 * powerMultiplier),
      health: stat === 'strength' ? Math.round(20 * powerMultiplier) : 0,
      mana: stat === 'intelligence' ? Math.round(20 * powerMultiplier) : 0
    },
    productivity: {
      [`${theme.focus}_bonus`]: 0.05 * powerMultiplier
    },
    gameEffects: {
      unlocks_feature: theme.focus
    }
  };
};

const getAugmentingNodeEffects = (stat: string, nodeIndex: number) => {
  const augmentingThemes = {
    strength: [
      { name: "Berserker's Oath", effect: "health_as_damage" },
      { name: "Titan's Constitution", effect: "damage_immunity" },
      { name: "Warrior's Spirit", effect: "combat_mastery" }
    ],
    intelligence: [
      { name: "Omniscience", effect: "all_knowledge" },
      { name: "Time Dilation", effect: "task_time_manipulation" },
      { name: "Mind Over Matter", effect: "mental_dominance" }
    ]
  };
  
  const themeIndex = (nodeIndex - 1) % 3;
  const theme = augmentingThemes[stat]?.[themeIndex] || { name: `${stat} Mastery`, effect: "ultimate_power" };
  
  return {
    name: theme.name,
    description: `Game-changing ${stat} augmentation: ${theme.effect}`,
    stats: {
      [stat]: Math.round(25 + nodeIndex * 5),
      health: stat === 'strength' ? Math.round(100 + nodeIndex * 20) : 0,
      mana: stat === 'intelligence' ? Math.round(100 + nodeIndex * 20) : 0
    },
    productivity: {
      [`${theme.effect}_active`]: 1.0
    },
    gameEffects: {
      [theme.effect]: true,
      ultimate_unlock: true
    }
  };
};

const generateRegularDescription = (stat: string, bonuses: any): string => {
  const statBonus = bonuses.stats[stat];
  const productivityBonus = Math.round(bonuses.productivity[`${stat}_task_xp_bonus`] * 100);
  return `+${statBonus} ${stat.charAt(0).toUpperCase() + stat.slice(1)}, +${productivityBonus}% XP from ${stat} tasks`;
};

// Main generation function
export const generateSkillTree = (): { nodes: SkillNode[], connections: Connection[] } => {
  const allNodes: SkillNode[] = [];
  const connections: Connection[] = [];
  
  // Generate nodes for each stat
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    const statKey = stat as keyof typeof SKILL_TREE_CONFIG.startingNodes;
    
    // Generate regular nodes
    const regularNodes = generateRegularNodes(statKey, config);
    allNodes.push(...regularNodes);
    
    // Generate specialized nodes
    const specializedNodes = generateSpecializedNodes(statKey, config);
    allNodes.push(...specializedNodes);
    
    // Generate augmenting nodes
    const augmentingNodes = generateAugmentingNodes(statKey, config);
    allNodes.push(...augmentingNodes);
  });
  
  // Generate connections based on proximity and logic
  allNodes.forEach(node => {
    const nearbyNodes = findNearbyNodes(node, allNodes, 100); // 100px proximity
    nearbyNodes.forEach(nearbyNode => {
      if (shouldConnect(node, nearbyNode)) {
        connections.push({
          from_node: nearbyNode.node_key,
          to_node: node.node_key,
          path_type: 'normal'
        });
      }
    });
  });
  
  return { nodes: allNodes, connections };
};

const findNearbyNodes = (centerNode: SkillNode, allNodes: SkillNode[], maxDistance: number): SkillNode[] => {
  return allNodes.filter(node => {
    if (node.node_key === centerNode.node_key) return false;
    
    const distance = Math.sqrt(
      Math.pow(node.x_position - centerNode.x_position, 2) +
      Math.pow(node.y_position - centerNode.y_position, 2)
    );
    
    return distance <= maxDistance;
  });
};

const shouldConnect = (fromNode: SkillNode, toNode: SkillNode): boolean => {
  // Don't connect nodes of very different types
  if (fromNode.node_type === 'start' && toNode.node_type === 'augmenting') return false;
  if (fromNode.node_type === 'regular' && toNode.node_type === 'augmenting') return false;
  
  // Only connect nodes of the same or adjacent stats
  if (fromNode.primary_stat !== toNode.primary_stat) {
    const adjacentStats = {
      strength: ['aura'],
      intelligence: ['will'],
      luck: ['strength', 'will'],
      aura: ['strength', 'intelligence'],
      will: ['intelligence', 'luck']
    };
    
    if (!adjacentStats[fromNode.primary_stat]?.includes(toNode.primary_stat)) {
      return false;
    }
  }
  
  // Prefer connections that make sense progression-wise
  const levelDiff = Math.abs(fromNode.level_requirement - toNode.level_requirement);
  return levelDiff <= 3; // Don't connect nodes too far apart in level
};

// Export SQL generation function
export const generateSkillTreeSQL = (): string => {
  const { nodes, connections } = generateSkillTree();
  
  let sql = "-- Generated Skill Tree Data\n\n";
  
  // Insert nodes
  sql += "INSERT INTO skill_nodes (node_key, name, description, node_type, primary_stat, x_position, y_position, level_requirement, prerequisite_nodes, skill_point_cost, stat_bonuses, productivity_effects, game_effects, color_hex, size) VALUES\n";
  
  const nodeValues = nodes.map(node => 
    `('${node.node_key}', '${node.name.replace(/'/g, "''")}', '${node.description.replace(/'/g, "''")}', '${node.node_type}', '${node.primary_stat}', ${node.x_position}, ${node.y_position}, ${node.level_requirement}, '${JSON.stringify(node.prerequisite_nodes)}', ${node.skill_point_cost}, '${JSON.stringify(node.stat_bonuses)}', '${JSON.stringify(node.productivity_effects)}', '${JSON.stringify(node.game_effects)}', '${node.color_hex}', '${node.size}')`
  ).join(',\n');
  
  sql += nodeValues + ";\n\n";
  
  // Insert connections
  if (connections.length > 0) {
    sql += "INSERT INTO skill_tree_connections (from_node, to_node, path_type) VALUES\n";
    
    const connectionValues = connections.map(conn =>
      `('${conn.from_node}', '${conn.to_node}', '${conn.path_type}')`
    ).join(',\n');
    
    sql += connectionValues + ";\n";
  }
  
  return sql;
};

console.log(`Generated ${generateSkillTree().nodes.length} skill nodes for POE-style skill tree`);