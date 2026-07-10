// Script to add bridge connections between disconnected skill tree components
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

// Find bridge connections to add
const bridges = [
  // Connect LUCK branch to AURA branch (we know this already exists)
  // Let's add more bridges to connect other components
  
  // STRENGTH to INTELLIGENCE bridge (via nearby nodes)
  { from: 'STRENGTH_R_6_12', to: 'INTELLIGENCE_R_6_12' },
  
  // INTELLIGENCE to WILL bridge (via nearby nodes) 
  { from: 'INTELLIGENCE_R_6_11', to: 'WILL_R_6_11' },
  
  // WILL to STRENGTH bridge (completing the circle)
  { from: 'WILL_R_6_10', to: 'STRENGTH_R_6_10' },
  
  // Additional cross-connections for redundancy
  { from: 'STRENGTH_S_5_2', to: 'INTELLIGENCE_S_5_2' },
  { from: 'INTELLIGENCE_S_4_1', to: 'LUCK_S_4_1' },
  { from: 'WILL_S_3_3', to: 'AURA_S_3_3' }
];

console.log('Adding bridge connections to ensure full connectivity...');

// Check which nodes actually exist and add bridges
let bridgesAdded = 0;
const insertBridge = db.prepare('INSERT OR IGNORE INTO skill_tree_connections (from_node, to_node) VALUES (?, ?)');

bridges.forEach(bridge => {
  // Check if both nodes exist
  const fromExists = db.prepare('SELECT 1 FROM skill_nodes WHERE node_key = ?').get(bridge.from);
  const toExists = db.prepare('SELECT 1 FROM skill_nodes WHERE node_key = ?').get(bridge.to);
  
  if (fromExists && toExists) {
    // Add bidirectional connection
    insertBridge.run(bridge.from, bridge.to);
    insertBridge.run(bridge.to, bridge.from);
    console.log(`✓ Added bridge: ${bridge.from} <-> ${bridge.to}`);
    bridgesAdded++;
  } else {
    console.log(`✗ Skipped bridge: ${bridge.from} <-> ${bridge.to} (nodes don't exist)`);
  }
});

console.log(`\nAdded ${bridgesAdded} bridges.`);

// Verify connectivity
const totalConnections = db.prepare('SELECT COUNT(*) as count FROM skill_tree_connections').get().count;
console.log(`Total connections: ${totalConnections}`);

db.close();
console.log('Done!');