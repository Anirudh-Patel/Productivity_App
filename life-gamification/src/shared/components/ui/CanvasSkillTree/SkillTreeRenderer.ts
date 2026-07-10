import {
  SkillNode,
  SkillTreeConnection,
  RenderOptions,
  NodeRenderInfo,
  ConnectionRenderInfo,
  NodeStatus,
  SKILL_TREE_CONFIG,
  STAT_COLORS,
  NODE_STATES,
  CONNECTION_STATES,
  LOD_THRESHOLDS
} from './types';

export class SkillTreeRenderer {
  private gradientCache = new Map<string, CanvasGradient>();
  private textMetricsCache = new Map<string, TextMetrics>();

  // Get level of detail based on zoom level
  getLOD(zoom: number): 'minimal' | 'simple' | 'full' {
    if (zoom < LOD_THRESHOLDS.minimal) return 'minimal';
    if (zoom < LOD_THRESHOLDS.simple) return 'simple';
    return 'full';
  }

  // Render all connections between nodes
  renderConnections(
    ctx: CanvasRenderingContext2D,
    connections: SkillTreeConnection[],
    nodes: SkillNode[],
    allocatedNodes: Set<string>,
    lod: 'minimal' | 'simple' | 'full'
  ): void {
    if (lod === 'minimal') return; // Skip connections at minimal LOD

    const nodeMap = new Map(nodes.map(n => [n.node_key, n]));

    connections.forEach(connection => {
      const fromNode = nodeMap.get(connection.from_node);
      const toNode = nodeMap.get(connection.to_node);
      
      if (!fromNode || !toNode) return;

      const connectionInfo = this.getConnectionRenderInfo(
        connection,
        fromNode,
        toNode,
        allocatedNodes
      );

      this.renderConnection(ctx, connectionInfo, lod);
    });
  }

  // Render all visible nodes
  renderNodes(
    ctx: CanvasRenderingContext2D,
    nodes: SkillNode[],
    options: RenderOptions
  ): void {
    // Sort nodes by render priority (start nodes first, then by type)
    const sortedNodes = [...nodes].sort((a, b) => {
      const getPriority = (node: SkillNode) => {
        switch (node.node_type) {
          case 'start': return 0;
          case 'augmenting': return 1;
          case 'specialized': return 2;
          case 'regular': return 3;
          default: return 4;
        }
      };
      return getPriority(a) - getPriority(b);
    });

    sortedNodes.forEach(node => {
      const nodeInfo = this.getNodeRenderInfo(node, options);
      this.renderNode(ctx, nodeInfo, options.lod);
    });
  }

  // Get rendering information for a connection
  private getConnectionRenderInfo(
    connection: SkillTreeConnection,
    fromNode: SkillNode,
    toNode: SkillNode,
    allocatedNodes: Set<string>
  ): ConnectionRenderInfo {
    const fromAllocated = allocatedNodes.has(fromNode.node_key);
    const toAllocated = allocatedNodes.has(toNode.node_key);
    const isActive = fromAllocated && toAllocated;

    let state = CONNECTION_STATES.inactive;
    if (isActive) {
      state = CONNECTION_STATES.active;
    }

    return {
      connection,
      fromNode,
      toNode,
      isActive,
      color: state.color,
      width: state.width,
      opacity: state.opacity
    };
  }

  // Get rendering information for a node
  private getNodeRenderInfo(node: SkillNode, options: RenderOptions): NodeRenderInfo {
    const status = this.getNodeStatus(node, options);
    const canAllocate = this.canAllocateNode(node, options);
    
    const baseRadius = SKILL_TREE_CONFIG.nodeRadius[node.size];
    const radius = options.hoveredNode === node.node_key 
      ? baseRadius * NODE_STATES.hovered.scaleMultiplier 
      : baseRadius;

    const statColor = STAT_COLORS[node.primary_stat];
    const nodeState = NODE_STATES[status];

    // Use proper node status colors as primary colors
    let color = nodeState.fillColor;
    let borderColor = nodeState.borderColor;
    let glowIntensity = nodeState.glowIntensity;

    // Override colors for allocated nodes with stat colors
    if (status === 'allocated') {
      color = statColor.primary;
      borderColor = statColor.secondary;
    } else if (status === 'available' && canAllocate) {
      color = nodeState.fillColor; // Keep normal available color
      borderColor = statColor.primary;
      glowIntensity = 0.5;
    }
    
    // Store distance-based color for subtle inner ring effect
    const distanceColor = node.color_hex;

    // Enhance glow for hovered nodes
    if (options.hoveredNode === node.node_key) {
      glowIntensity = NODE_STATES.hovered.glowIntensity;
    }

    return {
      node,
      status,
      canAllocate,
      radius,
      color,
      borderColor,
      glowIntensity,
      distanceColor
    };
  }

  // Determine node status
  private getNodeStatus(node: SkillNode, options: RenderOptions): NodeStatus {
    if (options.allocatedNodes.has(node.node_key)) {
      return 'allocated';
    }

    // Check if node is available for allocation
    const meetsLevelReq = options.userLevel >= node.level_requirement;
    const hasSkillPoints = options.availablePoints >= node.skill_point_cost;
    const prereqsMet = node.prerequisite_nodes.every(prereq => 
      options.allocatedNodes.has(prereq)
    );

    if (meetsLevelReq && hasSkillPoints && prereqsMet) {
      return 'available';
    }

    return 'locked';
  }

  // Check if a node can be allocated
  private canAllocateNode(node: SkillNode, options: RenderOptions): boolean {
    return this.getNodeStatus(node, options) === 'available';
  }

  // Render a single connection
  private renderConnection(
    ctx: CanvasRenderingContext2D,
    info: ConnectionRenderInfo,
    lod: 'minimal' | 'simple' | 'full'
  ): void {
    ctx.save();
    
    ctx.globalAlpha = info.opacity;
    ctx.strokeStyle = info.color;
    ctx.lineWidth = info.width;
    ctx.lineCap = 'round';

    // Use straight line for simple LOD, curved for full
    if (lod === 'simple') {
      ctx.beginPath();
      ctx.moveTo(info.fromNode.x_position, info.fromNode.y_position);
      ctx.lineTo(info.toNode.x_position, info.toNode.y_position);
      ctx.stroke();
    } else {
      // Draw curved connection
      const dx = info.toNode.x_position - info.fromNode.x_position;
      const dy = info.toNode.y_position - info.fromNode.y_position;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Control point for curve (perpendicular to connection)
      const curvature = Math.min(distance * 0.2, 50);
      const midX = (info.fromNode.x_position + info.toNode.x_position) / 2;
      const midY = (info.fromNode.y_position + info.toNode.y_position) / 2;
      
      // Calculate perpendicular offset
      const perpX = -dy / distance * curvature;
      const perpY = dx / distance * curvature;
      
      ctx.beginPath();
      ctx.moveTo(info.fromNode.x_position, info.fromNode.y_position);
      ctx.quadraticCurveTo(
        midX + perpX, 
        midY + perpY,
        info.toNode.x_position, 
        info.toNode.y_position
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  // Render a single node
  private renderNode(
    ctx: CanvasRenderingContext2D,
    info: NodeRenderInfo,
    lod: 'minimal' | 'simple' | 'full'
  ): void {
    const { node, radius, color, borderColor, glowIntensity } = info;
    const x = node.x_position;
    const y = node.y_position;

    ctx.save();

    // Draw glow effect for allocated/hovered nodes
    if (glowIntensity > 0 && lod !== 'minimal') {
      const statColor = STAT_COLORS[node.primary_stat];
      const glowRadius = radius * (1 + glowIntensity);
      
      const gradient = this.getOrCreateRadialGradient(
        ctx, x, y, glowRadius, statColor.glow, glowIntensity
      );
      
      ctx.globalAlpha = glowIntensity * 0.8;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Reset alpha for main node
    ctx.globalAlpha = 1;

    // Draw main node circle
    ctx.fillStyle = color;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Draw subtle distance-based inner ring (only for non-allocated nodes)
    if (info.status !== 'allocated' && info.distanceColor && lod !== 'minimal') {
      const innerRadius = radius * 0.6;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = info.distanceColor;
      ctx.beginPath();
      ctx.arc(x, y, innerRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw node content based on LOD
    if (lod === 'full') {
      this.renderNodeDetails(ctx, info);
    } else if (lod === 'simple' && (info.status === 'allocated' || info.status === 'available')) {
      this.renderNodeSimple(ctx, info);
    }
    // Minimal LOD just shows the basic circle

    ctx.restore();
  }

  // Render detailed node content (full LOD)
  private renderNodeDetails(ctx: CanvasRenderingContext2D, info: NodeRenderInfo): void {
    const { node, radius, status } = info;
    const x = node.x_position;
    const y = node.y_position;

    // Draw a small dot in the center to indicate node type
    // This should NOT cover the whole node, just be a small indicator
    ctx.save();
    
    let dotRadius = radius * 0.2; // Small dot, 20% of node radius
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Semi-transparent black
    
    if (node.node_type === 'start') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      dotRadius = radius * 0.3;
    }
    
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.restore();

    // Draw skill point cost for unallocated nodes
    if (status !== 'allocated' && node.skill_point_cost > 1) {
      ctx.font = `${Math.max(6, radius * 0.3)}px Arial`;
      ctx.fillStyle = '#FFAA00';
      ctx.fillText(node.skill_point_cost.toString(), x, y + radius + 8);
    }
  }

  // Render simplified node content (simple LOD)
  private renderNodeSimple(ctx: CanvasRenderingContext2D, info: NodeRenderInfo): void {
    const { node, status } = info;
    const x = node.x_position;
    const y = node.y_position;

    // Just draw a simple dot in the center for important nodes
    if (status === 'allocated' || node.node_type === 'start') {
      ctx.fillStyle = status === 'allocated' ? '#FFFFFF' : '#FFAA00';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Get or create a cached radial gradient
  private getOrCreateRadialGradient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    intensity: number
  ): CanvasGradient {
    // Validate inputs to prevent non-finite values - return safe fallback without logging
    if (!isFinite(x) || !isFinite(y) || !isFinite(radius) || radius <= 0) {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      return gradient;
    }
    
    const key = `${x},${y},${radius},${color},${intensity}`;
    
    if (!this.gradientCache.has(key)) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.gradientCache.set(key, gradient);
    }

    return this.gradientCache.get(key)!;
  }

  // Clear caches when needed
  clearCaches(): void {
    this.gradientCache.clear();
    this.textMetricsCache.clear();
  }

  // Get performance information
  getPerformanceInfo(): { cacheSize: number } {
    return {
      cacheSize: this.gradientCache.size + this.textMetricsCache.size
    };
  }
}