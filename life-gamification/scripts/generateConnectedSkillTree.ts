/**
 * POE-Style Connected Skill Tree Generator
 * Creates a fully interconnected skill tree with:
 * - Central hub with starting nodes
 * - Cross-stat connections
 * - Proper tree structure
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
  
  // Starting nodes arranged in a pentagon around center
  startingNodes: {
    strength: { angle: 0, radius: 150 }, // Right
    intelligence: { angle: 72, radius: 150 }, // Top-right
    luck: { angle: 144, radius: 150 }, // Top-left
    aura: { angle: 216, radius: 150 }, // Bottom-left
    will: { angle: 288, radius: 150 } // Bottom-right
  },
  
  maxRadiusFromCenter: 1200,
  
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

// Convert polar to cartesian coordinates
const polarToCartesian = (angle: number, radius: number, centerX: number = 2000, centerY: number = 2000) => ({
  x: centerX + Math.cos(angle * Math.PI / 180) * radius,
  y: centerY + Math.sin(angle * Math.PI / 180) * radius
});

// Generate starting nodes in a central hub
const generateStartingNodes = (): SkillNode[] => {
  const nodes: SkillNode[] = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    const position = polarToCartesian(config.angle, config.radius);
    
    nodes.push({
      node_key: `START_${stat.toUpperCase()}`,
      name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Mastery`,
      description: `Starting node for ${stat} specialization`,
      node_type: 'start',
      primary_stat: stat as any,
      x_position: position.x,
      y_position: position.y,
      level_requirement: 1,
      prerequisite_nodes: [],
      skill_point_cost: 0,
      stat_bonuses: { [stat]: 5 },
      productivity_effects: { [`${stat}_task_xp_bonus`]: 0.1 },
      game_effects: {},
      color_hex: STAT_COLORS[stat as keyof typeof STAT_COLORS],
      size: 'large'
    });
  });
  
  return nodes;
};

// Generate regular nodes in radiating paths from starting nodes
const generateRegularNodes = (): SkillNode[] => {
  const nodes: SkillNode[] = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    const startPosition = polarToCartesian(config.angle, config.radius);
    
    // Create multiple paths radiating from each starting node
    const pathCount = 5;
    const nodesPerPath = 60; // 300 total regular nodes / 5 paths
    
    for (let path = 0; path < pathCount; path++) {
      const pathAngle = config.angle + (path - 2) * 15; // Spread paths ±30°
      
      for (let i = 1; i <= nodesPerPath; i++) {
        const radius = config.radius + 80 + (i * 15); // Gradually increase distance
        const nodeAngle = pathAngle + (Math.random() - 0.5) * 10; // Small randomization
        const position = polarToCartesian(nodeAngle, radius);
        
        const powerMultiplier = 1 + (i / nodesPerPath) * 3; // 1x to 4x power
        const baseBonuses = getRegularNodeBonuses(stat, powerMultiplier);
        
        nodes.push({
          node_key: `${stat.toUpperCase()}_R_${path}_${String(i).padStart(2, '0')}`,
          name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Node`,
          description: generateRegularDescription(stat, baseBonuses),
          node_type: 'regular',
          primary_stat: stat as any,
          x_position: position.x,
          y_position: position.y,
          level_requirement: Math.max(1, Math.floor(i / 12)),
          prerequisite_nodes: [],
          skill_point_cost: 1,
          stat_bonuses: baseBonuses.stats,
          productivity_effects: baseBonuses.productivity,
          game_effects: {},
          color_hex: STAT_COLORS[stat as keyof typeof STAT_COLORS],
          size: 'small'
        });
      }
    }
  });
  
  return nodes;
};

// Generate specialized nodes in clusters
const generateSpecializedNodes = (): SkillNode[] => {
  const nodes: SkillNode[] = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    const clusterCount = 20; // 100 nodes / 5 per cluster
    
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      const clusterRadius = 400 + (cluster / clusterCount) * 600;
      const clusterAngle = config.angle + (cluster / clusterCount - 0.5) * 60;
      
      const clusterCenter = polarToCartesian(clusterAngle, clusterRadius);
      
      // Generate 5 nodes in a small cluster
      for (let i = 0; i < 5; i++) {
        const nodeAngle = (i * 72); // Pentagon arrangement
        const nodeRadius = 25;
        const nodePosition = polarToCartesian(nodeAngle, nodeRadius, clusterCenter.x, clusterCenter.y);
        
        const powerMultiplier = 2 + (cluster / clusterCount) * 3;
        const specializedBonuses = getSpecializedNodeBonuses(stat, powerMultiplier, cluster);
        
        nodes.push({
          node_key: `${stat.toUpperCase()}_S_${cluster}_${i}`,
          name: specializedBonuses.name,
          description: specializedBonuses.description,
          node_type: 'specialized',
          primary_stat: stat as any,
          x_position: nodePosition.x,
          y_position: nodePosition.y,
          level_requirement: 5 + Math.floor(cluster / 4),
          prerequisite_nodes: [],
          skill_point_cost: 2,
          stat_bonuses: specializedBonuses.stats,
          productivity_effects: specializedBonuses.productivity,
          game_effects: specializedBonuses.gameEffects,
          color_hex: STAT_COLORS[stat as keyof typeof STAT_COLORS],
          size: 'medium'
        });
      }
    }
  });
  
  return nodes;
};

// Generate augmenting nodes at the periphery
const generateAugmentingNodes = (): SkillNode[] => {
  const nodes: SkillNode[] = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    for (let i = 1; i <= 10; i++) {
      const radius = SKILL_TREE_CONFIG.maxRadiusFromCenter * (0.7 + (i / 10) * 0.3);
      const angle = config.angle + (i / 10 - 0.5) * 30;
      const position = polarToCartesian(angle, radius);
      
      const augmentingEffects = getAugmentingNodeEffects(stat, i);
      
      nodes.push({
        node_key: `${stat.toUpperCase()}_A_${String(i).padStart(2, '0')}`,
        name: augmentingEffects.name,
        description: augmentingEffects.description,
        node_type: 'augmenting',
        primary_stat: stat as any,
        x_position: position.x,
        y_position: position.y,
        level_requirement: 20 + i * 3,
        prerequisite_nodes: [],
        skill_point_cost: 5,
        stat_bonuses: augmentingEffects.stats,
        productivity_effects: augmentingEffects.productivity,
        game_effects: augmentingEffects.gameEffects,
        color_hex: STAT_COLORS[stat as keyof typeof STAT_COLORS],
        size: 'massive'
      });
    }
  });
  
  return nodes;
};

// Helper functions (same as before)
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
  const themes = [`${stat.charAt(0).toUpperCase() + stat.slice(1)} Mastery`, `${stat.charAt(0).toUpperCase() + stat.slice(1)} Focus`];
  const theme = themes[clusterIndex % themes.length];
  
  return {
    name: theme,
    description: `Specialized ${stat} enhancement`,
    stats: {
      [stat]: Math.round(8 * powerMultiplier),
      health: stat === 'strength' ? Math.round(20 * powerMultiplier) : 0,
      mana: stat === 'intelligence' ? Math.round(20 * powerMultiplier) : 0
    },
    productivity: {
      [`${stat}_focus_bonus`]: 0.05 * powerMultiplier
    },
    gameEffects: {
      specialized_unlock: true
    }
  };
};

const getAugmentingNodeEffects = (stat: string, nodeIndex: number) => {
  return {
    name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Ascendancy`,
    description: `Ultimate ${stat} enhancement`,
    stats: {
      [stat]: Math.round(25 + nodeIndex * 5),
      health: stat === 'strength' ? Math.round(100 + nodeIndex * 20) : 0,
      mana: stat === 'intelligence' ? Math.round(100 + nodeIndex * 20) : 0
    },
    productivity: {
      [`${stat}_mastery_active`]: 1.0
    },
    gameEffects: {
      ultimate_unlock: true
    }
  };
};

const generateRegularDescription = (stat: string, bonuses: any): string => {
  const statBonus = bonuses.stats[stat];
  const productivityBonus = Math.round(bonuses.productivity[`${stat}_task_xp_bonus`] * 100);
  return `+${statBonus} ${stat.charAt(0).toUpperCase() + stat.slice(1)}, +${productivityBonus}% XP`;
};

// Enhanced connection generation for fully connected tree
const generateConnections = (nodes: SkillNode[]): Connection[] => {
  const connections: Connection[] = [];
  const nodeMap = new Map(nodes.map(node => [node.node_key, node]));
  
  // First, connect each node to its nearest neighbors to ensure connectivity
  nodes.forEach(node => {
    const nearbyNodes = findNearbyNodes(node, nodes, 120);
    
    // Connect to 2-3 nearest nodes to ensure good connectivity
    const sortedNearby = nearbyNodes
      .sort((a, b) => distance(node, a) - distance(node, b))
      .slice(0, 3);
    
    sortedNearby.forEach(nearbyNode => {
      if (shouldConnect(node, nearbyNode)) {
        connections.push({
          from_node: nearbyNode.node_key,
          to_node: node.node_key,
          path_type: 'normal'
        });
      }
    });
  });
  
  // Add cross-stat connections between adjacent stat areas
  const crossStatConnections = generateCrossStatConnections(nodes);
  connections.push(...crossStatConnections);
  
  // Remove duplicates
  const uniqueConnections = Array.from(
    new Set(connections.map(c => `${c.from_node}->${c.to_node}`))
  ).map(key => {
    const [from, to] = key.split('->');
    return connections.find(c => c.from_node === from && c.to_node === to)!;
  });
  
  return uniqueConnections;
};

const generateCrossStatConnections = (nodes: SkillNode[]): Connection[] => {
  const connections: Connection[] = [];
  const statAdjacency = {
    strength: ['aura', 'will'],
    intelligence: ['luck', 'will'],
    luck: ['intelligence', 'aura'],
    aura: ['luck', 'strength'],
    will: ['strength', 'intelligence']
  };
  
  // Find nodes near stat boundaries and create cross-connections
  Object.entries(statAdjacency).forEach(([stat1, adjacentStats]) => {
    const stat1Nodes = nodes.filter(n => n.primary_stat === stat1);
    
    adjacentStats.forEach(stat2 => {
      const stat2Nodes = nodes.filter(n => n.primary_stat === stat2);
      
      // Find closest pairs between these stats
      stat1Nodes.forEach(node1 => {
        const closestStat2Node = stat2Nodes
          .filter(node2 => distance(node1, node2) < 200)
          .sort((a, b) => distance(node1, a) - distance(node1, b))[0];
        
        if (closestStat2Node && Math.abs(node1.level_requirement - closestStat2Node.level_requirement) <= 2) {
          connections.push({
            from_node: node1.node_key,
            to_node: closestStat2Node.node_key,
            path_type: 'synergy'
          });
        }
      });
    });
  });
  
  return connections;
};

const findNearbyNodes = (centerNode: SkillNode, allNodes: SkillNode[], maxDistance: number): SkillNode[] => {
  return allNodes.filter(node => {
    if (node.node_key === centerNode.node_key) return false;
    return distance(centerNode, node) <= maxDistance;
  });
};

const distance = (node1: SkillNode, node2: SkillNode): number => {
  return Math.sqrt(
    Math.pow(node1.x_position - node2.x_position, 2) +
    Math.pow(node1.y_position - node2.y_position, 2)
  );
};

const shouldConnect = (fromNode: SkillNode, toNode: SkillNode): boolean => {
  // Always allow start node connections
  if (fromNode.node_type === 'start' || toNode.node_type === 'start') return true;
  
  // Connect nodes of similar levels
  const levelDiff = Math.abs(fromNode.level_requirement - toNode.level_requirement);
  if (levelDiff > 5) return false;
  
  // Prefer same-stat connections but allow cross-stat
  if (fromNode.primary_stat === toNode.primary_stat) return true;
  
  // Allow some cross-stat connections
  return Math.random() < 0.3;
};

// Main generation function
export const generateConnectedSkillTree = (): { nodes: SkillNode[], connections: Connection[] } => {
  const startingNodes = generateStartingNodes();
  const regularNodes = generateRegularNodes();
  const specializedNodes = generateSpecializedNodes();
  const augmentingNodes = generateAugmentingNodes();
  
  const allNodes = [...startingNodes, ...regularNodes, ...specializedNodes, ...augmentingNodes];
  const connections = generateConnections(allNodes);
  
  console.log(`Generated ${allNodes.length} nodes and ${connections.length} connections`);
  
  return { nodes: allNodes, connections };
};

// Export SQL generation function
export const generateConnectedSkillTreeSQL = (): string => {
  const { nodes, connections } = generateConnectedSkillTree();
  
  let sql = "-- Connected Skill Tree Data\n\n";
  
  // Clear existing data
  sql += "DELETE FROM skill_tree_connections;\n";
  sql += "DELETE FROM skill_nodes;\n\n";
  
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

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateConnectedSkillTree, generateConnectedSkillTreeSQL };
}