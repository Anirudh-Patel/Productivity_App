import {
  SkillNode,
  SkillTreeConnection,
  ViewportBounds,
  Viewport,
  SKILL_TREE_CONFIG
} from './types';

export class ViewportManager {
  // Calculate visible bounds for viewport culling
  getVisibleBounds(viewport: Viewport): ViewportBounds {
    const margin = SKILL_TREE_CONFIG.cullingMargin;
    
    return {
      left: (-viewport.x / viewport.zoom) - margin,
      right: (viewport.width - viewport.x) / viewport.zoom + margin,
      top: (-viewport.y / viewport.zoom) - margin,
      bottom: (viewport.height - viewport.y) / viewport.zoom + margin
    };
  }

  // Cull nodes outside the visible viewport
  cullNodes(nodes: SkillNode[], bounds: ViewportBounds): SkillNode[] {
    return nodes.filter(node => {
      const radius = SKILL_TREE_CONFIG.nodeRadius[node.size] || 8;
      
      return (
        node.x_position + radius >= bounds.left &&
        node.x_position - radius <= bounds.right &&
        node.y_position + radius >= bounds.top &&
        node.y_position - radius <= bounds.bottom
      );
    });
  }

  // Cull connections outside the visible viewport
  cullConnections(
    connections: SkillTreeConnection[],
    bounds: ViewportBounds,
    nodes: SkillNode[]
  ): SkillTreeConnection[] {
    const nodeMap = new Map(nodes.map(n => [n.node_key, n]));
    
    return connections.filter(connection => {
      const fromNode = nodeMap.get(connection.from_node);
      const toNode = nodeMap.get(connection.to_node);
      
      if (!fromNode || !toNode) return false;
      
      // Check if connection line intersects with viewport bounds
      return this.lineIntersectsRect(
        fromNode.x_position,
        fromNode.y_position,
        toNode.x_position,
        toNode.y_position,
        bounds
      );
    });
  }

  // Check if a line intersects with a rectangle (viewport bounds)
  private lineIntersectsRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bounds: ViewportBounds
  ): boolean {
    // First check if either endpoint is inside the bounds
    if (this.pointInRect(x1, y1, bounds) || this.pointInRect(x2, y2, bounds)) {
      return true;
    }

    // Check if line intersects any of the four rectangle edges
    return (
      this.lineSegmentsIntersect(x1, y1, x2, y2, bounds.left, bounds.top, bounds.right, bounds.top) || // top edge
      this.lineSegmentsIntersect(x1, y1, x2, y2, bounds.right, bounds.top, bounds.right, bounds.bottom) || // right edge
      this.lineSegmentsIntersect(x1, y1, x2, y2, bounds.right, bounds.bottom, bounds.left, bounds.bottom) || // bottom edge
      this.lineSegmentsIntersect(x1, y1, x2, y2, bounds.left, bounds.bottom, bounds.left, bounds.top) // left edge
    );
  }

  // Check if a point is inside a rectangle
  private pointInRect(x: number, y: number, bounds: ViewportBounds): boolean {
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }

  // Check if two line segments intersect
  private lineSegmentsIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): boolean {
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denominator) < 1e-10) {
      return false; // Lines are parallel
    }
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX: number, screenY: number, viewport: Viewport): { x: number; y: number } {
    return {
      x: (screenX - viewport.x) / viewport.zoom,
      y: (screenY - viewport.y) / viewport.zoom
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number, viewport: Viewport): { x: number; y: number } {
    return {
      x: worldX * viewport.zoom + viewport.x,
      y: worldY * viewport.zoom + viewport.y
    };
  }

  // Calculate optimal viewport to show all nodes
  calculateOptimalViewport(nodes: SkillNode[], containerWidth: number, containerHeight: number): Viewport {
    // Validate inputs
    if (nodes.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
      return {
        x: 0,
        y: 0,
        zoom: 0.3,
        width: Math.max(containerWidth, 800),
        height: Math.max(containerHeight, 600)
      };
    }

    // Calculate bounding box of all nodes
    const bounds = {
      minX: Math.min(...nodes.map(n => n.x_position)),
      maxX: Math.max(...nodes.map(n => n.x_position)),
      minY: Math.min(...nodes.map(n => n.y_position)),
      maxY: Math.max(...nodes.map(n => n.y_position))
    };

    const padding = 100; // Padding around the skill tree
    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    // Calculate zoom to fit content
    const zoomX = containerWidth / contentWidth;
    const zoomY = containerHeight / contentHeight;
    let zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 100%

    // Ensure zoom is valid and within reasonable bounds for visibility
    zoom = Math.max(0.15, Math.min(zoom, 2.0)); // Minimum 0.15 so nodes are always visible
    if (!isFinite(zoom)) zoom = 0.3;

    // Calculate center position
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const x = containerWidth / 2 - centerX * zoom;
    const y = containerHeight / 2 - centerY * zoom;

    return {
      x: isFinite(x) ? x : 0,
      y: isFinite(y) ? y : 0,
      zoom,
      width: containerWidth,
      height: containerHeight
    };
  }

  // Get statistics about viewport culling
  getCullingStats(
    nodes: SkillNode[],
    connections: SkillTreeConnection[],
    viewport: Viewport
  ): {
    totalNodes: number;
    visibleNodes: number;
    totalConnections: number;
    visibleConnections: number;
    cullingRatio: number;
  } {
    const bounds = this.getVisibleBounds(viewport);
    const visibleNodes = this.cullNodes(nodes, bounds);
    const visibleConnections = this.cullConnections(connections, bounds, nodes);

    const totalElements = nodes.length + connections.length;
    const visibleElements = visibleNodes.length + visibleConnections.length;
    const cullingRatio = totalElements > 0 ? (totalElements - visibleElements) / totalElements : 0;

    return {
      totalNodes: nodes.length,
      visibleNodes: visibleNodes.length,
      totalConnections: connections.length,
      visibleConnections: visibleConnections.length,
      cullingRatio
    };
  }

  // Check if viewport needs updating based on user interaction
  shouldUpdateViewport(
    oldViewport: Viewport,
    newViewport: Viewport,
    threshold: number = 1
  ): boolean {
    const deltaX = Math.abs(newViewport.x - oldViewport.x);
    const deltaY = Math.abs(newViewport.y - oldViewport.y);
    const deltaZoom = Math.abs(newViewport.zoom - oldViewport.zoom);

    return deltaX > threshold || deltaY > threshold || deltaZoom > 0.01;
  }

  // Clamp viewport to reasonable bounds to prevent infinite scrolling
  clampViewport(viewport: Viewport, nodes: SkillNode[]): Viewport {
    if (nodes.length === 0) return viewport;

    // Calculate content bounds
    const contentBounds = {
      minX: Math.min(...nodes.map(n => n.x_position)) - 500,
      maxX: Math.max(...nodes.map(n => n.x_position)) + 500,
      minY: Math.min(...nodes.map(n => n.y_position)) - 500,
      maxY: Math.max(...nodes.map(n => n.y_position)) + 500
    };

    // Clamp zoom
    const clampedZoom = Math.max(0.1, Math.min(3.0, viewport.zoom));

    // Calculate max pan distances based on content bounds
    const maxX = viewport.width - contentBounds.minX * clampedZoom;
    const minX = -contentBounds.maxX * clampedZoom;
    const maxY = viewport.height - contentBounds.minY * clampedZoom;
    const minY = -contentBounds.maxY * clampedZoom;

    return {
      ...viewport,
      x: Math.max(minX, Math.min(maxX, viewport.x)),
      y: Math.max(minY, Math.min(maxY, viewport.y)),
      zoom: clampedZoom
    };
  }

  // Calculate viewport center in world coordinates
  getViewportCenter(viewport: Viewport): { x: number; y: number } {
    return {
      x: (viewport.width / 2 - viewport.x) / viewport.zoom,
      y: (viewport.height / 2 - viewport.y) / viewport.zoom
    };
  }

  // Set viewport to center on specific world coordinates
  centerOnPoint(
    x: number,
    y: number,
    viewport: Viewport,
    zoom?: number
  ): Viewport {
    const newZoom = zoom !== undefined ? zoom : viewport.zoom;
    
    return {
      ...viewport,
      x: viewport.width / 2 - x * newZoom,
      y: viewport.height / 2 - y * newZoom,
      zoom: newZoom
    };
  }

  // Animate viewport to target position (returns interpolated viewport)
  interpolateViewport(
    current: Viewport,
    target: Viewport,
    progress: number // 0 to 1
  ): Viewport {
    const ease = (t: number) => t * t * (3 - 2 * t); // Smooth step function
    const easedProgress = ease(progress);

    return {
      x: current.x + (target.x - current.x) * easedProgress,
      y: current.y + (target.y - current.y) * easedProgress,
      zoom: current.zoom + (target.zoom - current.zoom) * easedProgress,
      width: current.width,
      height: current.height
    };
  }
}