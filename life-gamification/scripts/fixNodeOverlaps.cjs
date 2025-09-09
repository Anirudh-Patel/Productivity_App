// Fix overlapping nodes in the skill tree by spacing them out
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
const MIN_SPACING = 10;

console.log('Analyzing skill tree nodes for overlaps...\n');

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

// Function to check if two nodes overlap
function nodesOverlap(node1, node2) {
  const distance = getDistance(node1, node2);
  const minDistance = getNodeRadius(node1) + getNodeRadius(node2) + MIN_SPACING;
  return distance < minDistance;
}

// Find all overlapping node pairs
const overlappingPairs = [];
const processedPairs = new Set();

for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const node1 = nodes[i];
    const node2 = nodes[j];
    const pairKey = `${node1.node_key}|${node2.node_key}`;
    
    if (!processedPairs.has(pairKey) && nodesOverlap(node1, node2)) {
      overlappingPairs.push({
        node1,
        node2,
        distance: getDistance(node1, node2),
        requiredDistance: getNodeRadius(node1) + getNodeRadius(node2) + MIN_SPACING
      });
      processedPairs.add(pairKey);
    }
  }
}

console.log(`Found ${overlappingPairs.length} overlapping node pairs\n`);

if (overlappingPairs.length === 0) {
  console.log('✅ No overlapping nodes found!');
  db.close();
  process.exit(0);
}

// Sort overlaps by severity (most overlapped first)
overlappingPairs.sort((a, b) => {
  const overlapA = a.requiredDistance - a.distance;
  const overlapB = b.requiredDistance - b.distance;
  return overlapB - overlapA;
});

// Show the most severe overlaps
console.log('Most severe overlaps:');
overlappingPairs.slice(0, 10).forEach(pair => {
  const overlap = pair.requiredDistance - pair.distance;
  console.log(`  ${pair.node1.node_key} <-> ${pair.node2.node_key}: overlap by ${overlap.toFixed(2)}px`);
});

// Fix overlaps using a force-directed approach
console.log('\nApplying spacing corrections...');

// Create a map of node positions for easier updates
const nodePositions = new Map();
nodes.forEach(node => {
  nodePositions.set(node.node_key, {
    x: node.x_position,
    y: node.y_position,
    radius: getNodeRadius(node),
    fixed: node.node_type === 'start' // Don't move start nodes
  });
});

// Apply repulsion forces iteratively
const MAX_ITERATIONS = 50;
const FORCE_STRENGTH = 0.3;

for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
  let totalAdjustment = 0;
  const forces = new Map();
  
  // Initialize forces for each node
  nodes.forEach(node => {
    forces.set(node.node_key, { x: 0, y: 0 });
  });
  
  // Calculate repulsion forces for overlapping nodes
  overlappingPairs.forEach(pair => {
    const pos1 = nodePositions.get(pair.node1.node_key);
    const pos2 = nodePositions.get(pair.node2.node_key);
    
    // Skip if both nodes are fixed
    if (pos1.fixed && pos2.fixed) return;
    
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.01) {
      // Nodes are at the same position, apply random offset
      const angle = Math.random() * 2 * Math.PI;
      pos2.x += Math.cos(angle) * 5;
      pos2.y += Math.sin(angle) * 5;
      return;
    }
    
    const requiredDistance = pos1.radius + pos2.radius + MIN_SPACING;
    
    if (distance < requiredDistance) {
      // Calculate repulsion force
      const overlap = requiredDistance - distance;
      const forceX = (dx / distance) * overlap * FORCE_STRENGTH;
      const forceY = (dy / distance) * overlap * FORCE_STRENGTH;
      
      // Apply forces (respecting fixed nodes)
      if (!pos1.fixed) {
        const force1 = forces.get(pair.node1.node_key);
        force1.x -= forceX;
        force1.y -= forceY;
      }
      
      if (!pos2.fixed) {
        const force2 = forces.get(pair.node2.node_key);
        force2.x += forceX;
        force2.y += forceY;
      }
      
      totalAdjustment += overlap;
    }
  });
  
  // Apply forces to update positions
  nodes.forEach(node => {
    const pos = nodePositions.get(node.node_key);
    if (!pos.fixed) {
      const force = forces.get(node.node_key);
      pos.x += force.x;
      pos.y += force.y;
    }
  });
  
  // Check for convergence
  if (totalAdjustment < 1) {
    console.log(`Converged after ${iteration + 1} iterations`);
    break;
  }
}

// Apply final positions to database
const updateStmt = db.prepare('UPDATE skill_nodes SET x_position = ?, y_position = ? WHERE node_key = ?');

let updatedCount = 0;
nodes.forEach(node => {
  const newPos = nodePositions.get(node.node_key);
  
  // Only update if position changed significantly
  if (Math.abs(newPos.x - node.x_position) > 0.1 || Math.abs(newPos.y - node.y_position) > 0.1) {
    updateStmt.run(newPos.x, newPos.y, node.node_key);
    updatedCount++;
  }
});

console.log(`\nUpdated positions for ${updatedCount} nodes`);

// Verify no overlaps remain
const updatedNodes = db.prepare('SELECT * FROM skill_nodes').all();
let remainingOverlaps = 0;

for (let i = 0; i < updatedNodes.length; i++) {
  for (let j = i + 1; j < updatedNodes.length; j++) {
    if (nodesOverlap(updatedNodes[i], updatedNodes[j])) {
      remainingOverlaps++;
    }
  }
}

if (remainingOverlaps === 0) {
  console.log('✅ All overlaps successfully resolved!');
} else {
  console.log(`⚠️ ${remainingOverlaps} overlaps remain (may be start nodes or tightly packed areas)`);
}

// Show statistics
const statsQuery = db.prepare(`
  SELECT 
    MIN(x_position) as min_x, MAX(x_position) as max_x,
    MIN(y_position) as min_y, MAX(y_position) as max_y
  FROM skill_nodes
`).get();

console.log('\nFinal tree dimensions:');
console.log(`  X range: ${statsQuery.min_x.toFixed(0)} to ${statsQuery.max_x.toFixed(0)}`);
console.log(`  Y range: ${statsQuery.min_y.toFixed(0)} to ${statsQuery.max_y.toFixed(0)}`);

db.close();
console.log('\n✨ Node overlap fixing complete!');