// Aggressively fix overlapping nodes in the skill tree by ensuring minimum spacing
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

// Node radius configuration (must match frontend)
const NODE_RADIUS = {
  small: 8,
  medium: 10,
  large: 14,
  massive: 20
};

// Minimum spacing between nodes (in addition to their radii)
const MIN_SPACING = 15; // Increased spacing

console.log('Analyzing and fixing skill tree node overlaps...\n');

// Get all nodes
const nodes = db.prepare('SELECT * FROM skill_nodes ORDER BY node_key').all();
console.log(`Total nodes: ${nodes.length}`);

// Function to calculate distance between two nodes
function getDistance(node1, node2) {
  const dx = node1.x_position - node2.x_position;
  const dy = node1.y_position - node2.y_position;
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to get the radius of a node
function getNodeRadius(node) {
  return NODE_RADIUS[node.size] || NODE_RADIUS.small;
}

// Group nodes by primary stat for better organization
const nodesBystat = {};
nodes.forEach(node => {
  if (!nodesBystat[node.primary_stat]) {
    nodesBystat[node.primary_stat] = [];
  }
  nodesBystat[node.primary_stat].push(node);
});

// Process each stat group separately to maintain branch structure
Object.keys(nodesBystat).forEach(stat => {
  console.log(`\nProcessing ${stat} branch (${nodesBystat[stat].length} nodes)...`);
  
  const statNodes = nodesBystat[stat];
  
  // Sort nodes by distance from center to process from inside out
  const CENTER = { x_position: 2000, y_position: 2000 };
  statNodes.sort((a, b) => {
    const distA = getDistance(a, CENTER);
    const distB = getDistance(b, CENTER);
    return distA - distB;
  });
  
  // Create spatial index for efficient neighbor lookup
  const processedNodes = [];
  
  statNodes.forEach((node, index) => {
    if (node.node_type === 'start') {
      // Don't move start nodes
      processedNodes.push(node);
      return;
    }
    
    let newX = node.x_position;
    let newY = node.y_position;
    let attempts = 0;
    const maxAttempts = 50;
    
    // Check for overlaps with already processed nodes
    let hasOverlap = true;
    while (hasOverlap && attempts < maxAttempts) {
      hasOverlap = false;
      
      for (const other of processedNodes) {
        const dx = newX - other.x_position;
        const dy = newY - other.y_position;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = getNodeRadius(node) + getNodeRadius(other) + MIN_SPACING;
        
        if (distance < minDistance) {
          hasOverlap = true;
          
          // Calculate push direction
          if (distance < 0.01) {
            // Nodes at same position, use random angle
            const angle = Math.random() * 2 * Math.PI;
            newX += Math.cos(angle) * (minDistance - distance);
            newY += Math.sin(angle) * (minDistance - distance);
          } else {
            // Push away from the other node
            const pushX = (dx / distance) * (minDistance - distance);
            const pushY = (dy / distance) * (minDistance - distance);
            newX += pushX;
            newY += pushY;
          }
          
          break; // Recheck all nodes after adjustment
        }
      }
      
      attempts++;
    }
    
    // Update node position if it changed
    if (Math.abs(newX - node.x_position) > 0.1 || Math.abs(newY - node.y_position) > 0.1) {
      node.x_position = newX;
      node.y_position = newY;
    }
    
    processedNodes.push(node);
  });
});

// Also check for overlaps between different stat branches
console.log('\nChecking cross-branch overlaps...');

const allNodesMap = new Map();
nodes.forEach(node => {
  allNodesMap.set(node.node_key, node);
});

// Fix cross-branch overlaps
let crossBranchFixes = 0;
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const node1 = nodes[i];
    const node2 = nodes[j];
    
    // Skip if same stat branch or if either is a start node
    if (node1.primary_stat === node2.primary_stat || 
        node1.node_type === 'start' || 
        node2.node_type === 'start') {
      continue;
    }
    
    const distance = getDistance(node1, node2);
    const minDistance = getNodeRadius(node1) + getNodeRadius(node2) + MIN_SPACING;
    
    if (distance < minDistance) {
      // Move the node that's further from center
      const dist1 = getDistance(node1, { x_position: 2000, y_position: 2000 });
      const dist2 = getDistance(node2, { x_position: 2000, y_position: 2000 });
      const nodeToMove = dist1 > dist2 ? node1 : node2;
      
      // Calculate push direction
      const dx = node2.x_position - node1.x_position;
      const dy = node2.y_position - node1.y_position;
      
      if (distance < 0.01) {
        // Same position, use angle based on stat
        const statAngles = { strength: 0, intelligence: 72, luck: 144, aura: 216, will: 288 };
        const angle = (statAngles[nodeToMove.primary_stat] || 0) * Math.PI / 180;
        nodeToMove.x_position += Math.cos(angle) * minDistance;
        nodeToMove.y_position += Math.sin(angle) * minDistance;
      } else {
        const pushFactor = (minDistance - distance) / distance;
        if (nodeToMove === node1) {
          nodeToMove.x_position -= dx * pushFactor;
          nodeToMove.y_position -= dy * pushFactor;
        } else {
          nodeToMove.x_position += dx * pushFactor;
          nodeToMove.y_position += dy * pushFactor;
        }
      }
      
      crossBranchFixes++;
    }
  }
}

console.log(`Fixed ${crossBranchFixes} cross-branch overlaps`);

// Update database with new positions
const updateStmt = db.prepare('UPDATE skill_nodes SET x_position = ?, y_position = ? WHERE node_key = ?');
const updateCount = db.transaction(() => {
  let count = 0;
  nodes.forEach(node => {
    updateStmt.run(node.x_position, node.y_position, node.node_key);
    count++;
  });
  return count;
})();

console.log(`\nUpdated ${updateCount} node positions`);

// Verify remaining overlaps
let remainingOverlaps = 0;
const severeOverlaps = [];

for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const distance = getDistance(nodes[i], nodes[j]);
    const minDistance = getNodeRadius(nodes[i]) + getNodeRadius(nodes[j]) + MIN_SPACING;
    
    if (distance < minDistance) {
      remainingOverlaps++;
      const overlap = minDistance - distance;
      if (overlap > 5) {
        severeOverlaps.push({
          node1: nodes[i].node_key,
          node2: nodes[j].node_key,
          overlap: overlap
        });
      }
    }
  }
}

if (remainingOverlaps === 0) {
  console.log('\n✅ All overlaps successfully resolved!');
} else {
  console.log(`\n⚠️ ${remainingOverlaps} overlaps remain`);
  if (severeOverlaps.length > 0) {
    console.log(`   ${severeOverlaps.length} severe overlaps (>5px):`);
    severeOverlaps.slice(0, 5).forEach(s => {
      console.log(`   - ${s.node1} <-> ${s.node2}: ${s.overlap.toFixed(1)}px`);
    });
  }
}

// Show final statistics
const stats = db.prepare(`
  SELECT 
    primary_stat,
    COUNT(*) as count,
    AVG(x_position) as avg_x,
    AVG(y_position) as avg_y
  FROM skill_nodes
  GROUP BY primary_stat
`).all();

console.log('\nFinal branch statistics:');
stats.forEach(s => {
  console.log(`  ${s.primary_stat}: ${s.count} nodes at avg (${s.avg_x.toFixed(0)}, ${s.avg_y.toFixed(0)})`);
});

db.close();
console.log('\n✨ Aggressive overlap fixing complete!');