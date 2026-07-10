# Claude Code Layout Debugger Implementation Guide

A comprehensive guide for implementing a visual layout debugger to fix overlapping nodes in canvas-based skill trees or node graphs.

## Overview

The Layout Debugger is a development tool that helps identify and fix overlapping nodes in complex node-based visualizations. It provides three visualization modes to debug node positioning issues:

1. **Point Mode**: Shows node centers as dots for quick overlap detection
2. **Rectangle Mode**: Displays node bounding boxes to identify collision areas
3. **Anchor Points Mode**: Visualizes connection anchor points for debugging edge routing

## Core Features

### 1. Point Mode
- Renders only node center points
- Color-codes by node type or allocation status
- Minimal rendering for maximum clarity
- Best for identifying clustering issues

### 2. Rectangle Mode
- Shows full bounding boxes around nodes
- Highlights overlapping regions in red
- Displays collision detection boundaries
- Useful for spacing adjustments

### 3. Anchor Points Mode
- Shows connection anchor points on node perimeters
- Visualizes edge routing paths
- Helps debug connection rendering issues
- Identifies anchor point conflicts

## Implementation

### Step 1: Create the Layout Debugger Component

```typescript
// LayoutDebugger.tsx
import React, { useState, useEffect, useRef } from 'react';

interface LayoutDebuggerProps {
  nodes: Array<{
    node_key: string;
    x_position: number;
    y_position: number;
    size: 'small' | 'medium' | 'large' | 'massive';
    node_type: string;
    allocated?: boolean;
  }>;
  connections: Array<{
    from_node: string;
    to_node: string;
  }>;
  viewport: {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
  };
  enabled: boolean;
}

type DebugMode = 'point' | 'rectangle' | 'anchor';

export const LayoutDebugger: React.FC<LayoutDebuggerProps> = ({
  nodes,
  connections,
  viewport,
  enabled
}) => {
  const [mode, setMode] = useState<DebugMode>('point');
  const [showOverlaps, setShowOverlaps] = useState(true);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Node size mappings
  const NODE_SIZES = {
    small: 8,
    medium: 12,
    large: 16,
    massive: 24
  };

  // Detect overlapping nodes
  const detectOverlaps = () => {
    const overlaps: Set<string> = new Set();
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        
        const r1 = NODE_SIZES[node1.size];
        const r2 = NODE_SIZES[node2.size];
        
        const distance = Math.sqrt(
          Math.pow(node1.x_position - node2.x_position, 2) +
          Math.pow(node1.y_position - node2.y_position, 2)
        );
        
        if (distance < (r1 + r2)) {
          overlaps.add(node1.node_key);
          overlaps.add(node2.node_key);
        }
      }
    }
    
    return overlaps;
  };

  // Render debug overlay
  const render = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !enabled) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context
    ctx.save();
    
    // Apply viewport transformation
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    
    const overlappingNodes = showOverlaps ? detectOverlaps() : new Set();

    switch (mode) {
      case 'point':
        renderPointMode(ctx, overlappingNodes);
        break;
      case 'rectangle':
        renderRectangleMode(ctx, overlappingNodes);
        break;
      case 'anchor':
        renderAnchorMode(ctx);
        break;
    }
    
    // Restore context
    ctx.restore();
  };

  const renderPointMode = (ctx: CanvasRenderingContext2D, overlaps: Set<string>) => {
    nodes.forEach(node => {
      // Set color based on overlap status
      if (overlaps.has(node.node_key)) {
        ctx.fillStyle = '#FF0000'; // Red for overlapping
      } else if (node.allocated) {
        ctx.fillStyle = '#00FF00'; // Green for allocated
      } else {
        ctx.fillStyle = '#FFFF00'; // Yellow for available
      }
      
      // Draw point
      ctx.beginPath();
      ctx.arc(node.x_position, node.y_position, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw node key label if highlighted
      if (node.node_key === highlightedNode) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px monospace';
        ctx.fillText(node.node_key, node.x_position + 5, node.y_position - 5);
      }
    });
  };

  const renderRectangleMode = (ctx: CanvasRenderingContext2D, overlaps: Set<string>) => {
    nodes.forEach(node => {
      const radius = NODE_SIZES[node.size];
      
      // Set style based on overlap
      if (overlaps.has(node.node_key)) {
        ctx.strokeStyle = '#FF0000';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      } else {
        ctx.strokeStyle = '#00FF00';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      }
      
      // Draw bounding box
      ctx.beginPath();
      ctx.rect(
        node.x_position - radius,
        node.y_position - radius,
        radius * 2,
        radius * 2
      );
      ctx.fill();
      ctx.stroke();
      
      // Draw center point
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(node.x_position, node.y_position, 1, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const renderAnchorMode = (ctx: CanvasRenderingContext2D) => {
    // Create node lookup map
    const nodeMap = new Map(nodes.map(n => [n.node_key, n]));
    
    nodes.forEach(node => {
      const radius = NODE_SIZES[node.size];
      
      // Draw node circle
      ctx.strokeStyle = '#666666';
      ctx.beginPath();
      ctx.arc(node.x_position, node.y_position, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Calculate and draw anchor points (8 points around the circle)
      const anchorCount = 8;
      for (let i = 0; i < anchorCount; i++) {
        const angle = (Math.PI * 2 * i) / anchorCount;
        const anchorX = node.x_position + Math.cos(angle) * radius;
        const anchorY = node.y_position + Math.sin(angle) * radius;
        
        // Draw anchor point
        ctx.fillStyle = '#00FFFF';
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Draw connections to show which anchors are used
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.lineWidth = 1;
    connections.forEach(conn => {
      const fromNode = nodeMap.get(conn.from_node);
      const toNode = nodeMap.get(conn.to_node);
      
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x_position, fromNode.y_position);
        ctx.lineTo(toNode.x_position, toNode.y_position);
        ctx.stroke();
      }
    });
  };

  // Setup canvas and render loop
  useEffect(() => {
    if (!enabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render
    render();
  }, [nodes, connections, viewport, mode, showOverlaps, enabled, highlightedNode]);

  if (!enabled) return null;

  return (
    <>
      {/* Debug overlay canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      />
      
      {/* Control panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: '1px solid #00FF00',
        borderRadius: '4px',
        padding: '10px',
        color: '#00FF00',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 1001
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>🐛 Layout Debugger</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Mode:
            <select 
              value={mode} 
              onChange={(e) => setMode(e.target.value as DebugMode)}
              style={{
                marginLeft: '5px',
                background: '#000',
                color: '#0F0',
                border: '1px solid #0F0'
              }}
            >
              <option value="point">Point Mode</option>
              <option value="rectangle">Rectangle Mode</option>
              <option value="anchor">Anchor Points</option>
            </select>
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            <input
              type="checkbox"
              checked={showOverlaps}
              onChange={(e) => setShowOverlaps(e.target.checked)}
              style={{ marginRight: '5px' }}
            />
            Highlight Overlaps
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <strong>Statistics:</strong>
          <div>Total Nodes: {nodes.length}</div>
          <div>Overlapping: {detectOverlaps().size}</div>
          <div>Connections: {connections.length}</div>
        </div>
        
        <div>
          <strong>Node Inspector:</strong>
          <input
            type="text"
            placeholder="Enter node key..."
            onChange={(e) => setHighlightedNode(e.target.value || null)}
            style={{
              width: '100%',
              marginTop: '5px',
              background: '#000',
              color: '#0F0',
              border: '1px solid #0F0',
              padding: '2px'
            }}
          />
        </div>
      </div>
    </>
  );
};
```

### Step 2: Integrate with Main Canvas Component

```typescript
// SkillTreeCanvas.tsx
import { LayoutDebugger } from './LayoutDebugger';

export const SkillTreeCanvas: React.FC<SkillTreeCanvasProps> = (props) => {
  const [debugMode, setDebugMode] = useState(false);
  
  // Toggle debug mode with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug mode
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Main canvas */}
      <canvas ref={canvasRef} ... />
      
      {/* Debug overlay */}
      <LayoutDebugger
        nodes={nodes}
        connections={connections}
        viewport={viewport}
        enabled={debugMode}
      />
      
      {/* Debug mode indicator */}
      {debugMode && (
        <div className="absolute bottom-4 right-4 px-3 py-1 bg-green-500 text-black text-xs font-bold rounded">
          DEBUG MODE (Ctrl+Shift+D to toggle)
        </div>
      )}
    </div>
  );
};
```

### Step 3: Add Advanced Debugging Features

```typescript
// DebuggerUtils.ts
export class DebuggerUtils {
  // Generate overlap report
  static generateOverlapReport(nodes: SkillNode[]): string {
    const overlaps: Array<{
      node1: string;
      node2: string;
      distance: number;
      overlap: number;
    }> = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const distance = this.calculateDistance(n1, n2);
        const minDistance = this.getMinDistance(n1, n2);
        
        if (distance < minDistance) {
          overlaps.push({
            node1: n1.node_key,
            node2: n2.node_key,
            distance,
            overlap: minDistance - distance
          });
        }
      }
    }
    
    return JSON.stringify(overlaps, null, 2);
  }
  
  // Auto-fix overlapping nodes
  static autoFixOverlaps(nodes: SkillNode[]): SkillNode[] {
    const fixed = [...nodes];
    const iterations = 100;
    const pushForce = 0.1;
    
    for (let iter = 0; iter < iterations; iter++) {
      let hasOverlap = false;
      
      for (let i = 0; i < fixed.length; i++) {
        for (let j = i + 1; j < fixed.length; j++) {
          const n1 = fixed[i];
          const n2 = fixed[j];
          const distance = this.calculateDistance(n1, n2);
          const minDistance = this.getMinDistance(n1, n2);
          
          if (distance < minDistance && distance > 0) {
            hasOverlap = true;
            
            // Calculate push vector
            const dx = n2.x_position - n1.x_position;
            const dy = n2.y_position - n1.y_position;
            const pushDistance = (minDistance - distance) * pushForce;
            
            // Normalize and apply push
            const norm = Math.sqrt(dx * dx + dy * dy);
            fixed[j].x_position += (dx / norm) * pushDistance;
            fixed[j].y_position += (dy / norm) * pushDistance;
            fixed[i].x_position -= (dx / norm) * pushDistance;
            fixed[i].y_position -= (dy / norm) * pushDistance;
          }
        }
      }
      
      if (!hasOverlap) break;
    }
    
    return fixed;
  }
  
  private static calculateDistance(n1: SkillNode, n2: SkillNode): number {
    return Math.sqrt(
      Math.pow(n1.x_position - n2.x_position, 2) +
      Math.pow(n1.y_position - n2.y_position, 2)
    );
  }
  
  private static getMinDistance(n1: SkillNode, n2: SkillNode): number {
    const NODE_SIZES = { small: 8, medium: 12, large: 16, massive: 24 };
    return NODE_SIZES[n1.size] + NODE_SIZES[n2.size] + 10; // 10px padding
  }
}
```

### Step 4: Add Export/Import for Position Data

```typescript
// PositionExporter.ts
export class PositionExporter {
  static exportPositions(nodes: SkillNode[]): string {
    const positions = nodes.map(node => ({
      key: node.node_key,
      x: Math.round(node.x_position),
      y: Math.round(node.y_position)
    }));
    
    return JSON.stringify(positions, null, 2);
  }
  
  static importPositions(jsonString: string, nodes: SkillNode[]): SkillNode[] {
    try {
      const positions = JSON.parse(jsonString);
      const positionMap = new Map(positions.map(p => [p.key, p]));
      
      return nodes.map(node => {
        const newPos = positionMap.get(node.node_key);
        if (newPos) {
          return {
            ...node,
            x_position: newPos.x,
            y_position: newPos.y
          };
        }
        return node;
      });
    } catch (error) {
      console.error('Failed to import positions:', error);
      return nodes;
    }
  }
  
  static downloadPositions(nodes: SkillNode[]) {
    const data = this.exportPositions(nodes);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'node-positions.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

## Usage Instructions

### For Claude Code Users

1. **Enable Debug Mode**:
   - Press `Ctrl+Shift+D` while viewing the skill tree
   - The debug overlay will appear with controls

2. **Using Point Mode**:
   - Best for initial overlap detection
   - Red dots indicate overlapping nodes
   - Green dots show allocated nodes
   - Yellow dots show available nodes

3. **Using Rectangle Mode**:
   - Shows exact collision boundaries
   - Red boxes indicate overlapping areas
   - Useful for determining required spacing

4. **Using Anchor Points Mode**:
   - Visualizes connection attachment points
   - Helps debug edge routing issues
   - Shows which anchors are actively used

5. **Fix Overlaps**:
   - Use the auto-fix feature for initial correction
   - Fine-tune with manual drag-and-drop
   - Export positions once satisfied

### Keyboard Shortcuts

- `Ctrl+Shift+D`: Toggle debug mode
- `Ctrl+Shift+P`: Switch to Point mode
- `Ctrl+Shift+R`: Switch to Rectangle mode
- `Ctrl+Shift+A`: Switch to Anchor mode
- `Ctrl+Shift+E`: Export positions
- `Ctrl+Shift+F`: Auto-fix overlaps

## Advanced Features

### Overlap Detection Algorithm

```typescript
// Spatial indexing for performance
class SpatialIndex {
  private grid: Map<string, SkillNode[]> = new Map();
  private cellSize = 100;
  
  constructor(nodes: SkillNode[]) {
    nodes.forEach(node => this.add(node));
  }
  
  private getCell(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }
  
  add(node: SkillNode) {
    const cell = this.getCell(node.x_position, node.y_position);
    if (!this.grid.has(cell)) {
      this.grid.set(cell, []);
    }
    this.grid.get(cell)!.push(node);
  }
  
  getNearby(node: SkillNode): SkillNode[] {
    const nearby: SkillNode[] = [];
    const cx = Math.floor(node.x_position / this.cellSize);
    const cy = Math.floor(node.y_position / this.cellSize);
    
    // Check surrounding cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = `${cx + dx},${cy + dy}`;
        if (this.grid.has(cell)) {
          nearby.push(...this.grid.get(cell)!);
        }
      }
    }
    
    return nearby.filter(n => n.node_key !== node.node_key);
  }
}
```

### Performance Monitoring

```typescript
// Add to debug panel
const [performanceStats, setPerformanceStats] = useState({
  renderTime: 0,
  overlapChecks: 0,
  fps: 0
});

useEffect(() => {
  let frameCount = 0;
  let lastTime = performance.now();
  
  const measurePerformance = () => {
    const now = performance.now();
    const delta = now - lastTime;
    
    frameCount++;
    if (delta >= 1000) {
      setPerformanceStats({
        renderTime: delta / frameCount,
        overlapChecks: nodes.length * (nodes.length - 1) / 2,
        fps: frameCount
      });
      frameCount = 0;
      lastTime = now;
    }
    
    requestAnimationFrame(measurePerformance);
  };
  
  measurePerformance();
}, [nodes.length]);
```

## Troubleshooting

### Common Issues

1. **Debug overlay not showing**:
   - Ensure z-index is higher than main canvas
   - Check that `pointerEvents: 'none'` is set
   - Verify debug mode is enabled

2. **Performance issues with many nodes**:
   - Implement spatial indexing
   - Use viewport culling
   - Reduce rendering frequency

3. **Incorrect overlap detection**:
   - Verify node size calculations
   - Check coordinate system consistency
   - Ensure viewport transformations are applied

## Best Practices

1. **Development Only**: Include debug code only in development builds
2. **Performance**: Use spatial indexing for large node counts
3. **Persistence**: Save fixed positions to avoid re-debugging
4. **Documentation**: Document any manual position adjustments
5. **Testing**: Test with various zoom levels and viewport positions

This layout debugger provides comprehensive tools for identifying and fixing node positioning issues in complex skill tree visualizations.