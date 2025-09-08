import {
  SkillNode,
  SKILL_TREE_CONFIG
} from './types';

export class NodeInteractionManager {
  // Find node at given world coordinates
  findNodeAt(worldX: number, worldY: number, nodes: SkillNode[]): SkillNode | null {
    for (const node of nodes) {
      const distance = this.getDistanceToNode(worldX, worldY, node);
      const radius = SKILL_TREE_CONFIG.nodeRadius[node.size];
      
      if (distance <= radius) {
        return node;
      }
    }
    
    return null;
  }

  // Calculate distance from point to node center
  private getDistanceToNode(x: number, y: number, node: SkillNode): number {
    const dx = x - node.x_position;
    const dy = y - node.y_position;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Get all nodes within a radius of a point
  getNodesInRadius(
    centerX: number,
    centerY: number,
    radius: number,
    nodes: SkillNode[]
  ): SkillNode[] {
    return nodes.filter(node => {
      const distance = this.getDistanceToNode(centerX, centerY, node);
      return distance <= radius;
    });
  }

  // Check if a node is clickable (not just hoverable)
  isNodeClickable(node: SkillNode, allocatedNodes: Set<string>, userLevel: number): boolean {
    // Already allocated nodes are clickable for deallocation
    if (allocatedNodes.has(node.node_key)) {
      return true;
    }

    // Check if node meets requirements for allocation
    const meetsLevel = userLevel >= node.level_requirement;
    const prereqsMet = node.prerequisite_nodes.every(prereq => 
      allocatedNodes.has(prereq)
    );

    return meetsLevel && prereqsMet;
  }

  // Get tooltip position for a node
  getTooltipPosition(
    node: SkillNode,
    viewport: { x: number; y: number; zoom: number; width: number; height: number }
  ): { x: number; y: number } {
    // Convert world coordinates to screen coordinates
    const screenX = node.x_position * viewport.zoom + viewport.x;
    const screenY = node.y_position * viewport.zoom + viewport.y;
    
    // Offset tooltip to avoid overlapping the node
    const nodeRadius = SKILL_TREE_CONFIG.nodeRadius[node.size] * viewport.zoom;
    
    return {
      x: screenX + nodeRadius + 10,
      y: screenY - nodeRadius - 10
    };
  }

  // Calculate hit area for touch/mobile interactions (larger than visual)
  getTouchHitRadius(node: SkillNode, zoom: number): number {
    const baseRadius = SKILL_TREE_CONFIG.nodeRadius[node.size];
    const visualRadius = baseRadius * zoom;
    
    // Ensure minimum hit area of 20px for touch
    return Math.max(visualRadius, 20 / zoom);
  }

  // Get interaction priority (smaller nodes need higher priority when overlapping)
  getInteractionPriority(node: SkillNode): number {
    const sizeOrder = { massive: 0, large: 1, medium: 2, small: 3 };
    const typeOrder = { start: 0, augmenting: 1, specialized: 2, regular: 3 };
    
    return (sizeOrder[node.size] * 10) + typeOrder[node.node_type];
  }

  // Find the best node when multiple nodes overlap at a point
  findBestNodeAt(worldX: number, worldY: number, nodes: SkillNode[]): SkillNode | null {
    const candidates: Array<{ node: SkillNode; distance: number; priority: number }> = [];

    for (const node of nodes) {
      const distance = this.getDistanceToNode(worldX, worldY, node);
      const radius = SKILL_TREE_CONFIG.nodeRadius[node.size];
      
      if (distance <= radius) {
        candidates.push({
          node,
          distance,
          priority: this.getInteractionPriority(node)
        });
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].node;

    // Sort by priority first, then by distance
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.distance - b.distance;
    });

    return candidates[0].node;
  }

  // Check if point is within canvas bounds
  isPointInCanvas(
    screenX: number, 
    screenY: number, 
    canvasWidth: number, 
    canvasHeight: number
  ): boolean {
    return screenX >= 0 && screenX <= canvasWidth && screenY >= 0 && screenY <= canvasHeight;
  }

  // Get nodes along a connection path (for highlighting connection chains)
  getConnectionPath(fromNodeKey: string, toNodeKey: string, nodes: SkillNode[]): SkillNode[] {
    const nodeMap = new Map(nodes.map(n => [n.node_key, n]));
    const fromNode = nodeMap.get(fromNodeKey);
    const toNode = nodeMap.get(toNodeKey);
    
    if (!fromNode || !toNode) return [];
    
    return [fromNode, toNode];
  }

  // Calculate visual feedback intensity based on interaction state
  getInteractionIntensity(
    node: SkillNode,
    isHovered: boolean,
    isPressed: boolean,
    isAllocated: boolean
  ): number {
    if (isPressed) return 1.0;
    if (isHovered && !isAllocated) return 0.7;
    if (isHovered && isAllocated) return 0.5;
    if (isAllocated) return 0.3;
    return 0.0;
  }
}