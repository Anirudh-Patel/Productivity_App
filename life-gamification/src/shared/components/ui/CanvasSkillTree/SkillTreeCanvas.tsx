import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { SkillNode, SkillTreeConnection, Viewport } from './types';
import { SkillTreeRenderer } from './SkillTreeRenderer';
import { ViewportManager } from './ViewportManager';
import { NodeInteractionManager } from './NodeInteractionManager';

interface SkillTreeCanvasProps {
  nodes: SkillNode[];
  connections: SkillTreeConnection[];
  allocatedNodes: Set<string>;
  availablePoints: number;
  userLevel: number;
  onNodeClick: (nodeKey: string) => void;
  onNodeHover: (nodeKey: string | null) => void;
  onViewportChange?: (viewport: Viewport) => void;
  editMode?: boolean;
  onNodePositionChange?: (nodeKey: string, x: number, y: number) => void;
  className?: string;
}

export const SkillTreeCanvas: React.FC<SkillTreeCanvasProps> = ({
  nodes,
  connections,
  allocatedNodes,
  availablePoints,
  userLevel,
  onNodeClick,
  onNodeHover,
  onViewportChange,
  editMode = false,
  onNodePositionChange,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastRenderTimeRef = useRef(0);
  
  // Debug logging
  console.log('SkillTreeCanvas: Rendering with', {
    nodeCount: nodes?.length || 0,
    connectionCount: connections?.length || 0,
    allocatedCount: allocatedNodes?.size || 0
  });
  
  // Viewport state
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    zoom: 0.3,
    width: 800, // Default width instead of 0
    height: 600  // Default height instead of 0
  });
  
  // Interaction state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartMousePos, setDragStartMousePos] = useState({ x: 0, y: 0 });
  
  // Refs to track initial state
  const hasInitiallyCenteredRef = useRef(false);
  const initialNodeCountRef = useRef(0);
  
  // Managers
  const viewportManager = useMemo(() => new ViewportManager(), []);
  const renderer = useMemo(() => new SkillTreeRenderer(), []);
  const interactionManager = useMemo(() => new NodeInteractionManager(), []);
  
  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Update viewport
    setViewport(prev => ({
      ...prev,
      width: rect.width,
      height: rect.height
    }));
    
    // Scale context for high DPI
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);
  
  // Center viewport on skill tree initially and fit to screen
  const centerViewport = useCallback(() => {
    if (nodes.length === 0 || viewport.width === 0 || viewport.height === 0) {
      return;
    }
    
    const optimalViewport = viewportManager.calculateOptimalViewport(
      nodes,
      viewport.width,
      viewport.height
    );
    
    setViewport(optimalViewport);
  }, [nodes, viewport.width, viewport.height, viewportManager]);
  
  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldX = (x - viewport.x) / viewport.zoom;
    const worldY = (y - viewport.y) / viewport.zoom;
    
    // Check if clicking on a node
    const clickedNode = interactionManager.findNodeAt(worldX, worldY, nodes);
    
    if (clickedNode) {
      if (editMode) {
        // Start dragging node in edit mode
        setIsDraggingNode(true);
        setDraggingNode(clickedNode.node_key);
        setDragStartPos({ x: clickedNode.x_position, y: clickedNode.y_position });
        setDragStartMousePos({ x: e.clientX, y: e.clientY });
        setLastMousePos({ x: e.clientX, y: e.clientY });
      } else {
        // Normal node click
        onNodeClick(clickedNode.node_key);
      }
    } else {
      // Start dragging viewport
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [viewport, nodes, onNodeClick, interactionManager, editMode]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDraggingNode && draggingNode) {
      // Update last mouse position for dragging calculation
      setLastMousePos({ x: e.clientX, y: e.clientY });
      
    } else if (isDragging) {
      // Pan the viewport
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setViewport(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else {
      // Check for node hover
      const worldX = (x - viewport.x) / viewport.zoom;
      const worldY = (y - viewport.y) / viewport.zoom;
      
      const hoveredNodeKey = interactionManager.findNodeAt(worldX, worldY, nodes);
      const nodeKey = hoveredNodeKey?.node_key || null;
      
      if (nodeKey !== hoveredNode) {
        setHoveredNode(nodeKey);
        onNodeHover(nodeKey);
      }
    }
  }, [isDragging, isDraggingNode, draggingNode, lastMousePos, viewport, nodes, hoveredNode, onNodeHover, interactionManager, dragStartPos]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDraggingNode && draggingNode && onNodePositionChange) {
      // Calculate final position using the initial mouse position stored in dragStartPos
      // and current mouse position to get the total movement
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate total delta in screen coordinates using the stored start position
        const totalDeltaX = (e.clientX - dragStartMousePos.x) / viewport.zoom;
        const totalDeltaY = (e.clientY - dragStartMousePos.y) / viewport.zoom;
        
        // Calculate new world position
        const newX = dragStartPos.x + totalDeltaX;
        const newY = dragStartPos.y + totalDeltaY;
        
        console.log(`Moving node ${draggingNode} from (${dragStartPos.x}, ${dragStartPos.y}) to (${newX}, ${newY})`);
        // Use local update instead of async database update
        onNodePositionChange(draggingNode, newX, newY);
      }
    }
    
    // Reset all drag states
    setIsDragging(false);
    setIsDraggingNode(false);
    setDraggingNode(null);
    setDragStartPos({ x: 0, y: 0 });
    setDragStartMousePos({ x: 0, y: 0 });
  }, [isDraggingNode, draggingNode, onNodePositionChange, dragStartPos, dragStartMousePos, viewport]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom towards mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3.0, viewport.zoom * zoomFactor));
    
    if (newZoom !== viewport.zoom) {
      const worldX = (mouseX - viewport.x) / viewport.zoom;
      const worldY = (mouseY - viewport.y) / viewport.zoom;
      
      setViewport(prev => ({
        ...prev,
        zoom: newZoom,
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom
      }));
    }
  }, [viewport]);
  
  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      // Stop render loop if canvas is not available
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    
    // Save context
    ctx.save();
    
    // Apply viewport transformation
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    
    // Get visible bounds for culling
    const visibleBounds = viewportManager.getVisibleBounds(viewport);
    
    // Cull nodes and connections outside viewport for performance
    const visibleNodes = viewportManager.cullNodes(nodes, visibleBounds);
    const visibleConnections = viewportManager.cullConnections(connections, visibleBounds, nodes);
    
    // Get level of detail based on zoom
    const lod = renderer.getLOD(viewport.zoom);
    
    // Debug removed - culling disabled to show all nodes
    
    // Render connections first (so they appear behind nodes)
    renderer.renderConnections(ctx, visibleConnections, nodes, allocatedNodes, lod);
    
    // Render nodes
    renderer.renderNodes(ctx, visibleNodes, {
      allocatedNodes,
      hoveredNode,
      availablePoints,
      userLevel,
      lod
    });
    
    // Restore context
    ctx.restore();
    
    // Schedule next frame - limit to 60fps
    const renderNow = performance.now();
    if (renderNow - lastRenderTimeRef.current < 16) { // ~60fps limit
      animationFrameRef.current = requestAnimationFrame(render);
      return;
    }
    lastRenderTimeRef.current = renderNow;
    
    animationFrameRef.current = requestAnimationFrame(render);
  }, [viewport, nodes, connections, allocatedNodes, hoveredNode, availablePoints, userLevel, viewportManager, renderer]);
  
  // Setup canvas and start render loop
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);
  
  // Center viewport when nodes are first loaded (not when positions change)
  useEffect(() => {
    if (nodes.length > 0 && viewport.width > 0 && viewport.height > 0 && !isDraggingNode) {
      // Only center if we haven't centered yet or if nodes count actually changed (not just position updates)
      const nodeCountChanged = nodes.length !== initialNodeCountRef.current;
      
      if (!hasInitiallyCenteredRef.current || nodeCountChanged) {
        hasInitiallyCenteredRef.current = true;
        initialNodeCountRef.current = nodes.length;
        centerViewport();
      }
    }
  }, [nodes.length, viewport.width, viewport.height, centerViewport, isDraggingNode]);
  
  // Notify parent of viewport changes
  useEffect(() => {
    if (onViewportChange) {
      onViewportChange(viewport);
    }
  }, [viewport, onViewportChange]);
  
  // Start/stop render loop
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Test render removed - skill tree is working
    
    animationFrameRef.current = requestAnimationFrame(render);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render, nodes]);
  
  // Reset viewport to center
  const handleReset = useCallback(() => {
    centerViewport();
  }, [centerViewport]);
  
  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${editMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ 
          cursor: isDraggingNode ? 'move' : 
                  isDragging ? 'grabbing' : 
                  editMode ? 'crosshair' : 'grab' 
        }}
      />
      
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleReset}
          className="px-3 py-2 bg-theme-primary border border-gray-700 rounded text-white text-sm hover:bg-gray-800 transition-colors"
        >
          Reset View
        </button>
        
        <button
          onClick={() => {
            console.log('DEBUG: Manual center viewport trigger');
            console.log('Current viewport:', viewport);
            console.log('Nodes count:', nodes.length);
            if (nodes.length > 0) {
              console.log('Node sample:', nodes.slice(0, 5).map(n => ({
                key: n.node_key,
                x: n.x_position,
                y: n.y_position
              })));
            }
            centerViewport();
          }}
          className="px-3 py-2 bg-blue-600 border border-gray-700 rounded text-white text-sm hover:bg-blue-700 transition-colors"
        >
          Debug Center
        </button>
        
        <div className="px-3 py-2 bg-theme-primary border border-gray-700 rounded text-white text-xs">
          Zoom: {Math.round(viewport.zoom * 100)}%
        </div>
        
        <div className="px-3 py-2 bg-theme-primary border border-gray-700 rounded text-white text-xs">
          Nodes: {nodes.length}
        </div>
        
        <div className="px-3 py-2 bg-theme-primary border border-gray-700 rounded text-white text-xs">
          Viewport: {Math.round(viewport.x)},{Math.round(viewport.y)}
        </div>
        
        {editMode && (
          <div className="px-3 py-2 bg-orange-600 border border-orange-500 rounded text-white text-xs font-bold">
            🔧 Edit Mode
          </div>
        )}
      </div>
      
      {/* Performance info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 px-3 py-2 bg-black bg-opacity-75 rounded text-white text-xs font-mono">
          <div>Visible Nodes: {viewportManager.cullNodes(nodes, viewportManager.getVisibleBounds(viewport)).length}</div>
          <div>LOD: {renderer.getLOD(viewport.zoom)}</div>
          <div>Allocated: {allocatedNodes.size}</div>
        </div>
      )}
    </div>
  );
};