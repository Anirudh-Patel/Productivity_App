// Rebuild node positions with guaranteed spacing
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db');

// Node radius configuration
const NODE_RADIUS = {
  small: 8,
  medium: 10,
  large: 14,
  massive: 20
};

// Spacing configuration
const SPACING = {
  between_nodes: 25,  // Minimum space between node edges
  ring_spacing: 120,  // Space between concentric rings
  angular_spacing: 0.25 // Minimum angular separation in radians
};

const CENTER = { x: 2000, y: 2000 };

console.log('Rebuilding skill tree with proper spacing...\n');

// Get all nodes grouped by stat
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

// Starting positions for each stat (pentagon layout)
const statStartAngles = {
  strength: 234 * Math.PI / 180,
  intelligence: 90 * Math.PI / 180,
  luck: 306 * Math.PI / 180,
  aura: 162 * Math.PI / 180,
  will: 18 * Math.PI / 180
};

// Track updated positions
const updatedNodes = [];

// Process each stat branch
Object.keys(nodesByStatAndDistance).forEach(stat => {
  console.log(`Processing ${stat} branch...`);
  
  const baseAngle = statStartAngles[stat];
  const distances = Object.keys(nodesByStatAndDistance[stat]).map(Number).sort((a, b) => a - b);
  
  distances.forEach(distance => {
    const nodesAtDistance = nodesByStatAndDistance[stat][distance];
    const nodeCount = nodesAtDistance.length;
    
    if (distance === 0) {
      // Start node - keep at predefined position
      const startNode = nodesAtDistance[0];
      if (startNode.node_type === 'start') {
        // Use existing start position
        updatedNodes.push({
          ...startNode,
          x_position: startNode.x_position,
          y_position: startNode.y_position
        });
      }
    } else {
      // Calculate radius for this ring
      const baseRadius = 200 + (distance * SPACING.ring_spacing);
      
      // Determine angular spread for nodes at this distance
      // Limit spread to prevent overlap with other branches
      const maxSpread = Math.PI * 0.35; // Max 63 degrees spread per branch
      
      // Calculate required angular spacing
      const requiredAngularSpacing = Math.max(
        SPACING.angular_spacing,
        (2 * Math.asin((NODE_RADIUS.medium + SPACING.between_nodes / 2) / baseRadius))
      );
      
      // Calculate actual angular spread
      const totalAngularSpread = Math.min(
        maxSpread,
        requiredAngularSpacing * (nodeCount - 1)
      );
      
      // Position nodes
      nodesAtDistance.forEach((node, index) => {
        let angle;
        
        if (nodeCount === 1) {
          // Single node - place directly on branch axis
          angle = baseAngle;
        } else {
          // Multiple nodes - spread them out
          const angleOffset = (index - (nodeCount - 1) / 2) * (totalAngularSpread / (nodeCount - 1));
          angle = baseAngle + angleOffset;
        }
        
        // Add slight spiral effect
        angle += distance * 0.02;
        
        // Calculate position
        const x = CENTER.x + Math.cos(angle) * baseRadius;
        const y = CENTER.y + Math.sin(angle) * baseRadius;
        
        updatedNodes.push({
          ...node,
          x_position: x,
          y_position: y
        });
      });
    }
  });
});

// Update database
console.log('\nUpdating node positions in database...');

const updateStmt = db.prepare('UPDATE skill_nodes SET x_position = ?, y_position = ? WHERE node_key = ?');
const transaction = db.transaction(() => {
  updatedNodes.forEach(node => {
    updateStmt.run(node.x_position, node.y_position, node.node_key);
  });
});

transaction();

// Verify no overlaps
console.log('\nVerifying spacing...');

function getDistance(n1, n2) {
  const dx = n1.x_position - n2.x_position;
  const dy = n1.y_position - n2.y_position;
  return Math.sqrt(dx * dx + dy * dy);
}

let overlaps = 0;
let minDistance = Infinity;

for (let i = 0; i < updatedNodes.length; i++) {
  for (let j = i + 1; j < updatedNodes.length; j++) {
    const dist = getDistance(updatedNodes[i], updatedNodes[j]);
    const requiredDist = NODE_RADIUS[updatedNodes[i].size || 'small'] + 
                        NODE_RADIUS[updatedNodes[j].size || 'small'] + 
                        SPACING.between_nodes;
    
    if (dist < requiredDist) {
      overlaps++;
    }
    
    if (dist < minDistance && dist > 0) {
      minDistance = dist;
    }
  }
}

console.log(`Overlapping nodes: ${overlaps}`);
console.log(`Minimum distance between nodes: ${minDistance.toFixed(2)}px`);

// Show statistics
const stats = db.prepare(`
  SELECT 
    primary_stat,
    COUNT(*) as count,
    MIN(x_position) as min_x,
    MAX(x_position) as max_x,
    MIN(y_position) as min_y,
    MAX(y_position) as max_y
  FROM skill_nodes
  GROUP BY primary_stat
`).all();

console.log('\nBranch statistics:');
stats.forEach(s => {
  const width = s.max_x - s.min_x;
  const height = s.max_y - s.min_y;
  console.log(`  ${s.primary_stat}: ${s.count} nodes, area ${width.toFixed(0)}x${height.toFixed(0)}`);
});

// Overall stats
const overall = db.prepare(`
  SELECT 
    COUNT(*) as total,
    MIN(x_position) as min_x,
    MAX(x_position) as max_x,
    MIN(y_position) as min_y,
    MAX(y_position) as max_y
  FROM skill_nodes
`).get();

console.log(`\nTotal tree dimensions: ${(overall.max_x - overall.min_x).toFixed(0)}x${(overall.max_y - overall.min_y).toFixed(0)}`);
console.log(`Canvas usage: X[${overall.min_x.toFixed(0)}, ${overall.max_x.toFixed(0)}] Y[${overall.min_y.toFixed(0)}, ${overall.max_y.toFixed(0)}]`);

db.close();

console.log('\n✅ Skill tree rebuilt with proper spacing!');