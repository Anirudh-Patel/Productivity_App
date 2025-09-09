// Rebuild skill tree connections to follow clean progression paths
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

console.log('Rebuilding skill tree connections...\n');

// Clear existing connections
console.log('Clearing existing connections...');
db.exec('DELETE FROM skill_tree_connections');

// Get all nodes grouped by stat and distance
const nodes = db.prepare('SELECT * FROM skill_nodes ORDER BY primary_stat, distance_from_start, node_key').all();

// Group nodes by stat and distance
const nodesByStatAndDistance = {};
nodes.forEach(node => {
  const stat = node.primary_stat;
  const dist = node.distance_from_start || 0;
  
  if (!nodesByStatAndDistance[stat]) {
    nodesByStatAndDistance[stat] = {};
  }
  if (!nodesByStatAndDistance[stat][dist]) {
    nodesByStatAndDistance[stat][dist] = [];
  }
  
  nodesByStatAndDistance[stat][dist].push(node);
});

// Helper function to add connection
const insertConnection = db.prepare('INSERT OR IGNORE INTO skill_tree_connections (from_node, to_node) VALUES (?, ?)');
function addConnection(from, to) {
  insertConnection.run(from, to);
  insertConnection.run(to, from); // Bidirectional for navigation
}

let totalConnections = 0;

// Process each stat branch
Object.keys(nodesByStatAndDistance).forEach(stat => {
  console.log(`Building ${stat} branch connections...`);
  
  const distances = Object.keys(nodesByStatAndDistance[stat]).map(Number).sort((a, b) => a - b);
  let branchConnections = 0;
  
  for (let i = 0; i < distances.length - 1; i++) {
    const currentDistance = distances[i];
    const nextDistance = distances[i + 1];
    
    const currentNodes = nodesByStatAndDistance[stat][currentDistance];
    const nextNodes = nodesByStatAndDistance[stat][nextDistance];
    
    // Connect current distance nodes to next distance nodes
    // Strategy: Connect each node to the 1-3 closest nodes in the next ring
    
    nextNodes.forEach(nextNode => {
      // Find the closest 1-2 nodes from the previous ring
      const distances = currentNodes.map(currentNode => {
        const dx = nextNode.x_position - currentNode.x_position;
        const dy = nextNode.y_position - currentNode.y_position;
        return {
          node: currentNode,
          distance: Math.sqrt(dx * dx + dy * dy)
        };
      }).sort((a, b) => a.distance - b.distance);
      
      // Connect to the closest node, and sometimes the second closest
      addConnection(distances[0].node.node_key, nextNode.node_key);
      branchConnections++;
      
      // Add second connection if nodes are reasonably close and not too many connections already
      if (distances.length > 1 && 
          distances[1].distance < distances[0].distance * 1.5 && 
          Math.random() < 0.3) {
        addConnection(distances[1].node.node_key, nextNode.node_key);
        branchConnections++;
      }
    });
  }
  
  // Also connect adjacent nodes within the same ring (for some rings)
  distances.forEach(distance => {
    const nodesAtDistance = nodesByStatAndDistance[stat][distance];
    
    if (nodesAtDistance.length > 1) {
      // Sort nodes by angle to create circular connections
      const centerX = 3000, centerY = 3000;
      nodesAtDistance.sort((a, b) => {
        const angleA = Math.atan2(a.y_position - centerY, a.x_position - centerX);
        const angleB = Math.atan2(b.y_position - centerY, b.x_position - centerX);
        return angleA - angleB;
      });
      
      // Connect adjacent nodes in the ring (but not all - only some for variety)
      for (let j = 0; j < nodesAtDistance.length; j++) {
        const currentNode = nodesAtDistance[j];
        const nextNode = nodesAtDistance[(j + 1) % nodesAtDistance.length];
        
        // Only connect some adjacent nodes to avoid too much clutter
        if (Math.random() < 0.4) {
          addConnection(currentNode.node_key, nextNode.node_key);
          branchConnections++;
        }
      }
    }
  });
  
  console.log(`  Added ${branchConnections} connections for ${stat}`);
  totalConnections += branchConnections;
});

// Add selective cross-branch connections (bridges) - only at certain distances
console.log('\nAdding strategic cross-branch connections...');

const bridgeDistances = [8, 12, 16, 20]; // Add bridges at these distances
let bridgeConnections = 0;

bridgeDistances.forEach(distance => {
  const stats = ['strength', 'intelligence', 'luck', 'aura', 'will'];
  
  // Get representative nodes from each stat at this distance
  const bridgeNodes = [];
  stats.forEach(stat => {
    if (nodesByStatAndDistance[stat] && nodesByStatAndDistance[stat][distance]) {
      const nodes = nodesByStatAndDistance[stat][distance];
      if (nodes.length > 0) {
        // Pick a node that's roughly in the middle of the stat's spread at this distance
        const middleIndex = Math.floor(nodes.length / 2);
        bridgeNodes.push(nodes[middleIndex]);
      }
    }
  });
  
  // Connect adjacent stats in pentagon order
  for (let i = 0; i < bridgeNodes.length; i++) {
    const currentBridge = bridgeNodes[i];
    const nextBridge = bridgeNodes[(i + 1) % bridgeNodes.length];
    
    // Only add bridge if nodes are reasonably close
    const dx = currentBridge.x_position - nextBridge.x_position;
    const dy = currentBridge.y_position - nextBridge.y_position;
    const bridgeDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (bridgeDistance < 800) { // Reasonable bridge length
      addConnection(currentBridge.node_key, nextBridge.node_key);
      bridgeConnections++;
    }
  }
});

totalConnections += bridgeConnections;
console.log(`Added ${bridgeConnections} cross-branch bridges`);

// Verify connectivity
console.log('\nVerifying tree connectivity...');
const finalConnectionCount = db.prepare('SELECT COUNT(*) as count FROM skill_tree_connections').get().count;
console.log(`Total connections in database: ${finalConnectionCount}`);
console.log(`Connections added by script: ${totalConnections * 2}`); // Each connection added twice (bidirectional)

// Show connection statistics by node type
const stats = db.prepare(`
  SELECT 
    n.node_type,
    COUNT(DISTINCT c.from_node) as nodes_with_connections,
    COUNT(*) as total_connections,
    CAST(COUNT(*) AS FLOAT) / COUNT(DISTINCT c.from_node) as avg_connections_per_node
  FROM skill_tree_connections c
  JOIN skill_nodes n ON c.from_node = n.node_key
  GROUP BY n.node_type
  ORDER BY total_connections DESC
`).all();

console.log('\nConnection statistics by node type:');
stats.forEach(s => {
  console.log(`  ${s.node_type}: ${s.nodes_with_connections} nodes, avg ${s.avg_connections_per_node.toFixed(1)} connections each`);
});

// Check for isolated nodes
const isolatedNodes = db.prepare(`
  SELECT node_key, primary_stat, distance_from_start
  FROM skill_nodes
  WHERE node_key NOT IN (SELECT DISTINCT from_node FROM skill_tree_connections)
  ORDER BY primary_stat, distance_from_start
  LIMIT 10
`).all();

if (isolatedNodes.length > 0) {
  console.log(`\n⚠️ Found ${isolatedNodes.length} isolated nodes:`);
  isolatedNodes.forEach(n => {
    console.log(`  ${n.node_key} (${n.primary_stat}, distance ${n.distance_from_start})`);
  });
} else {
  console.log('\n✅ No isolated nodes found');
}

db.close();
console.log('\n✅ Skill tree connections rebuilt with clean paths!');