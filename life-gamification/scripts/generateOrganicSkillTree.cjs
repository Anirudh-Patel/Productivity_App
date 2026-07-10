// Generate organic skill tree with constellation feel + circular outer connectivity
const fs = require('fs');

// Configuration  
const CENTER = { x: 2000, y: 2000 };
const STATS = ['STRENGTH', 'INTELLIGENCE', 'LUCK', 'AURA', 'WILL'];
const MAX_RADIUS = 1500; // Maximum distance from center
const STARTING_RADIUS = 300;
const NODES_PER_STAT = 400; // Approximate nodes per stat branch

// Utility functions
const distance = (a, b) => Math.sqrt(Math.pow(a.x_position - b.x_position, 2) + Math.pow(a.y_position - b.y_position, 2));

const polarToCartesian = (centerX, centerY, radius, angleInRadians) => ({
  x_position: centerX + radius * Math.cos(angleInRadians),
  y_position: centerY + radius * Math.sin(angleInRadians)
});

// Add organic randomness to positions
const addJitter = (position, radius, maxJitter = 40) => {
  const jitterAmount = Math.min(maxJitter, radius * 0.1);
  return {
    x_position: position.x_position + (Math.random() - 0.5) * jitterAmount * 2,
    y_position: position.y_position + (Math.random() - 0.5) * jitterAmount * 2
  };
};

const getDistanceBasedColor = (distance, maxDistance) => {
  if (distance === 0) return '#FFFFFF';
  if (distance === Infinity) return '#000000';
  
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  
  if (normalizedDistance <= 0.2) {
    const factor = normalizedDistance / 0.2;
    const r = Math.round(factor * 255);
    const g = 255;
    const b = 0;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else if (normalizedDistance <= 0.5) {
    const factor = (normalizedDistance - 0.2) / 0.3;
    const r = 255;
    const g = Math.round(255 - (factor * 128));
    const b = 0;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else if (normalizedDistance <= 0.8) {
    const factor = (normalizedDistance - 0.5) / 0.3;
    const r = 255;
    const g = Math.round(127 - (factor * 127));
    const b = 0;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else {
    const factor = (normalizedDistance - 0.8) / 0.2;
    const r = Math.round(255 - (factor * 100));
    const g = Math.round(factor * 35);
    const b = Math.round(factor * 49);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
};

const generateOrganicSkillTree = () => {
  const allNodes = [];
  const connections = [];

  console.log('Generating organic constellation-style skill tree...');

  // 1. Generate starting nodes in pentagon (but with slight organic offset)
  const startingNodes = [];
  STATS.forEach((stat, index) => {
    const baseAngle = (index * 2 * Math.PI) / STATS.length - (Math.PI / 2);
    const angle = baseAngle + (Math.random() - 0.5) * 0.3; // Add organic variation
    const radius = STARTING_RADIUS + (Math.random() - 0.5) * 60; // Vary radius slightly
    
    const position = polarToCartesian(CENTER.x, CENTER.y, radius, angle);
    
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
    allNodes.push(startNode);
  });

  // 2. Generate organic spiral branches for each stat
  STATS.forEach((stat, statIndex) => {
    const startAngle = (statIndex * 2 * Math.PI) / STATS.length - (Math.PI / 2);
    const statNodes = [];

    // Create organic spiral pattern
    for (let i = 0; i < NODES_PER_STAT; i++) {
      // Spiral parameters with organic variation
      const t = i / NODES_PER_STAT; // Progress along spiral (0 to 1)
      const spiralTurns = 3 + Math.random() * 2; // 3-5 spiral turns
      const angle = startAngle + t * spiralTurns * 2 * Math.PI;
      const radius = STARTING_RADIUS + t * MAX_RADIUS;
      
      // Add spiral arm variation
      const armWidth = Math.PI / 6; // Base arm width
      const armVariation = (Math.random() - 0.5) * armWidth * (0.5 + t); // Wider at outer edge
      const finalAngle = angle + armVariation;
      
      // Add radius variation for organic feel
      const radiusVariation = (Math.random() - 0.5) * 100 * t; // More variation at outer edge
      const finalRadius = Math.max(STARTING_RADIUS, radius + radiusVariation);
      
      const basePosition = polarToCartesian(CENTER.x, CENTER.y, finalRadius, finalAngle);
      const position = addJitter(basePosition, finalRadius, 30);
      
      // Node properties based on distance from center
      const distanceFromCenter = Math.sqrt(Math.pow(position.x_position - CENTER.x, 2) + Math.pow(position.y_position - CENTER.y, 2));
      const normalizedDistance = distanceFromCenter / (STARTING_RADIUS + MAX_RADIUS);
      
      let nodeType, size, cost;
      if (normalizedDistance < 0.25) {
        nodeType = 'regular';
        size = 'small';
        cost = 1;
      } else if (normalizedDistance < 0.5) {
        nodeType = 'regular'; 
        size = 'medium';
        cost = Math.random() < 0.3 ? 2 : 1;
      } else if (normalizedDistance < 0.75) {
        nodeType = 'specialized';
        size = 'medium';
        cost = Math.random() < 0.6 ? 3 : 2;
      } else {
        nodeType = 'augmenting';
        size = Math.random() < 0.2 ? 'massive' : 'large';
        cost = Math.random() < 0.4 ? 5 : 3;
      }

      const node = {
        node_key: `${stat}_R_${Math.floor(i/20)}_${String(i).padStart(2, '0')}`,
        name: `${stat.charAt(0) + stat.slice(1).toLowerCase()} ${nodeType === 'augmenting' ? 'Mastery' : 'Enhancement'}`,
        description: `${stat.toLowerCase()} enhancement in the spiral constellation`,
        node_type: nodeType,
        primary_stat: stat.toLowerCase(),
        x_position: position.x_position,
        y_position: position.y_position,
        level_requirement: Math.floor(normalizedDistance * 30) + 1,
        prerequisite_nodes: [],
        skill_point_cost: cost,
        stat_bonuses: { [stat.toLowerCase()]: Math.ceil(normalizedDistance * 20) + 1 },
        productivity_effects: { [`${stat.toLowerCase()}_task_xp_bonus`]: 0.01 + (normalizedDistance * 0.05) },
        game_effects: { spiral_position: i, distance_factor: normalizedDistance },
        color_hex: '#PLACEHOLDER', // Will be calculated after distance calculation
        size: size
      };

      statNodes.push(node);
      allNodes.push(node);
    }

    // Store for connection generation
    startingNodes[statIndex].statNodes = statNodes;
  });

  // 3. Generate organic connections within branches
  startingNodes.forEach((startNode, statIndex) => {
    const statNodes = startNode.statNodes;
    
    // Connect starting node to nearby nodes
    const nearbyNodes = statNodes
      .slice(0, 8) // First few nodes
      .sort((a, b) => distance(startNode, a) - distance(startNode, b))
      .slice(0, 3);
    
    nearbyNodes.forEach(node => {
      connections.push({ from_node: startNode.node_key, to_node: node.node_key });
    });

    // Create organic spiral connections
    statNodes.forEach((node, index) => {
      // Connect to nearby nodes in spiral
      const maxConnectionDistance = 200 + (Math.random() * 100);
      const possibleConnections = statNodes
        .filter((other, otherIndex) => {
          if (otherIndex === index) return false;
          const dist = distance(node, other);
          return dist <= maxConnectionDistance;
        })
        .sort((a, b) => distance(node, a) - distance(node, b))
        .slice(0, 2 + Math.floor(Math.random() * 2)); // 2-3 connections per node

      possibleConnections.forEach(target => {
        connections.push({ from_node: node.node_key, to_node: target.node_key });
      });
    });
  });

  // 4. CIRCULAR OUTER RING - Connect outermost nodes between branches
  console.log('Creating circular outer constellation connectivity...');
  
  // Find nodes in outer ring (furthest from center)
  const allDistancesFromCenter = allNodes
    .filter(n => n.node_type !== 'start')
    .map(n => ({
      node: n,
      distanceFromCenter: Math.sqrt(Math.pow(n.x_position - CENTER.x, 2) + Math.pow(n.y_position - CENTER.y, 2))
    }));
  
  // Get nodes in outer 20% of the tree
  allDistancesFromCenter.sort((a, b) => b.distanceFromCenter - a.distanceFromCenter);
  const outerRingSize = Math.floor(allDistancesFromCenter.length * 0.15); // Outer 15%
  const outerRingNodes = allDistancesFromCenter.slice(0, outerRingSize).map(item => item.node);

  // Sort by angle to create circular connectivity
  outerRingNodes.sort((a, b) => {
    const angleA = Math.atan2(a.y_position - CENTER.y, a.x_position - CENTER.x);
    const angleB = Math.atan2(b.y_position - CENTER.y, b.x_position - CENTER.x);
    return angleA - angleB;
  });

  // Connect outer ring nodes to form constellation bridges
  outerRingNodes.forEach((node, index) => {
    // Connect to next 1-2 nodes in ring
    for (let offset = 1; offset <= Math.min(2, outerRingNodes.length - 1); offset++) {
      const targetIndex = (index + offset) % outerRingNodes.length;
      const targetNode = outerRingNodes[targetIndex];
      
      // Only connect if they're from different stat branches
      if (node.primary_stat !== targetNode.primary_stat) {
        connections.push({ 
          from_node: node.node_key, 
          to_node: targetNode.node_key,
          connection_type: 'constellation_bridge'
        });
      }
    }
  });

  // 5. Calculate distances and assign colors
  console.log('Calculating distances and assigning colors...');
  const calculateDistanceFromStart = (nodes, connections) => {
    const graph = {};
    nodes.forEach(node => graph[node.node_key] = []);
    connections.forEach(conn => {
      graph[conn.from_node] = graph[conn.from_node] || [];
      graph[conn.to_node] = graph[conn.to_node] || [];
      graph[conn.from_node].push(conn.to_node);
      graph[conn.to_node].push(conn.from_node);
    });
    
    const startingNodeKeys = nodes.filter(n => n.node_type === 'start').map(n => n.node_key);
    const distances = {};
    
    // Initialize distances
    nodes.forEach(node => distances[node.node_key] = Infinity);
    
    // Multi-source BFS from all starting nodes
    const queue = [];
    startingNodeKeys.forEach(startKey => {
      distances[startKey] = 0;
      queue.push({ nodeKey: startKey, distance: 0 });
    });
    
    while (queue.length > 0) {
      const { nodeKey, distance } = queue.shift();
      
      if (graph[nodeKey]) {
        graph[nodeKey].forEach(neighborKey => {
          const newDistance = distance + 1;
          if (newDistance < distances[neighborKey]) {
            distances[neighborKey] = newDistance;
            queue.push({ nodeKey: neighborKey, distance: newDistance });
          }
        });
      }
    }
    
    return distances;
  };

  const distances = calculateDistanceFromStart(allNodes, connections);
  const maxDistance = Math.max(...Object.values(distances).filter(d => d !== Infinity));
  
  // Assign colors based on distance
  allNodes.forEach(node => {
    const nodeDistance = distances[node.node_key];
    node.color_hex = getDistanceBasedColor(nodeDistance, maxDistance);
    node.game_effects.distance_from_start = nodeDistance;
  });

  console.log(`Generated ${allNodes.length} nodes and ${connections.length} connections`);
  console.log(`Outer ring connections: ${outerRingNodes.length} nodes in constellation bridges`);
  console.log(`Max distance from start: ${maxDistance}`);
  
  return { nodes: allNodes, connections };
};

// Generate SQL
const generateSQL = () => {
  const { nodes, connections } = generateOrganicSkillTree();
  
  let sql = `-- Organic Constellation Skill Tree with Circular Outer Connectivity

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
  
  // Remove duplicates
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
fs.writeFileSync('/Users/anirudhpatel/Projects/Productivity_App/life-gamification/src-tauri/migrations/organic_skill_tree.sql', sql);

console.log('Organic constellation skill tree generated at: src-tauri/migrations/organic_skill_tree.sql');
console.log('\nFeatures:');
console.log('- Organic spiral constellation feel');
console.log('- Natural variation and jitter');
console.log('- Circular outer ring "constellation bridges"'); 
console.log('- Beautiful organic connectivity');
console.log('- Maintains spiral/constellation aesthetic');