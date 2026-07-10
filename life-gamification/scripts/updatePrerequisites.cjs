// Update node prerequisites to match the new connection structure
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

console.log('Updating skill node prerequisites...\n');

// Get all nodes
const nodes = db.prepare('SELECT * FROM skill_nodes ORDER BY primary_stat, distance_from_start').all();

// Build a map of nodes by key
const nodeMap = new Map();
nodes.forEach(node => {
  nodeMap.set(node.node_key, node);
});

// Get all connections
const connections = db.prepare('SELECT * FROM skill_tree_connections').all();

// Build prerequisite mapping based on connections and distance
const prerequisiteMap = new Map();

// Initialize empty prerequisites for all nodes
nodes.forEach(node => {
  prerequisiteMap.set(node.node_key, new Set());
});

// For each node, find its prerequisites (nodes that are closer to start and connected)
connections.forEach(conn => {
  const fromNode = nodeMap.get(conn.from_node);
  const toNode = nodeMap.get(conn.to_node);
  
  if (!fromNode || !toNode) return;
  
  // Only add as prerequisite if it's in the same stat branch and closer to start
  if (fromNode.primary_stat === toNode.primary_stat) {
    if (fromNode.distance_from_start < toNode.distance_from_start) {
      // fromNode is a prerequisite for toNode
      prerequisiteMap.get(toNode.node_key).add(fromNode.node_key);
    } else if (toNode.distance_from_start < fromNode.distance_from_start) {
      // toNode is a prerequisite for fromNode
      prerequisiteMap.get(fromNode.node_key).add(toNode.node_key);
    }
  }
});

// Limit prerequisites to immediate parents only (not all ancestors)
const finalPrerequisites = new Map();

nodes.forEach(node => {
  const allPrereqs = Array.from(prerequisiteMap.get(node.node_key));
  
  if (allPrereqs.length === 0) {
    finalPrerequisites.set(node.node_key, []);
    return;
  }
  
  // Find immediate prerequisites (those with highest distance among prerequisites)
  const prereqDistances = allPrereqs.map(prereqKey => {
    const prereqNode = nodeMap.get(prereqKey);
    return {
      key: prereqKey,
      distance: prereqNode.distance_from_start
    };
  }).sort((a, b) => b.distance - a.distance);
  
  // Take only the closest prerequisites (usually 1-2 nodes)
  const maxPrereqDistance = prereqDistances[0].distance;
  const immediatePrereqs = prereqDistances
    .filter(p => p.distance === maxPrereqDistance)
    .slice(0, 2) // Max 2 immediate prerequisites
    .map(p => p.key);
  
  finalPrerequisites.set(node.node_key, immediatePrereqs);
});

// Update database
console.log('Updating prerequisites in database...');

const updateStmt = db.prepare('UPDATE skill_nodes SET prerequisite_nodes = ? WHERE node_key = ?');
let updatedCount = 0;

const transaction = db.transaction(() => {
  finalPrerequisites.forEach((prereqs, nodeKey) => {
    const prereqJson = JSON.stringify(prereqs);
    updateStmt.run(prereqJson, nodeKey);
    updatedCount++;
  });
});

transaction();

console.log(`Updated prerequisites for ${updatedCount} nodes`);

// Show statistics
const prereqStats = db.prepare(`
  SELECT 
    primary_stat,
    distance_from_start,
    COUNT(*) as node_count,
    AVG(JSON_ARRAY_LENGTH(prerequisite_nodes)) as avg_prerequisites
  FROM skill_nodes
  WHERE JSON_VALID(prerequisite_nodes)
  GROUP BY primary_stat, distance_from_start
  ORDER BY primary_stat, distance_from_start
  LIMIT 20
`).all();

console.log('\nPrerequisite statistics by distance:');
prereqStats.forEach(s => {
  console.log(`  ${s.primary_stat} distance ${s.distance_from_start}: ${s.node_count} nodes, avg ${s.avg_prerequisites.toFixed(1)} prereqs`);
});

// Check nodes with no prerequisites (should only be start nodes)
const noPrereqs = db.prepare(`
  SELECT node_key, node_type, primary_stat, distance_from_start
  FROM skill_nodes 
  WHERE prerequisite_nodes = '[]' OR prerequisite_nodes IS NULL
`).all();

console.log(`\nNodes with no prerequisites: ${noPrereqs.length}`);
noPrereqs.forEach(n => {
  console.log(`  ${n.node_key} (${n.node_type}, ${n.primary_stat}, distance ${n.distance_from_start})`);
});

// Verify prerequisite chain integrity
console.log('\nVerifying prerequisite chains...');
let chainIssues = 0;

nodes.forEach(node => {
  if (node.distance_from_start === 0) return; // Skip start nodes
  
  const prereqs = finalPrerequisites.get(node.node_key);
  if (prereqs.length === 0) {
    console.log(`⚠️ Non-start node ${node.node_key} has no prerequisites`);
    chainIssues++;
  } else {
    // Check that all prerequisites are closer to start
    prereqs.forEach(prereqKey => {
      const prereqNode = nodeMap.get(prereqKey);
      if (prereqNode && prereqNode.distance_from_start >= node.distance_from_start) {
        console.log(`⚠️ Invalid prerequisite: ${prereqKey} (dist ${prereqNode.distance_from_start}) for ${node.node_key} (dist ${node.distance_from_start})`);
        chainIssues++;
      }
    });
  }
});

if (chainIssues === 0) {
  console.log('✅ All prerequisite chains are valid');
} else {
  console.log(`⚠️ Found ${chainIssues} prerequisite chain issues`);
}

db.close();
console.log('\n✅ Prerequisites updated successfully!');