import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { SkillNode, Viewport, SKILL_TREE_CONFIG, STAT_COLORS } from '../CanvasSkillTree/types';

interface SkillTreeMinimapProps {
  nodes: SkillNode[];
  allocatedNodes: Set<string>;
  viewport: Viewport;
  onViewportChange: (newViewport: Partial<Viewport>) => void;
  className?: string;
}

export const SkillTreeMinimap: React.FC<SkillTreeMinimapProps> = ({
  nodes,
  allocatedNodes,
  viewport,
  onViewportChange,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Minimap dimensions
  const minimapSize = { width: 200, height: 200 };
  
  // Calculate world bounds
  const worldBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 4000, minY: 0, maxY: 4000 };
    
    return {
      minX: Math.min(...nodes.map(n => n.x_position)) - 100,
      maxX: Math.max(...nodes.map(n => n.x_position)) + 100,
      minY: Math.min(...nodes.map(n => n.y_position)) - 100,
      maxY: Math.max(...nodes.map(n => n.y_position)) + 100
    };
  }, [nodes]);

  // Calculate scale factors
  const scale = useMemo(() => {
    const worldWidth = worldBounds.maxX - worldBounds.minX;
    const worldHeight = worldBounds.maxY - worldBounds.minY;
    
    return {
      x: minimapSize.width / worldWidth,
      y: minimapSize.height / worldHeight,
      world: { width: worldWidth, height: worldHeight }
    };
  }, [worldBounds, minimapSize]);

  // Convert world coordinates to minimap coordinates
  const worldToMinimap = useCallback((worldX: number, worldY: number) => ({
    x: (worldX - worldBounds.minX) * scale.x,
    y: (worldY - worldBounds.minY) * scale.y
  }), [worldBounds, scale]);

  // Convert minimap coordinates to world coordinates
  const minimapToWorld = useCallback((minimapX: number, minimapY: number) => ({
    x: worldBounds.minX + (minimapX / scale.x),
    y: worldBounds.minY + (minimapY / scale.y)
  }), [worldBounds, scale]);

  // Render minimap
  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, minimapSize.width, minimapSize.height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, minimapSize.width, minimapSize.height);

    // Draw border
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, minimapSize.width, minimapSize.height);

    // Draw stat regions (rough areas)
    Object.entries(SKILL_TREE_CONFIG.startingNodes).forEach(([stat, config]) => {
      const minimapPos = worldToMinimap(config.x, config.y);
      const regionRadius = 60 * Math.min(scale.x, scale.y);
      
      // Draw region circle
      ctx.fillStyle = `${STAT_COLORS[stat as keyof typeof STAT_COLORS].primary}20`;
      ctx.beginPath();
      ctx.arc(minimapPos.x, minimapPos.y, regionRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw region border
      ctx.strokeStyle = `${STAT_COLORS[stat as keyof typeof STAT_COLORS].primary}60`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      const minimapPos = worldToMinimap(node.x_position, node.y_position);
      const isAllocated = allocatedNodes.has(node.node_key);
      const nodeRadius = Math.max(1, 3 * Math.min(scale.x, scale.y));

      if (isAllocated) {
        // Allocated nodes - bright and visible
        ctx.fillStyle = STAT_COLORS[node.primary_stat].primary;
        ctx.beginPath();
        ctx.arc(minimapPos.x, minimapPos.y, nodeRadius * 1.2, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Unallocated nodes - small gray dots
        ctx.fillStyle = '#444444';
        ctx.beginPath();
        ctx.arc(minimapPos.x, minimapPos.y, nodeRadius * 0.6, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Draw viewport indicator
    const viewportWorldBounds = {
      left: -viewport.x / viewport.zoom,
      right: (viewport.width - viewport.x) / viewport.zoom,
      top: -viewport.y / viewport.zoom,
      bottom: (viewport.height - viewport.y) / viewport.zoom
    };

    const topLeft = worldToMinimap(viewportWorldBounds.left, viewportWorldBounds.top);
    const bottomRight = worldToMinimap(viewportWorldBounds.right, viewportWorldBounds.bottom);

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );

    // Draw viewport corners for better visibility
    ctx.fillStyle = '#00ff00';
    const cornerSize = 3;
    [
      topLeft,
      { x: bottomRight.x, y: topLeft.y },
      bottomRight,
      { x: topLeft.x, y: bottomRight.y }
    ].forEach(corner => {
      ctx.fillRect(corner.x - cornerSize/2, corner.y - cornerSize/2, cornerSize, cornerSize);
    });
  }, [nodes, allocatedNodes, viewport, worldToMinimap, scale, worldBounds]);

  // Handle click to move viewport
  const handleMinimapClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const minimapX = e.clientX - rect.left;
    const minimapY = e.clientY - rect.top;

    const worldPos = minimapToWorld(minimapX, minimapY);

    // Center viewport on clicked position
    onViewportChange({
      x: viewport.width / 2 - worldPos.x * viewport.zoom,
      y: viewport.height / 2 - worldPos.y * viewport.zoom
    });
  }, [minimapToWorld, viewport, onViewportChange]);

  // Update canvas size and render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = minimapSize.width;
    canvas.height = minimapSize.height;
    
    renderMinimap();
  }, [renderMinimap, minimapSize]);

  return (
    <div ref={containerRef} className={`bg-gray-900 border border-gray-700 rounded ${className}`}>
      <div className="p-2">
        <div className="text-xs text-gray-400 mb-2 text-center">Skill Tree Overview</div>
        <canvas
          ref={canvasRef}
          width={minimapSize.width}
          height={minimapSize.height}
          className="cursor-pointer border border-gray-600 rounded"
          onClick={handleMinimapClick}
          style={{ width: minimapSize.width, height: minimapSize.height }}
        />
        
        {/* Legend */}
        <div className="mt-2 text-xs text-gray-400 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded mr-2"></div>
              <span>Current View</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded mr-2"></div>
              <span>Allocated</span>
            </div>
            <span>{allocatedNodes.size}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-gray-500 rounded mr-2"></div>
              <span>Available</span>
            </div>
            <span>{nodes.length - allocatedNodes.size}</span>
          </div>
        </div>
      </div>
    </div>
  );
};