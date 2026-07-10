// Simple script to calculate shortest node distances between starting nodes
const Database = require('better-sqlite3');
const db = new Database('src-tauri/game.db', { readonly: true });

// BFS to find shortest path between two nodes
function findShortestPath(start, end, graph) {
  const queue = [{node: start, distance: 0}];
  const visited = new Set([start]);
  
  while (queue.length > 0) {
    const {node, distance} = queue.shift();
    
    if (node === end) {
      return distance;
    }
    
    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({node: neighbor, distance: distance + 1});
      }
    }
  }
  
  return -1; // No path found
}

try {
  // Get all connections
  const connections = db.prepare('SELECT from_node, to_node FROM skill_tree_connections').all();
  
  // Build bidirectional graph
  const graph = {};
  connections.forEach(conn => {
    if (!graph[conn.from_node]) graph[conn.from_node] = [];
    if (!graph[conn.to_node]) graph[conn.to_node] = [];
    
    graph[conn.from_node].push(conn.to_node);
    graph[conn.to_node].push(conn.from_node); // Bidirectional
  });
  
  const startingNodes = ['START_STRENGTH', 'START_INTELLIGENCE', 'START_LUCK', 'START_AURA', 'START_WILL'];
  
  console.log('Shortest path distances between starting nodes (in node hops):');
  console.log('================================================================');
  
  const distances = [];
  
  for (let i = 0; i < startingNodes.length; i++) {
    for (let j = i + 1; j < startingNodes.length; j++) {
      const from = startingNodes[i];
      const to = startingNodes[j];
      const distance = findShortestPath(from, to, graph);
      
      const fromName = from.replace('START_', '');
      const toName = to.replace('START_', '');
      
      console.log(`${fromName.padEnd(12)} <-> ${toName.padEnd(12)} : ${distance} nodes`);
      
      if (distance > 0) {
        distances.push(distance);
      }
    }
  }
  
  console.log('\n================================================================');
  const uniqueDistances = [...new Set(distances)].sort((a,b) => a-b);
  
  if (uniqueDistances.length === 1) {
    console.log(`✓ All starting nodes are equally distant: ${uniqueDistances[0]} nodes apart`);
  } else {
    console.log(`✗ Starting nodes have varying distances:`);
    console.log(`  Range: ${Math.min(...distances)} to ${Math.max(...distances)} nodes`);
    console.log(`  Unique distances: ${uniqueDistances.join(', ')} nodes`);
    
    // Show distribution
    const distribution = {};
    distances.forEach(d => distribution[d] = (distribution[d] || 0) + 1);
    console.log(`  Distribution: ${Object.entries(distribution).map(([d, count]) => `${d} nodes (${count} pairs)`).join(', ')}`);
  }
  
} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}