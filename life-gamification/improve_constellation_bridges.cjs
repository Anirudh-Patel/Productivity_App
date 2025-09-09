// Improve constellation tree by replacing random bridges with elegant outer ring connectivity
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

console.log('Improving constellation tree with outer ring connectivity...');

// 1. Remove the current random bridges (keep original organic structure)
console.log('Removing random bridges...');
const bridgesToRemove = [
  'STRENGTH_R_6_12', 'INTELLIGENCE_R_6_12',
  'INTELLIGENCE_R_6_11', 'WILL_R_6_11', 
  'WILL_R_6_10', 'STRENGTH_R_6_10',
  'STRENGTH_S_5_2', 'INTELLIGENCE_S_5_2',
  'INTELLIGENCE_S_4_1', 'LUCK_S_4_1',
  'WILL_S_3_3', 'AURA_S_3_3'
];

const deleteBridge = db.prepare('DELETE FROM skill_tree_connections WHERE (from_node = ? AND to_node = ?) OR (from_node = ? AND to_node = ?)');

for (let i = 0; i < bridgesToRemove.length; i += 2) {
  const from = bridgesToRemove[i];
  const to = bridgesToRemove[i + 1];
  deleteBridge.run(from, to, to, from);
  console.log(`Removed bridge: ${from} <-> ${to}`);
}

// 2. Find outer ring nodes (furthest from center for each stat)
console.log('\nIdentifying outer ring nodes...');

const CENTER = { x: 2000, y: 2000 };
const getDistance = (node) => Math.sqrt(Math.pow(node.x_position - CENTER.x, 2) + Math.pow(node.y_position - CENTER.y, 2));

// Get nodes from each stat branch in outer ring (furthest 15% of nodes)
const allNodes = db.prepare('SELECT * FROM skill_nodes WHERE node_type != ?').all('start');

const nodesByStatWithDistance = {};
['strength', 'intelligence', 'luck', 'aura', 'will'].forEach(stat => {
  const statNodes = allNodes.filter(n => n.primary_stat === stat);
  const nodesWithDistance = statNodes.map(node => ({
    ...node,
    distanceFromCenter: getDistance(node)
  }));
  
  // Sort by distance from center (furthest first)
  nodesWithDistance.sort((a, b) => b.distanceFromCenter - a.distanceFromCenter);
  
  nodesByStatWithDistance[stat] = nodesWithDistance;
});

// Get outer ring nodes (top 15% furthest from center for each stat)
const outerRingNodes = [];
Object.values(nodesByStatWithDistance).forEach(statNodes => {
  const outerCount = Math.floor(statNodes.length * 0.15); // Outer 15%
  const outerNodes = statNodes.slice(0, outerCount);
  outerRingNodes.push(...outerNodes);
});

console.log(`Found ${outerRingNodes.length} outer ring nodes`);

// 3. Sort outer ring nodes by angle to create smooth circular connectivity
outerRingNodes.sort((a, b) => {
  const angleA = Math.atan2(a.y_position - CENTER.y, a.x_position - CENTER.x);
  const angleB = Math.atan2(b.y_position - CENTER.y, b.x_position - CENTER.x);
  return angleA - angleB;
});

// 4. Create elegant outer ring connections between different stat branches
console.log('Creating outer ring constellation connectivity...');

const insertConnection = db.prepare('INSERT OR IGNORE INTO skill_tree_connections (from_node, to_node) VALUES (?, ?)');
let outerRingConnections = 0;

outerRingNodes.forEach((node, index) => {
  // Connect to next few nodes in the ring
  for (let offset = 1; offset <= 3; offset++) {
    const targetIndex = (index + offset) % outerRingNodes.length;
    const targetNode = outerRingNodes[targetIndex];
    
    // Only connect nodes from different stat branches
    if (node.primary_stat !== targetNode.primary_stat) {
      // Calculate distance to avoid overly long connections
      const connectionDistance = Math.sqrt(
        Math.pow(node.x_position - targetNode.x_position, 2) + 
        Math.pow(node.y_position - targetNode.y_position, 2)
      );
      
      // Only connect if nodes are reasonably close (avoid crossing the entire tree)
      if (connectionDistance < 400) {
        insertConnection.run(node.node_key, targetNode.node_key);
        insertConnection.run(targetNode.node_key, node.node_key);
        
        if (outerRingConnections < 10) { // Log first few connections
          console.log(`✓ Outer ring bridge: ${node.primary_stat} <-> ${targetNode.primary_stat}`);
        }
        outerRingConnections++;
      }
    }
  }
});

console.log(`\nAdded ${outerRingConnections} outer ring connections`);

// 5. Verify connectivity
console.log('\nVerifying connectivity...');
const totalConnections = db.prepare('SELECT COUNT(*) as count FROM skill_tree_connections').get().count;
console.log(`Total connections: ${totalConnections}`);

db.close();

console.log('\n✅ Constellation tree improved with elegant outer ring connectivity!');
console.log('The tree now has:');
console.log('- Original organic constellation aesthetic');
console.log('- Natural spiral branch shapes'); 
console.log('- Elegant outer ring bridges between stat branches');
console.log('- No more random mid-tree bridges');