import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Move, Eye, EyeOff, Maximize2 } from 'lucide-react';

interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  elementSelector?: string;
  relativeToViewport: boolean;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  color: string;
  label?: string;
}

export const LayoutDebugger: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [anchorPoints, setAnchorPoints] = useState<AnchorPoint[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [shapeMode, setShapeMode] = useState(false);
  const [shapePoints, setShapePoints] = useState<{x: number, y: number}[]>([]);
  const [rectangleMode, setRectangleMode] = useState(false);
  const [rectangle, setRectangle] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [isDraggingRect, setIsDraggingRect] = useState(false);
  const [isResizingRect, setIsResizingRect] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isEnabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
      ctx.lineWidth = 0.5;
      
      // Vertical lines every 50px
      for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Horizontal lines every 50px
      for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Major grid lines every 250px
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= canvas.width; x += 250) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvas.height; y += 250) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw connections
    connections.forEach(conn => {
      const fromPoint = anchorPoints.find(p => p.id === conn.from);
      const toPoint = anchorPoints.find(p => p.id === conn.to);
      
      if (fromPoint && toPoint) {
        ctx.strokeStyle = conn.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(fromPoint.x, fromPoint.y);
        ctx.lineTo(toPoint.x, toPoint.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Draw distance measurement
        if (showMeasurements) {
          const distance = Math.sqrt(
            Math.pow(toPoint.x - fromPoint.x, 2) + 
            Math.pow(toPoint.y - fromPoint.y, 2)
          );
          const midX = (fromPoint.x + toPoint.x) / 2;
          const midY = (fromPoint.y + toPoint.y) / 2;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(midX - 30, midY - 10, 60, 20);
          
          ctx.fillStyle = '#fff';
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(distance)}px`, midX, midY + 3);
        }
      }
    });

    // Draw anchor points
    anchorPoints.forEach(point => {
      // Draw point
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw center dot
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(point.x + 12, point.y - 10, point.label.length * 7 + 8, 20);
      
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(point.label, point.x + 16, point.y + 3);
      
      // Draw coordinates
      if (showMeasurements) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(point.x + 12, point.y + 12, 80, 16);
        
        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.fillText(`(${Math.round(point.x)}, ${Math.round(point.y)})`, point.x + 16, point.y + 23);
      }
    });

    // Draw rectangle mode
    if (rectangleMode && rectangle) {
      // Draw rectangle
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      
      // Draw corner handles
      ctx.fillStyle = '#00ff00';
      const handleSize = 8;
      
      // Top-left
      ctx.fillRect(rectangle.x - handleSize/2, rectangle.y - handleSize/2, handleSize, handleSize);
      // Top-right
      ctx.fillRect(rectangle.x + rectangle.width - handleSize/2, rectangle.y - handleSize/2, handleSize, handleSize);
      // Bottom-left
      ctx.fillRect(rectangle.x - handleSize/2, rectangle.y + rectangle.height - handleSize/2, handleSize, handleSize);
      // Bottom-right
      ctx.fillRect(rectangle.x + rectangle.width - handleSize/2, rectangle.y + rectangle.height - handleSize/2, handleSize, handleSize);
      
      // Draw dimensions
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(rectangle.x + rectangle.width/2 - 50, rectangle.y - 25, 100, 20);
      ctx.fillStyle = '#00ff00';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(rectangle.width)} × ${Math.round(rectangle.height)}`, rectangle.x + rectangle.width/2, rectangle.y - 10);
      
      // Draw coordinates
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(rectangle.x - 5, rectangle.y - 40, 90, 15);
      ctx.fillStyle = '#00ff00';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`(${Math.round(rectangle.x)}, ${Math.round(rectangle.y)})`, rectangle.x, rectangle.y - 28);
    }

    // Draw shape mode points and lines
    if (shapeMode && shapePoints.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#00ff00';
      
      // Draw lines between points
      ctx.beginPath();
      ctx.moveTo(shapePoints[0].x, shapePoints[0].y);
      for (let i = 1; i < shapePoints.length; i++) {
        ctx.lineTo(shapePoints[i].x, shapePoints[i].y);
      }
      ctx.stroke();
      
      // Draw points
      shapePoints.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Label points with numbers
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`${index + 1}`, point.x + 10, point.y - 5);
        ctx.fillStyle = '#00ff00';
      });
    }

  }, [isEnabled, anchorPoints, connections, showGrid, showMeasurements, windowSize, shapeMode, shapePoints, rectangleMode, rectangle]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEnabled) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Handle rectangle mode
    if (rectangleMode) {
      if (!rectangle) {
        // Create new rectangle
        setRectangle({ x, y, width: 100, height: 100 });
      }
      return;
    }
    
    // Handle shape mode
    if (shapeMode) {
      setShapePoints([...shapePoints, { x, y }]);
      return;
    }
    
    // Check if clicking on existing point
    const clickedPoint = anchorPoints.find(point => {
      const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
      return dist <= 10;
    });
    
    if (clickedPoint) {
      if (selectedPoint === clickedPoint.id) {
        setSelectedPoint(null);
      } else if (selectedPoint) {
        // Create connection
        const newConnection: Connection = {
          id: `${selectedPoint}-${clickedPoint.id}`,
          from: selectedPoint,
          to: clickedPoint.id,
          color: '#fbbf24',
        };
        setConnections([...connections, newConnection]);
        setSelectedPoint(null);
      } else {
        setSelectedPoint(clickedPoint.id);
      }
    } else {
      // Add new point
      const newPoint: AnchorPoint = {
        id: `point-${Date.now()}`,
        x,
        y,
        label: `Point ${anchorPoints.length + 1}`,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        relativeToViewport: true,
      };
      setAnchorPoints([...anchorPoints, newPoint]);
    }
  };

  const removePoint = (id: string) => {
    setAnchorPoints(anchorPoints.filter(p => p.id !== id));
    setConnections(connections.filter(c => c.from !== id && c.to !== id));
  };

  const clearAll = () => {
    setAnchorPoints([]);
    setConnections([]);
    setSelectedPoint(null);
  };

  const outputShape = () => {
    if (shapePoints.length === 0) {
      console.log('No shape points to output');
      return;
    }
    
    console.log('=== SHAPE COORDINATES ===');
    console.log('Copy and paste this to share the exact shape:');
    console.log('');
    
    const output = {
      element: 'custom_shape',
      corners: shapePoints.map((p, i) => ({
        point: i + 1,
        x: Math.round(p.x),
        y: Math.round(p.y)
      })),
      dimensions: {
        minX: Math.min(...shapePoints.map(p => p.x)),
        maxX: Math.max(...shapePoints.map(p => p.x)),
        minY: Math.min(...shapePoints.map(p => p.y)),
        maxY: Math.max(...shapePoints.map(p => p.y)),
        width: Math.max(...shapePoints.map(p => p.x)) - Math.min(...shapePoints.map(p => p.x)),
        height: Math.max(...shapePoints.map(p => p.y)) - Math.min(...shapePoints.map(p => p.y))
      }
    };
    
    console.log(JSON.stringify(output, null, 2));
    console.log('');
    console.log('=== END SHAPE ===');
    
    // Also copy to clipboard if possible
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      console.log('✓ Copied to clipboard!');
    }
  };

  const clearShape = () => {
    setShapePoints([]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rectangleMode || !rectangle) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const handleSize = 12;
    
    // Check if clicking on corner handles
    if (Math.abs(x - rectangle.x) < handleSize && Math.abs(y - rectangle.y) < handleSize) {
      setIsResizingRect('tl');
    } else if (Math.abs(x - (rectangle.x + rectangle.width)) < handleSize && Math.abs(y - rectangle.y) < handleSize) {
      setIsResizingRect('tr');
    } else if (Math.abs(x - rectangle.x) < handleSize && Math.abs(y - (rectangle.y + rectangle.height)) < handleSize) {
      setIsResizingRect('bl');
    } else if (Math.abs(x - (rectangle.x + rectangle.width)) < handleSize && Math.abs(y - (rectangle.y + rectangle.height)) < handleSize) {
      setIsResizingRect('br');
    } else if (x >= rectangle.x && x <= rectangle.x + rectangle.width && y >= rectangle.y && y <= rectangle.y + rectangle.height) {
      // Clicking inside rectangle - start drag
      setIsDraggingRect(true);
      setDragOffset({ x: x - rectangle.x, y: y - rectangle.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rectangleMode || !rectangle) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDraggingRect) {
      setRectangle({
        ...rectangle,
        x: x - dragOffset.x,
        y: y - dragOffset.y
      });
    } else if (isResizingRect) {
      let newRect = { ...rectangle };
      
      switch (isResizingRect) {
        case 'tl':
          newRect.width = rectangle.x + rectangle.width - x;
          newRect.height = rectangle.y + rectangle.height - y;
          newRect.x = x;
          newRect.y = y;
          break;
        case 'tr':
          newRect.width = x - rectangle.x;
          newRect.height = rectangle.y + rectangle.height - y;
          newRect.y = y;
          break;
        case 'bl':
          newRect.width = rectangle.x + rectangle.width - x;
          newRect.height = y - rectangle.y;
          newRect.x = x;
          break;
        case 'br':
          newRect.width = x - rectangle.x;
          newRect.height = y - rectangle.y;
          break;
      }
      
      // Ensure minimum size
      if (newRect.width > 20 && newRect.height > 20) {
        setRectangle(newRect);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingRect(false);
    setIsResizingRect(null);
  };

  const outputRectangle = () => {
    if (!rectangle) {
      console.log('No rectangle to output');
      return;
    }
    
    console.log('=== RECTANGLE COORDINATES ===');
    console.log('Copy and paste this to share the exact rectangle:');
    console.log('');
    
    // Get sidebar dimensions for context
    const sidebar = document.querySelector('aside');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const userStatusBox = sidebar?.querySelector('.bg-theme-bg');
    const statusBoxRect = userStatusBox?.getBoundingClientRect();
    
    const output = {
      element: 'rectangle',
      viewport: {
        position: {
          x: Math.round(rectangle.x),
          y: Math.round(rectangle.y)
        },
        dimensions: {
          width: Math.round(rectangle.width),
          height: Math.round(rectangle.height)
        }
      },
      relative_to_sidebar: sidebarRect ? {
        x: Math.round(rectangle.x - sidebarRect.left),
        y: Math.round(rectangle.y - sidebarRect.top),
        sidebar_width: Math.round(sidebarRect.width),
        sidebar_left: Math.round(sidebarRect.left)
      } : null,
      relative_to_status_box: statusBoxRect ? {
        x: Math.round(rectangle.x - statusBoxRect.left),
        y: Math.round(rectangle.y - statusBoxRect.top),
        status_box_top: Math.round(statusBoxRect.top),
        status_box_left: Math.round(statusBoxRect.left)
      } : null,
      corners: [
        { point: 1, x: Math.round(rectangle.x), y: Math.round(rectangle.y) },
        { point: 2, x: Math.round(rectangle.x + rectangle.width), y: Math.round(rectangle.y) },
        { point: 3, x: Math.round(rectangle.x + rectangle.width), y: Math.round(rectangle.y + rectangle.height) },
        { point: 4, x: Math.round(rectangle.x), y: Math.round(rectangle.y + rectangle.height) }
      ],
      context: {
        window_width: window.innerWidth,
        window_height: window.innerHeight,
        is_inside_sidebar: sidebarRect ? 
          rectangle.x >= sidebarRect.left && 
          rectangle.x <= sidebarRect.right : false,
        distance_from_top: Math.round(rectangle.y),
        distance_from_left: Math.round(rectangle.x)
      }
    };
    
    console.log(JSON.stringify(output, null, 2));
    console.log('');
    console.log('=== END RECTANGLE ===');
    
    // Also copy to clipboard if possible
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      console.log('✓ Copied to clipboard!');
    }
  };

  if (!isEnabled) {
    return (
      <button
        onClick={() => setIsEnabled(true)}
        className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <Maximize2 className="w-4 h-4" />
        Layout Debugger
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-gray-900 rounded-lg p-2 flex items-center gap-2">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
        >
          Show Debugger
        </button>
        <button
          onClick={() => setIsEnabled(false)}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="fixed inset-0 z-40 pointer-events-auto"
        style={{ 
          pointerEvents: isEnabled ? 'auto' : 'none',
          cursor: rectangleMode && rectangle ? 
            (isDraggingRect ? 'grabbing' : isResizingRect ? 'nwse-resize' : 'grab') : 
            'crosshair' 
        }}
      />

      {/* Control panel */}
      <div className="fixed top-4 right-4 z-50 bg-gray-900 rounded-lg p-4 w-80 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold">Layout Debugger</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <Eye className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => setIsEnabled(false)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Window size display */}
          <div className="text-sm text-gray-400">
            Window: {windowSize.width} × {windowSize.height}px
          </div>

          {/* Toggle controls */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-3 py-1 rounded text-sm ${
                showGrid ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setShowMeasurements(!showMeasurements)}
              className={`px-3 py-1 rounded text-sm ${
                showMeasurements ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Measurements
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Clear All
            </button>
          </div>

          {/* Rectangle Mode Controls */}
          <div className="border-t border-gray-700 pt-3 space-y-2">
            <h4 className="text-sm font-semibold text-gray-300">Rectangle Mode</h4>
            <button
              onClick={() => {
                setRectangleMode(!rectangleMode);
                setShapeMode(false);
                if (!rectangleMode) {
                  setRectangle(null);
                }
              }}
              className={`w-full px-3 py-2 rounded text-sm ${
                rectangleMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {rectangleMode ? '🟩 Rectangle Mode ON' : 'Start Rectangle Mode'}
            </button>
            
            {rectangleMode && (
              <>
                <div className="text-xs text-green-400">
                  {!rectangle ? 'Click to place rectangle' : 'Drag to move, corners to resize'}
                </div>
                {rectangle && (
                  <>
                    <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
                      Position: ({Math.round(rectangle.x)}, {Math.round(rectangle.y)})<br/>
                      Size: {Math.round(rectangle.width)} × {Math.round(rectangle.height)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={outputRectangle}
                        className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Output to Console
                      </button>
                      <button
                        onClick={() => setRectangle(null)}
                        className="flex-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                      >
                        Clear Rectangle
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Shape Mode Controls */}
          <div className="border-t border-gray-700 pt-3 space-y-2">
            <h4 className="text-sm font-semibold text-gray-300">Point Mode</h4>
            <button
              onClick={() => {
                setShapeMode(!shapeMode);
                setRectangleMode(false);
                if (!shapeMode) {
                  setShapePoints([]);
                }
              }}
              className={`w-full px-3 py-2 rounded text-sm ${
                shapeMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {shapeMode ? '🟢 Shape Mode ON' : 'Start Shape Mode'}
            </button>
            
            {shapeMode && (
              <>
                <div className="text-xs text-green-400">
                  Click to add points. Points: {shapePoints.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={outputShape}
                    className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Output to Console
                  </button>
                  <button
                    onClick={clearShape}
                    className="flex-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                  >
                    Clear Shape
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Click to add anchor points</p>
            <p>• Click two points to connect them</p>
            <p>• Points show coordinates and distances</p>
          </div>

          {/* Anchor points list */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300">Anchor Points</h4>
            {anchorPoints.map(point => (
              <div
                key={point.id}
                className={`flex items-center justify-between p-2 rounded ${
                  selectedPoint === point.id ? 'bg-blue-900' : 'bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: point.color }}
                  />
                  <span className="text-xs text-gray-300">{point.label}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round(point.x)}, {Math.round(point.y)})
                  </span>
                </div>
                <button
                  onClick={() => removePoint(point.id)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};