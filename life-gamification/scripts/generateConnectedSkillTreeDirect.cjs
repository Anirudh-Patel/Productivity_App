const fs = require('fs');
const path = require('path');

// POE-Style Connected Skill Tree Generator
const SKILL_TREE_CONFIG = {
  canvasSize: { width: 4000, height: 4000 },
  center: { x: 2000, y: 2000 },
  
  // Starting nodes at pentagon vertices - tighter pentagon with less empty space
  startingNodes: {
    strength: { angle: -90, radius: 300 }, // Top (12 o'clock)
    intelligence: { angle: -18, radius: 300 }, // Top-right (2 o'clock)
    luck: { angle: 54, radius: 300 }, // Bottom-right (4 o'clock)
    aura: { angle: 126, radius: 300 }, // Bottom-left (8 o'clock)
    will: { angle: 198, radius: 300 } // Top-left (10 o'clock)
  },
  
  // Maximum radius creates a large circle
  maxRadiusFromCenter: 1600,
  
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
const polarToCartesian = (angle, radius, centerX = 2000, centerY = 2000) => ({
  x: centerX + Math.cos(angle * Math.PI / 180) * radius,
  y: centerY + Math.sin(angle * Math.PI / 180) * radius
});

// Generate starting nodes in a central hub
const generateStartingNodes = () => {
  const nodes = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    const position = polarToCartesian(config.angle, config.radius);
    
    nodes.push({
      node_key: `START_${stat.toUpperCase()}`,
      name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Mastery`,
      description: `Starting node for ${stat} specialization`,
      node_type: 'start',
      primary_stat: stat,
      x_position: position.x,
      y_position: position.y,
      level_requirement: 1,
      prerequisite_nodes: [],
      skill_point_cost: 0,
      stat_bonuses: { [stat]: 5 },
      productivity_effects: { [`${stat}_task_xp_bonus`]: 0.1 },
      game_effects: {},
      color_hex: STAT_COLORS[stat],
      size: 'large'
    });
  });
  
  return nodes;
};

// Generate regular nodes in radiating paths that form a massive circle
const generateRegularNodes = () => {
  const nodes = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    // Create radiating paths from starting node towards the outer circle
    const pathCount = 8; // More paths for better coverage
    const nodesPerPath = Math.floor(300 / pathCount); // Distribute 300 nodes across paths
    
    for (let path = 0; path < pathCount; path++) {
      // Each path radiates outward from starting node
      const pathAngle = config.angle + (path - pathCount/2) * 8; // Spread paths around starting node
      
      for (let i = 1; i <= nodesPerPath; i++) {
        // Calculate distance from starting node radius to outer edge
        const progressAlongPath = i / nodesPerPath;
        const radius = config.radius + 100 + (progressAlongPath * (SKILL_TREE_CONFIG.maxRadiusFromCenter - config.radius - 100));
        
        // Add some curve to create more organic paths
        const angleOffset = Math.sin(progressAlongPath * Math.PI * 2) * 5;
        const nodeAngle = pathAngle + angleOffset;
        const position = polarToCartesian(nodeAngle, radius);
        
        const powerMultiplier = 1 + progressAlongPath * 3; // 1x to 4x power
        const statBonus = Math.round(2 * powerMultiplier);
        
        nodes.push({
          node_key: `${stat.toUpperCase()}_R_${path}_${String(i).padStart(2, '0')}`,
          name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Node`,
          description: `+${statBonus} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`,
          node_type: 'regular',
          primary_stat: stat,
          x_position: position.x,
          y_position: position.y,
          level_requirement: Math.max(1, Math.floor(progressAlongPath * 15)),
          prerequisite_nodes: [],
          skill_point_cost: 1,
          stat_bonuses: { [stat]: statBonus },
          productivity_effects: { [`${stat}_task_xp_bonus`]: 0.01 * powerMultiplier },
          game_effects: {},
          color_hex: STAT_COLORS[stat],
          size: 'small'
        });
      }
      
      // Add remaining nodes if any
      const remaining = 300 - (pathCount * nodesPerPath);
      if (path < remaining) {
        const i = nodesPerPath + 1;
        const progressAlongPath = i / (nodesPerPath + 1);
        const radius = config.radius + 100 + (progressAlongPath * (SKILL_TREE_CONFIG.maxRadiusFromCenter - config.radius - 100));
        const position = polarToCartesian(pathAngle, radius);
        const powerMultiplier = 1 + progressAlongPath * 3;
        const statBonus = Math.round(2 * powerMultiplier);
        
        nodes.push({
          node_key: `${stat.toUpperCase()}_R_${path}_${String(i).padStart(2, '0')}`,
          name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Node`,
          description: `+${statBonus} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`,
          node_type: 'regular',
          primary_stat: stat,
          x_position: position.x,
          y_position: position.y,
          level_requirement: Math.max(1, Math.floor(progressAlongPath * 15)),
          prerequisite_nodes: [],
          skill_point_cost: 1,
          stat_bonuses: { [stat]: statBonus },
          productivity_effects: { [`${stat}_task_xp_bonus`]: 0.01 * powerMultiplier },
          game_effects: {},
          color_hex: STAT_COLORS[stat],
          size: 'small'
        });
      }
    }
  });
  
  return nodes;
};

// Generate specialized nodes in clusters
const generateSpecializedNodes = () => {
  const nodes = [];
  
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
        const statBonus = Math.round(8 * powerMultiplier);
        
        nodes.push({
          node_key: `${stat.toUpperCase()}_S_${cluster}_${i}`,
          name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Focus`,
          description: `Specialized ${stat} enhancement`,
          node_type: 'specialized',
          primary_stat: stat,
          x_position: nodePosition.x,
          y_position: nodePosition.y,
          level_requirement: 5 + Math.floor(cluster / 4),
          prerequisite_nodes: [],
          skill_point_cost: 2,
          stat_bonuses: { [stat]: statBonus },
          productivity_effects: { [`${stat}_focus_bonus`]: 0.05 * powerMultiplier },
          game_effects: { specialized_unlock: true },
          color_hex: STAT_COLORS[stat],
          size: 'medium'
        });
      }
    }
  });
  
  return nodes;
};

// Generate augmenting nodes at the periphery
const generateAugmentingNodes = () => {
  const nodes = [];
  
  Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
    for (let i = 1; i <= 10; i++) {
      const radius = SKILL_TREE_CONFIG.maxRadiusFromCenter * (0.7 + (i / 10) * 0.3);
      const angle = config.angle + (i / 10 - 0.5) * 30;
      const position = polarToCartesian(angle, radius);
      
      const statBonus = Math.round(25 + i * 5);
      
      nodes.push({
        node_key: `${stat.toUpperCase()}_A_${String(i).padStart(2, '0')}`,
        name: `${stat.charAt(0).toUpperCase() + stat.slice(1)} Ascendancy`,
        description: `Ultimate ${stat} enhancement`,
        node_type: 'augmenting',
        primary_stat: stat,
        x_position: position.x,
        y_position: position.y,
        level_requirement: 20 + i * 3,
        prerequisite_nodes: [],
        skill_point_cost: 5,
        stat_bonuses: { [stat]: statBonus },
        productivity_effects: { [`${stat}_mastery_active`]: 1.0 },
        game_effects: { ultimate_unlock: true },
        color_hex: STAT_COLORS[stat],
        size: 'massive'
      });
    }
  });
  
  return nodes;
};

const distance = (node1, node2) => {
  return Math.sqrt(
    Math.pow(node1.x_position - node2.x_position, 2) +
    Math.pow(node1.y_position - node2.y_position, 2)
  );
};

const findNearbyNodes = (centerNode, allNodes, maxDistance) => {
  return allNodes.filter(node => {
    if (node.node_key === centerNode.node_key) return false;
    return distance(centerNode, node) <= maxDistance;
  });
};

const shouldConnect = (fromNode, toNode) => {
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

// Enhanced connection generation - NO direct connections between starting nodes
const generateConnections = (nodes) => {
  const connections = [];
  
  // Get starting nodes to avoid direct connections between them
  const startingNodes = nodes.filter(node => node.node_type === 'start');
  const startingNodeKeys = new Set(startingNodes.map(node => node.node_key));
  
  // Group nodes by their distance from center for circular connections
  const nodesByRadius = {};
  nodes.forEach(node => {
    const centerDistance = distance({ x_position: 2000, y_position: 2000 }, node);
    const radiusGroup = Math.floor(centerDistance / 100) * 100; // Group by 100px bands
    if (!nodesByRadius[radiusGroup]) nodesByRadius[radiusGroup] = [];
    nodesByRadius[radiusGroup].push(node);
  });
  
  // 1. Connect each node to nearest neighbors within same radius band (circular connections)
  Object.values(nodesByRadius).forEach(radiusNodes => {
    radiusNodes.forEach(node => {
      const sameRadiusNodes = radiusNodes.filter(n => {
        if (n.node_key === node.node_key) return false;
        
        // BLOCK: No direct connections between starting nodes
        if (startingNodeKeys.has(node.node_key) && startingNodeKeys.has(n.node_key)) {
          return false;
        }
        
        return true;
      });
      
      const nearest = sameRadiusNodes
        .sort((a, b) => distance(node, a) - distance(node, b))
        .slice(0, 2); // Connect to 2 nearest in same radius
      
      nearest.forEach(nearNode => {
        connections.push({
          from_node: node.node_key,
          to_node: nearNode.node_key,
          path_type: 'normal'
        });
      });
    });
  });
  
  // 2. Connect nodes radially (from center outward) 
  nodes.forEach(node => {
    const nearbyNodes = findNearbyNodes(node, nodes, 150);
    
    // Connect to nearest nodes regardless of stat (for cross-connections)
    const radialConnections = nearbyNodes
      .filter(n => {
        // BLOCK: No direct connections between starting nodes
        if (startingNodeKeys.has(node.node_key) && startingNodeKeys.has(n.node_key)) {
          return false;
        }
        
        const nodeDist = distance({ x_position: 2000, y_position: 2000 }, node);
        const nearDist = distance({ x_position: 2000, y_position: 2000 }, n);
        return Math.abs(nodeDist - nearDist) > 50; // Different radius bands
      })
      .sort((a, b) => distance(node, a) - distance(node, b))
      .slice(0, 2); // Connect to 2 nearest at different radius
    
    radialConnections.forEach(nearNode => {
      connections.push({
        from_node: node.node_key,
        to_node: nearNode.node_key,
        path_type: 'normal'
      });
    });
  });
  
  // 3. Add cross-stat connections at the outer ring (but not between starting nodes)
  const outerNodes = nodes.filter(node => {
    const centerDist = distance({ x_position: 2000, y_position: 2000 }, node);
    return centerDist > SKILL_TREE_CONFIG.maxRadiusFromCenter * 0.8;
  });
  
  outerNodes.forEach(node => {
    const crossStatNodes = outerNodes.filter(n => {
      if (n.primary_stat === node.primary_stat) return false;
      if (distance(node, n) >= 200) return false;
      
      // BLOCK: No direct connections between starting nodes
      if (startingNodeKeys.has(node.node_key) && startingNodeKeys.has(n.node_key)) {
        return false;
      }
      
      return true;
    });
    
    crossStatNodes.slice(0, 1).forEach(crossNode => {
      connections.push({
        from_node: node.node_key,
        to_node: crossNode.node_key,
        path_type: 'synergy'
      });
    });
  });
  
  // Remove duplicates and reverse duplicates
  const connectionSet = new Set();
  const uniqueConnections = connections.filter(conn => {
    const key1 = `${conn.from_node}->${conn.to_node}`;
    const key2 = `${conn.to_node}->${conn.from_node}`;
    
    if (connectionSet.has(key1) || connectionSet.has(key2)) {
      return false;
    }
    connectionSet.add(key1);
    return true;
  });
  
  return uniqueConnections;
};

// Calculate shortest distance from any starting node using BFS
const calculateDistanceFromStart = (nodes, connections) => {
  // Build adjacency list
  const graph = {};
  nodes.forEach(node => {
    graph[node.node_key] = [];
  });
  
  connections.forEach(conn => {
    graph[conn.from_node].push(conn.to_node);
    graph[conn.to_node].push(conn.from_node); // Bidirectional
  });
  
  const startingNodeKeys = nodes.filter(n => n.node_type === 'start').map(n => n.node_key);
  const distances = {};
  
  // Initialize all distances to infinity
  nodes.forEach(node => {
    distances[node.node_key] = Infinity;
  });
  
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

// Generate color based on distance from starting nodes
const getDistanceBasedColor = (distance, maxDistance) => {
  if (distance === 0) return '#FFFFFF'; // Starting nodes - White
  if (distance === Infinity) return '#000000'; // Unreachable - Black
  
  // Create a gradient from green (close) to red (far)
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  
  if (normalizedDistance <= 0.2) {
    // Green to Yellow (0-20% of max distance)
    const factor = normalizedDistance / 0.2;
    const r = Math.round(factor * 255);
    const g = 255;
    const b = 0;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else if (normalizedDistance <= 0.5) {
    // Yellow to Orange (20-50% of max distance)
    const factor = (normalizedDistance - 0.2) / 0.3;
    const r = 255;
    const g = Math.round(255 - (factor * 128));
    const b = 0;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else if (normalizedDistance <= 0.8) {
    // Orange to Red (50-80% of max distance)
    const factor = (normalizedDistance - 0.5) / 0.3;
    const r = 255;
    const g = Math.round(127 - (factor * 127));
    const b = 0;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else {
    // Red to Dark Red (80-100% of max distance)
    const factor = (normalizedDistance - 0.8) / 0.2;
    const r = Math.round(255 - (factor * 128));
    const g = 0;
    const b = Math.round(factor * 64);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
};

// Main generation function
const generateConnectedSkillTree = () => {
  const startingNodes = generateStartingNodes();
  const regularNodes = generateRegularNodes();
  const specializedNodes = generateSpecializedNodes();
  const augmentingNodes = generateAugmentingNodes();
  
  const allNodes = [...startingNodes, ...regularNodes, ...specializedNodes, ...augmentingNodes];
  const connections = generateConnections(allNodes);
  
  // Calculate distances from starting nodes
  const distances = calculateDistanceFromStart(allNodes, connections);
  const maxDistance = Math.max(...Object.values(distances).filter(d => d !== Infinity));
  
  console.log(`Calculated distances - Max distance from start: ${maxDistance}`);
  
  // Apply distance-based coloring
  allNodes.forEach(node => {
    const distance = distances[node.node_key];
    node.color_hex = getDistanceBasedColor(distance, maxDistance);
    
    // Add distance info for debugging
    node.distance_from_start = distance;
  });
  
  // Log distance distribution
  const distanceCounts = {};
  Object.values(distances).forEach(distance => {
    if (distance !== Infinity) {
      distanceCounts[distance] = (distanceCounts[distance] || 0) + 1;
    }
  });
  
  console.log('Distance distribution:', distanceCounts);
  
  // 3. ENSURE GLOBAL CONNECTIVITY - Add bridges between disconnected components
  const ensureConnectivity = (nodes, connections) => {
    // Build graph for connectivity testing
    const graph = {};
    nodes.forEach(node => graph[node.node_key] = []);
    connections.forEach(conn => {
      graph[conn.from_node].push(conn.to_node);
      graph[conn.to_node].push(conn.from_node);
    });
    
    // Find connected components using DFS
    const visited = new Set();
    const components = [];
    
    const dfs = (nodeKey, component) => {
      if (visited.has(nodeKey)) return;
      visited.add(nodeKey);
      component.push(nodeKey);
      
      (graph[nodeKey] || []).forEach(neighbor => {
        if (!visited.has(neighbor)) {
          dfs(neighbor, component);
        }
      });
    };
    
    nodes.forEach(node => {
      if (!visited.has(node.node_key)) {
        const component = [];
        dfs(node.node_key, component);
        components.push(component);
      }
    });
    
    console.log(`Found ${components.length} connected components:`);
    components.forEach((comp, i) => {
      console.log(`  Component ${i + 1}: ${comp.length} nodes`);
    });
    
    // If multiple components, add bridges between them
    while (components.length > 1) {
      const comp1 = components[0];
      const comp2 = components[1];
      
      // Find closest nodes between components
      let minDistance = Infinity;
      let bestConnection = null;
      
      comp1.forEach(node1Key => {
        const node1 = nodes.find(n => n.node_key === node1Key);
        comp2.forEach(node2Key => {
          const node2 = nodes.find(n => n.node_key === node2Key);
          
          // BLOCK: Still no direct starting node connections
          const startingKeys = new Set(['START_STRENGTH', 'START_INTELLIGENCE', 'START_LUCK', 'START_AURA', 'START_WILL']);
          if (startingKeys.has(node1Key) && startingKeys.has(node2Key)) {
            return;
          }
          
          const dist = distance(node1, node2);
          if (dist < minDistance) {
            minDistance = dist;
            bestConnection = { from: node1Key, to: node2Key };
          }
        });
      });
      
      if (bestConnection) {
        connections.push({
          from_node: bestConnection.from,
          to_node: bestConnection.to,
          path_type: 'bridge'
        });
        
        console.log(`Added bridge: ${bestConnection.from} <-> ${bestConnection.to} (distance: ${Math.round(minDistance)})`);
        
        // Merge components and rebuild graph
        const mergedComponent = [...comp1, ...comp2];
        components.splice(0, 2, mergedComponent);
        
        // Rebuild graph with new connection
        graph[bestConnection.from].push(bestConnection.to);
        graph[bestConnection.to].push(bestConnection.from);
      } else {
        console.warn('Could not find valid bridge connection');
        break;
      }
    }
    
    return connections;
  };
  
  const connectivityResult = ensureConnectivity(allNodes, connections);
  connections.length = 0; // Clear original array
  connections.push(...connectivityResult); // Add all connections back
  
  console.log(`Generated ${allNodes.length} nodes and ${connections.length} connections`);
  
  return { nodes: allNodes, connections };
};

// Export SQL generation function
const generateConnectedSkillTreeSQL = () => {
  const { nodes, connections } = generateConnectedSkillTree();
  
  let sql = "-- Connected Skill Tree Data\n\n";
  
  // Clear existing data
  sql += "DELETE FROM skill_tree_connections;\n";
  sql += "DELETE FROM skill_nodes;\n\n";
  
  // Insert nodes
  sql += "INSERT INTO skill_nodes (node_key, name, description, node_type, primary_stat, x_position, y_position, level_requirement, prerequisite_nodes, skill_point_cost, stat_bonuses, productivity_effects, game_effects, color_hex, size) VALUES\n";
  
  const nodeValues = nodes.map(node => {
    // Add distance info to game_effects for debugging
    const gameEffectsWithDistance = {
      ...node.game_effects,
      distance_from_start: node.distance_from_start || 0
    };
    
    return `('${node.node_key}', '${node.name.replace(/'/g, "''")}', '${node.description.replace(/'/g, "''")}', '${node.node_type}', '${node.primary_stat}', ${node.x_position}, ${node.y_position}, ${node.level_requirement}, '${JSON.stringify(node.prerequisite_nodes)}', ${node.skill_point_cost}, '${JSON.stringify(node.stat_bonuses)}', '${JSON.stringify(node.productivity_effects)}', '${JSON.stringify(gameEffectsWithDistance)}', '${node.color_hex}', '${node.size}')`;
  }).join(',\n');
  
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

// Run the generator
console.log('Generating connected skill tree...');
const sql = generateConnectedSkillTreeSQL();

// Write to migration file
const migrationPath = path.resolve(__dirname, '../src-tauri/migrations/20240906000003_connected_skill_tree.sql');
fs.writeFileSync(migrationPath, sql);

console.log(`Generated connected skill tree SQL at: ${migrationPath}`);
console.log('SQL preview:');
console.log(sql.substring(0, 500) + '...');