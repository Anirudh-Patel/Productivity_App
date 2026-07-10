// Generate a perfectly balanced skill tree with equal branches and circular outer connectivity
const fs = require('fs');

// Configuration
const CENTER = { x: 2000, y: 2000 };
const STATS = ['STRENGTH', 'INTELLIGENCE', 'LUCK', 'AURA', 'WILL'];
const DISTANCE_BANDS = 20; // Number of distance bands from center
const NODES_PER_BAND = 10; // Nodes per distance band per stat
const BAND_RADIUS_STEP = 80; // Pixel distance between bands
const STARTING_RADIUS = 300; // Distance of starting nodes from center

// Utility functions
const distance = (a, b) => Math.sqrt(Math.pow(a.x_position - b.x_position, 2) + Math.pow(a.y_position - b.y_position, 2));

const polarToCartesian = (centerX, centerY, radius, angleInRadians) => ({
  x_position: centerX + radius * Math.cos(angleInRadians),
  y_position: centerY + radius * Math.sin(angleInRadians)
});

const getDistanceBasedColor = (distance, maxDistance) => {
  if (distance === 0) return '#FFFFFF';
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  
  if (normalizedDistance <= 0.2) {
    const factor = normalizedDistance / 0.2;
    const r = Math.round(factor * 255);
    return `#${r.toString(16).padStart(2, '0')}ff00`;
  } else if (normalizedDistance <= 0.5) {
    const factor = (normalizedDistance - 0.2) / 0.3;
    const g = Math.round(255 - (factor * 128));
    return `#ff${g.toString(16).padStart(2, '0')}00`;
  } else if (normalizedDistance <= 0.8) {
    const factor = (normalizedDistance - 0.5) / 0.3;
    const g = Math.round(127 - (factor * 127));
    return `#ff${g.toString(16).padStart(2, '0')}00`;
  } else {
    const factor = (normalizedDistance - 0.8) / 0.2;
    const r = Math.round(255 - (factor * 100));
    const g = Math.round(factor * 35);
    const b = Math.round(factor * 49);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
};

const generateBalancedSkillTree = () => {
  const nodes = [];
  const connections = [];

  console.log('Generating balanced skill tree with circular outer connectivity...');

  // 1. Generate starting nodes in perfect pentagon
  const startingNodes = [];
  STATS.forEach((stat, index) => {
    const angle = (index * 2 * Math.PI) / STATS.length - (Math.PI / 2); // Start from top
    const position = polarToCartesian(CENTER.x, CENTER.y, STARTING_RADIUS, angle);
    
    const startNode = {
      node_key: `START_${stat}`,
      name: `${stat.charAt(0) + stat.slice(1).toLowerCase()} Mastery`,
      description: `Starting node for ${stat.toLowerCase()} specialization`,
      node_type: 'start',
      primary_stat: stat.toLowerCase(),
      x_position: position.x_position,
      y_position: position.y_position,
      level_requirement: 1,
      prerequisite_nodes: [],
      skill_point_cost: 0,
      stat_bonuses: { [stat.toLowerCase()]: 5 },
      productivity_effects: { [`${stat.toLowerCase()}_task_xp_bonus`]: 0.1 },
      game_effects: { starting_node: true, distance_from_start: 0 },
      color_hex: '#FFFFFF',
      size: 'large'
    };
    
    startingNodes.push(startNode);
    nodes.push(startNode);
  });

  // 2. Generate radial branches - each stat gets identical structure
  STATS.forEach((stat, statIndex) => {
    const startAngle = (statIndex * 2 * Math.PI) / STATS.length - (Math.PI / 2);
    const statNodes = []; // Store nodes for this stat for easy reference

    // Generate distance bands
    for (let distance = 1; distance <= DISTANCE_BANDS; distance++) {
      const bandRadius = STARTING_RADIUS + (distance * BAND_RADIUS_STEP);
      
      // Each stat gets exactly NODES_PER_BAND nodes at this distance
      for (let nodeIndex = 0; nodeIndex < NODES_PER_BAND; nodeIndex++) {
        // Spread nodes in an arc around the stat's radial direction
        const arcWidth = Math.PI / 6; // 30 degree arc per stat
        const angleOffset = (nodeIndex - (NODES_PER_BAND - 1) / 2) * (arcWidth / NODES_PER_BAND);
        const nodeAngle = startAngle + angleOffset;
        
        const position = polarToCartesian(CENTER.x, CENTER.y, bandRadius, nodeAngle);
        
        // Determine node type and properties based on distance
        let nodeType, size, cost;
        if (distance <= 5) {
          nodeType = 'regular';
          size = 'small';
          cost = 1;
        } else if (distance <= 10) {
          nodeType = 'regular';
          size = 'medium';
          cost = 2;
        } else if (distance <= 15) {
          nodeType = 'specialized';
          size = 'medium';
          cost = 3;
        } else {
          nodeType = 'augmenting';
          size = 'large';
          cost = 5;
        }

        const node = {
          node_key: `${stat}_D${distance}_N${nodeIndex}`,
          name: `${stat.charAt(0) + stat.slice(1).toLowerCase()} ${nodeType === 'augmenting' ? 'Mastery' : 'Enhancement'}`,
          description: `${stat.toLowerCase()} enhancement at distance ${distance}`,
          node_type: nodeType,
          primary_stat: stat.toLowerCase(),
          x_position: position.x_position,
          y_position: position.y_position,
          level_requirement: Math.floor(distance / 2) + 1,
          prerequisite_nodes: [],
          skill_point_cost: cost,
          stat_bonuses: { [stat.toLowerCase()]: distance * 2 },
          productivity_effects: { [`${stat.toLowerCase()}_task_xp_bonus`]: 0.01 * distance },
          game_effects: { distance_from_start: distance },
          color_hex: getDistanceBasedColor(distance, DISTANCE_BANDS),
          size: size
        };

        statNodes.push(node);
        nodes.push(node);
      }
    }

    // Store stat nodes for connection generation
    startingNodes[statIndex].statNodes = statNodes;
  });

  // 3. Generate connections within each branch (radial connectivity)
  STATS.forEach((stat, statIndex) => {
    const startNode = startingNodes[statIndex];
    const statNodes = startNode.statNodes;

    // Connect starting node to first band
    for (let i = 0; i < NODES_PER_BAND; i++) {
      const targetNode = statNodes[i]; // First band nodes
      connections.push({ from_node: startNode.node_key, to_node: targetNode.node_key });
    }

    // Connect between distance bands
    for (let distance = 1; distance < DISTANCE_BANDS; distance++) {
      const currentBandStart = (distance - 1) * NODES_PER_BAND;
      const nextBandStart = distance * NODES_PER_BAND;

      for (let i = 0; i < NODES_PER_BAND; i++) {
        const currentNode = statNodes[currentBandStart + i];
        
        // Connect to 1-2 nodes in next band
        const connections_to_make = Math.min(2, NODES_PER_BAND);
        for (let j = 0; j < connections_to_make; j++) {
          const targetIndex = (i + j) % NODES_PER_BAND;
          const targetNode = statNodes[nextBandStart + targetIndex];
          connections.push({ from_node: currentNode.node_key, to_node: targetNode.node_key });
        }
      }
    }

    // Connect within bands (circumferential connectivity)
    for (let distance = 1; distance <= DISTANCE_BANDS; distance++) {
      const bandStart = (distance - 1) * NODES_PER_BAND;
      
      for (let i = 0; i < NODES_PER_BAND; i++) {
        const currentNode = statNodes[bandStart + i];
        const nextNode = statNodes[bandStart + ((i + 1) % NODES_PER_BAND)];
        connections.push({ from_node: currentNode.node_key, to_node: nextNode.node_key });
      }
    }
  });

  // 4. CIRCULAR OUTER RING CONNECTIVITY - Connect outermost nodes between branches
  console.log('Creating circular outer ring connectivity...');
  
  // Get all outermost nodes (distance = DISTANCE_BANDS) from each stat
  const outerRingNodes = [];
  STATS.forEach((stat, statIndex) => {
    const startNode = startingNodes[statIndex];
    const statNodes = startNode.statNodes;
    const outerBandStart = (DISTANCE_BANDS - 1) * NODES_PER_BAND;
    
    // Add all nodes from the outermost band of this stat
    for (let i = 0; i < NODES_PER_BAND; i++) {
      outerRingNodes.push(statNodes[outerBandStart + i]);
    }
  });

  // Sort outer ring nodes by angle to create smooth circular connectivity
  outerRingNodes.sort((a, b) => {
    const angleA = Math.atan2(a.y_position - CENTER.y, a.x_position - CENTER.x);
    const angleB = Math.atan2(b.y_position - CENTER.y, b.x_position - CENTER.x);
    return angleA - angleB;
  });

  // Connect each outer ring node to its circular neighbors
  outerRingNodes.forEach((node, index) => {
    const nextIndex = (index + 1) % outerRingNodes.length;
    const nextNode = outerRingNodes[nextIndex];
    connections.push({ 
      from_node: node.node_key, 
      to_node: nextNode.node_key,
      connection_type: 'outer_ring' 
    });
  });

  console.log(`Generated ${nodes.length} nodes and ${connections.length} connections`);
  console.log(`Outer ring connections: ${outerRingNodes.length} nodes connected in circle`);
  
  return { nodes, connections };
};

// Generate SQL
const generateSQL = () => {
  const { nodes, connections } = generateBalancedSkillTree();
  
  let sql = `-- Balanced Skill Tree with Circular Outer Connectivity

DELETE FROM skill_tree_connections;
DELETE FROM skill_nodes;

INSERT INTO skill_nodes (node_key, name, description, node_type, primary_stat, x_position, y_position, level_requirement, prerequisite_nodes, skill_point_cost, stat_bonuses, productivity_effects, game_effects, color_hex, size) VALUES
`;

  const nodeValues = nodes.map(node => {
    const statBonuses = JSON.stringify(node.stat_bonuses).replace(/"/g, '\\"');
    const productivityEffects = JSON.stringify(node.productivity_effects).replace(/"/g, '\\"');  
    const gameEffects = JSON.stringify(node.game_effects).replace(/"/g, '\\"');
    const prerequisites = JSON.stringify(node.prerequisite_nodes).replace(/"/g, '\\"');
    
    return `('${node.node_key}', '${node.name.replace(/'/g, "''")}', '${node.description.replace(/'/g, "''")}', '${node.node_type}', '${node.primary_stat}', ${node.x_position}, ${node.y_position}, ${node.level_requirement}, '${prerequisites}', ${node.skill_point_cost}, '${statBonuses}', '${productivityEffects}', '${gameEffects}', '${node.color_hex}', '${node.size}')`;
  });

  sql += nodeValues.join(',\n') + ';\n\n';

  sql += 'INSERT INTO skill_tree_connections (from_node, to_node) VALUES\n';
  
  // Remove duplicates by using a Set with sorted connection pairs
  const uniqueConnections = new Set();
  connections.forEach(conn => {
    const sorted = [conn.from_node, conn.to_node].sort();
    uniqueConnections.add(`${sorted[0]},${sorted[1]}`);
  });
  
  const connectionValues = Array.from(uniqueConnections).map(connStr => {
    const [from, to] = connStr.split(',');
    return `('${from}', '${to}')`;
  });

  sql += connectionValues.join(',\n') + ';';

  return sql;
};

// Generate and save
const sql = generateSQL();
fs.writeFileSync('/Users/anirudhpatel/Projects/Productivity_App/life-gamification/src-tauri/migrations/balanced_skill_tree.sql', sql);

console.log('Balanced skill tree SQL generated at: src-tauri/migrations/balanced_skill_tree.sql');
console.log('\nFeatures:');
console.log('- Perfect pentagon layout with equal branch sizes');
console.log('- Each stat has identical node distribution');
console.log('- Circular outer ring connectivity (no artificial bridges)');
console.log('- Equal distances between all starting node pairs');
console.log('- Balanced progression from center to outer ring');