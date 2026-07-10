// Fix duplicate node positions in the skill tree
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

console.log('Fixing duplicate node positions...');

// Find all duplicate positions
const duplicates = db.prepare(`
  SELECT x_position, y_position, COUNT(*) as count, GROUP_CONCAT(node_key) as nodes
  FROM skill_nodes
  GROUP BY x_position, y_position
  HAVING COUNT(*) > 1
`).all();

console.log(`Found ${duplicates.length} positions with duplicate nodes`);

const updatePosition = db.prepare('UPDATE skill_nodes SET x_position = ?, y_position = ? WHERE node_key = ?');

duplicates.forEach(dup => {
  const nodes = dup.nodes.split(',');
  console.log(`Fixing position for nodes: ${nodes.join(', ')}`);
  
  // Keep first node at original position, offset others in a small circle
  nodes.slice(1).forEach((node, index) => {
    const angle = (2 * Math.PI * (index + 1)) / nodes.length;
    const offset = 25; // Offset by 25 pixels to prevent overlap
    
    const newX = dup.x_position + offset * Math.cos(angle);
    const newY = dup.y_position + offset * Math.sin(angle);
    
    updatePosition.run(newX, newY, node);
  });
});

// Verify no more duplicates
const remaining = db.prepare(`
  SELECT COUNT(*) as count
  FROM (
    SELECT x_position, y_position, COUNT(*) as cnt
    FROM skill_nodes
    GROUP BY x_position, y_position
    HAVING COUNT(*) > 1
  )
`).get();

console.log(`\n✅ Fixed all duplicate positions!`);
console.log(`Remaining duplicates: ${remaining.count}`);

db.close();