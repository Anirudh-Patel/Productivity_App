// Generate skill tree with 5 spiral arms per stat: inward/outward flow pattern
const fs = require('fs');

// Configuration
const CENTER = { x: 2000, y: 2000 };
const STATS = ['STRENGTH', 'INTELLIGENCE', 'LUCK', 'AURA', 'WILL'];
const STARTING_RADIUS = 300;
const OUTER_RING_RADIUS = 1400;
const NODES_PER_ARM = 80; // Nodes along each spiral arm
const SPIRAL_TURNS = 2.5; // How many turns each spiral makes

// Utility functions
const distance = (a, b) => Math.sqrt(Math.pow(a.x_position - b.x_position, 2) + Math.pow(a.y_position - b.y_position, 2));

const polarToCartesian = (centerX, centerY, radius, angleInRadians) => ({
  x_position: centerX + radius * Math.cos(angleInRadians),
  y_position: centerY + radius * Math.sin(angleInRadians)
});

const getDistanceBasedColor = (distance, maxDistance) => {
  if (distance === 0) return '#FFFFFF';
  if (distance === Infinity) return '#000000';
  
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  
  if (normalizedDistance <= 0.2) {
    const factor = normalizedDistance / 0.2;
    const r = Math.round(factor * 255);
    return `#${r.toString(16).padStart(2, '0')}ff00`;
  } else if (normalizedDistance <= 0.5) {
    const factor = (normalizedDistance - 0.2) / 0.3;
    const r = 255;
    const g = Math.round(255 - (factor * 128));
    return `#ff${g.toString(16).padStart(2, '0')}00`;
  } else if (normalizedDistance <= 0.8) {
    const factor = (normalizedDistance - 0.5) / 0.3;
    const r = 255;
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

const generateSpiralArm = (statIndex, armIndex, isOutward) => {
  const nodes = [];
  const baseAngle = (statIndex * 2 * Math.PI) / STATS.length - (Math.PI / 2);
  
  // Each stat gets 5 arms spread across its sector
  const sectorWidth = (2 * Math.PI) / STATS.length;
  const armSpacing = sectorWidth / 6; // Divide sector into 6 parts, use middle 5
  const armAngle = baseAngle + (armIndex - 2) * armSpacing; // Arms -2, -1, 0, 1, 2 from center
  
  for (let i = 0; i < NODES_PER_ARM; i++) {
    const t = i / (NODES_PER_ARM - 1); // Progress along arm (0 to 1)
    
    let radius, angle;
    
    if (isOutward) {
      // Arms 2, 3, 4: Flow outward from starting pentagon to outer ring
      radius = STARTING_RADIUS + t * (OUTER_RING_RADIUS - STARTING_RADIUS);
      angle = armAngle + t * SPIRAL_TURNS * 2 * Math.PI;
    } else {
      // Arms 1, 5: Flow inward from outer ring to starting pentagon  
      radius = OUTER_RING_RADIUS - t * (OUTER_RING_RADIUS - STARTING_RADIUS);
      angle = armAngle - t * SPIRAL_TURNS * 2 * Math.PI; // Reverse spiral direction
    }
    
    const position = polarToCartesian(CENTER.x, CENTER.y, radius, angle);
    
    // Node properties based on radius
    const normalizedRadius = (radius - STARTING_RADIUS) / (OUTER_RING_RADIUS - STARTING_RADIUS);
    
    let nodeType, size, cost;
    if (normalizedRadius < 0.3) {
      nodeType = 'regular';
      size = 'small';
      cost = 1;
    } else if (normalizedRadius < 0.6) {
      nodeType = 'regular';
      size = 'medium'; 
      cost = Math.random() < 0.3 ? 2 : 1;
    } else if (normalizedRadius < 0.85) {
      nodeType = 'specialized';
      size = 'medium';
      cost = Math.random() < 0.5 ? 3 : 2;
    } else {
      nodeType = 'augmenting';
      size = Math.random() < 0.3 ? 'massive' : 'large';
      cost = Math.random() < 0.4 ? 5 : 3;
    }

    const stat = STATS[statIndex];
    const flowDirection = isOutward ? 'OUT' : 'IN';
    
    const node = {
      node_key: `${stat}_ARM${armIndex}_${flowDirection}_${String(i).padStart(2, '0')}`,
      name: `${stat.charAt(0) + stat.slice(1).toLowerCase()} ${nodeType === 'augmenting' ? 'Mastery' : 'Enhancement'}`,
      description: `${stat.toLowerCase()} spiral arm ${armIndex} flowing ${isOutward ? 'outward' : 'inward'}`,
      node_type: nodeType,
      primary_stat: stat.toLowerCase(),
      x_position: position.x_position,
      y_position: position.y_position,
      level_requirement: Math.floor(normalizedRadius * 25) + 1,
      prerequisite_nodes: [],
      skill_point_cost: cost,
      stat_bonuses: { [stat.toLowerCase()]: Math.ceil(normalizedRadius * 15) + 1 },
      productivity_effects: { [`${stat.toLowerCase()}_task_xp_bonus`]: 0.01 + (normalizedRadius * 0.04) },
      game_effects: { 
        arm_index: armIndex, 
        flow_direction: flowDirection,
        arm_progress: t,
        radius_factor: normalizedRadius
      },
      color_hex: '#PLACEHOLDER', // Will be calculated after distance calculation
      size: size
    };

    nodes.push(node);
  }
  
  return nodes;
};

const generateSpiralArmsSkillTree = () => {
  const allNodes = [];
  const connections = [];
  const statData = [];

  console.log('Generating 5-spiral-arm skill tree with inward/outward flow...');

  // 1. Generate starting nodes
  STATS.forEach((stat, statIndex) => {
    const angle = (statIndex * 2 * Math.PI) / STATS.length - (Math.PI / 2);
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
    
    allNodes.push(startNode);
    
    // Generate 5 spiral arms for this stat
    const arms = {
      arm1: generateSpiralArm(statIndex, 1, false), // Inward flow
      arm2: generateSpiralArm(statIndex, 2, true),  // Outward flow  
      arm3: generateSpiralArm(statIndex, 3, true),  // Outward flow
      arm4: generateSpiralArm(statIndex, 4, true),  // Outward flow
      arm5: generateSpiralArm(statIndex, 5, false)  // Inward flow
    };
    
    // Add all arm nodes to main collection
    Object.values(arms).forEach(arm => {
      arm.forEach(node => allNodes.push(node));
    });
    
    statData.push({
      startNode,
      arms,
      statIndex
    });
  });

  // 2. Generate connections within each stat
  statData.forEach(({ startNode, arms }) => {
    // Starting node connects to outward-flowing arms (2, 3, 4)
    [arms.arm2, arms.arm3, arms.arm4].forEach(arm => {
      connections.push({ 
        from_node: startNode.node_key, 
        to_node: arm[0].node_key,
        connection_type: 'start_to_arm'
      });
    });
    
    // Connect nodes within each arm
    Object.values(arms).forEach(arm => {
      for (let i = 0; i < arm.length - 1; i++) {
        connections.push({
          from_node: arm[i].node_key,
          to_node: arm[i + 1].node_key,
          connection_type: 'within_arm'
        });
      }
    });
    
    // At outer ring: Connect arm ends (2→3→4, and 2→1, 4→5)
    const outerEnds = {
      arm1: arms.arm1[0], // Inward arms start at outer ring
      arm2: arms.arm2[arms.arm2.length - 1], // Outward arms end at outer ring
      arm3: arms.arm3[arms.arm3.length - 1],
      arm4: arms.arm4[arms.arm4.length - 1], 
      arm5: arms.arm5[0]
    };
    
    // Chain connections at outer ring: 2→3→4
    connections.push({ 
      from_node: outerEnds.arm2.node_key, 
      to_node: outerEnds.arm3.node_key,
      connection_type: 'outer_ring_chain'
    });
    connections.push({ 
      from_node: outerEnds.arm3.node_key, 
      to_node: outerEnds.arm4.node_key,
      connection_type: 'outer_ring_chain' 
    });
    
    // Branch connections: 2→1, 4→5 
    connections.push({ 
      from_node: outerEnds.arm2.node_key, 
      to_node: outerEnds.arm1.node_key,
      connection_type: 'outer_to_inward'
    });
    connections.push({ 
      from_node: outerEnds.arm4.node_key, 
      to_node: outerEnds.arm5.node_key,
      connection_type: 'outer_to_inward'
    });
  });

  // 3. Cross-stat connections: Each stat's arm 5 connects to next stat's arm 1
  statData.forEach(({ arms }, index) => {
    const nextIndex = (index + 1) % STATS.length;
    const nextStatArms = statData[nextIndex].arms;
    
    // Arm 5 end (inner ring) connects to next stat's arm 1 end (inner ring)
    const arm5End = arms.arm5[arms.arm5.length - 1]; // Inner ring end
    const nextArm1End = nextStatArms.arm1[nextStatArms.arm1.length - 1]; // Inner ring end
    
    connections.push({
      from_node: arm5End.node_key,
      to_node: nextArm1End.node_key,
      connection_type: 'cross_stat_bridge'
    });
  });

  // 4. Calculate distances and assign colors
  console.log('Calculating distances from starting nodes...');
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
  console.log(`Max distance from start: ${maxDistance}`);
  console.log('Spiral arm pattern: 5 arms per stat (2 inward, 3 outward)');
  
  return { nodes: allNodes, connections };
};

// Generate SQL
const generateSQL = () => {
  const { nodes, connections } = generateSpiralArmsSkillTree();
  
  let sql = `-- 5-Spiral-Arms Skill Tree with Inward/Outward Flow Pattern

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
fs.writeFileSync('/Users/anirudhpatel/Projects/Productivity_App/life-gamification/src-tauri/migrations/spiral_arms_skill_tree.sql', sql);

console.log('5-Spiral-Arms skill tree generated at: src-tauri/migrations/spiral_arms_skill_tree.sql');
console.log('\nPattern Summary:');
console.log('- 5 spiral arms per stat (elegant spiral shapes)');
console.log('- Arms 2,3,4: Outward flow (start→outer ring)');
console.log('- Arms 1,5: Inward flow (outer ring→inner ring)');
console.log('- Outer ring: 2→3→4 chain, 2→1 & 4→5 branches');
console.log('- Cross-stat: arm5→nextStat.arm1 bridges');
console.log('- Beautiful dual-flow spiral pattern!');