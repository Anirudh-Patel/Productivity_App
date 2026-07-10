# Layout Debugger Implementation Guide

A comprehensive guide for implementing a drag-and-drop layout debugger system for canvas-based node positioning in React + Tauri applications.

## Overview

This guide demonstrates how to implement a visual layout debugger that allows users to:
- Toggle edit mode to enable node manipulation
- Click and drag nodes to reposition them visually
- Batch save multiple position changes to prevent app crashes
- Preserve viewport zoom/pan during drag operations
- Provide visual feedback for pending changes

## Architecture

The system consists of three main layers:
1. **Canvas Rendering Layer**: HTML5 Canvas with viewport management
2. **State Management Layer**: Zustand store with local and persistent state
3. **Backend Layer**: Tauri/Rust for database persistence

## Implementation Steps

### 1. Type Definitions

First, extend your type definitions to support edit mode and pending changes:

```typescript
// types.ts
export interface SkillTreeState {
  // ... existing fields
  editMode: boolean;
  pendingChanges: Map<string, { x: number, y: number }>;
  
  // New methods
  setEditMode: (enabled: boolean) => void;
  updateNodePositionLocal: (nodeKey: string, x: number, y: number) => void;
  savePendingChanges: () => Promise<void>;
  discardPendingChanges: () => void;
}
```

### 2. State Management Implementation

Add local position management to your store:

```typescript
// store.ts
export const useSkillTreeStore = create<SkillTreeState>((set, get) => ({
  // ... existing state
  editMode: false,
  pendingChanges: new Map<string, { x: number, y: number }>(),

  setEditMode: (enabled: boolean) => {
    if (!enabled) {
      // Clear pending changes when disabling edit mode
      set({ editMode: enabled, pendingChanges: new Map() });
    } else {
      set({ editMode: enabled });
    }
  },

  updateNodePositionLocal: (nodeKey: string, x: number, y: number) => {
    set(state => {
      const newPendingChanges = new Map(state.pendingChanges);
      newPendingChanges.set(nodeKey, { x, y });
      
      return {
        // Update visual position immediately
        nodes: state.nodes.map(node => 
          node.node_key === nodeKey 
            ? { ...node, x_position: x, y_position: y }
            : node
        ),
        pendingChanges: newPendingChanges
      };
    });
  },

  savePendingChanges: async () => {
    const { pendingChanges } = get();
    
    if (pendingChanges.size === 0) return;

    try {
      console.log(`Saving ${pendingChanges.size} position changes...`);
      
      // Batch save all changes
      const promises = Array.from(pendingChanges.entries()).map(([nodeKey, position]) =>
        invoke('update_node_position', { 
          nodeKey, 
          xPosition: position.x, 
          yPosition: position.y 
        })
      );

      await Promise.allSettled(promises);
      
      // Clear pending changes on success
      set({ pendingChanges: new Map() });
      
      console.log('All position changes saved successfully');
    } catch (error) {
      console.error('Failed to save pending changes:', error);
      throw error;
    }
  },

  discardPendingChanges: () => {
    const { pendingChanges } = get();
    if (pendingChanges.size === 0) return;
    
    // Clear pending changes (positions will revert on next load)
    set({ pendingChanges: new Map() });
    console.log(`Discarded ${pendingChanges.size} pending changes`);
  }
}));
```

### 3. Canvas Interaction Layer

Modify your canvas component to handle drag operations:

```typescript
// SkillTreeCanvas.tsx
interface SkillTreeCanvasProps {
  // ... existing props
  editMode?: boolean;
  onNodePositionChange?: (nodeKey: string, x: number, y: number) => void;
}

export const SkillTreeCanvas: React.FC<SkillTreeCanvasProps> = ({
  // ... existing props
  editMode = false,
  onNodePositionChange,
}) => {
  // Drag state
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartMousePos, setDragStartMousePos] = useState({ x: 0, y: 0 });

  // Refs to prevent zoom reset during drag
  const hasInitiallyCenteredRef = useRef(false);
  const initialNodeCountRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert screen to world coordinates
    const worldX = (x - viewport.x) / viewport.zoom;
    const worldY = (y - viewport.y) / viewport.zoom;
    
    const clickedNode = interactionManager.findNodeAt(worldX, worldY, nodes);
    
    if (clickedNode && editMode) {
      // Start node drag in edit mode
      setIsDraggingNode(true);
      setDraggingNode(clickedNode.node_key);
      setDragStartPos({ x: clickedNode.x_position, y: clickedNode.y_position });
      setDragStartMousePos({ x: e.clientX, y: e.clientY });
    } else if (clickedNode) {
      // Normal node click
      onNodeClick(clickedNode.node_key);
    } else {
      // Start viewport pan
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [viewport, nodes, editMode, onNodeClick, interactionManager]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDraggingNode && draggingNode && onNodePositionChange) {
      // Calculate final position
      const totalDeltaX = (e.clientX - dragStartMousePos.x) / viewport.zoom;
      const totalDeltaY = (e.clientY - dragStartMousePos.y) / viewport.zoom;
      
      const newX = dragStartPos.x + totalDeltaX;
      const newY = dragStartPos.y + totalDeltaY;
      
      // Use local update instead of immediate database save
      onNodePositionChange(draggingNode, newX, newY);
    }
    
    // Reset drag states
    setIsDragging(false);
    setIsDraggingNode(false);
    setDraggingNode(null);
    setDragStartPos({ x: 0, y: 0 });
    setDragStartMousePos({ x: 0, y: 0 });
  }, [isDraggingNode, draggingNode, onNodePositionChange, dragStartPos, dragStartMousePos, viewport]);

  // CRITICAL: Prevent zoom reset during drag operations
  useEffect(() => {
    if (nodes.length > 0 && viewport.width > 0 && viewport.height > 0 && !isDraggingNode) {
      // Only center if node count actually changed (not position updates)
      const nodeCountChanged = nodes.length !== initialNodeCountRef.current;
      
      if (!hasInitiallyCenteredRef.current || nodeCountChanged) {
        hasInitiallyCenteredRef.current = true;
        initialNodeCountRef.current = nodes.length;
        centerViewport();
      }
    }
  }, [nodes.length, viewport.width, viewport.height, centerViewport, isDraggingNode]);

  return (
    <div className="relative w-full h-full overflow-hidden">
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
      
      {/* Edit mode indicator */}
      {editMode && (
        <div className="absolute top-4 right-4 px-3 py-2 bg-orange-600 border border-orange-500 rounded text-white text-xs font-bold">
          🔧 Edit Mode
        </div>
      )}
    </div>
  );
};
```

### 4. UI Controls Implementation

Create the user interface for managing edit mode:

```typescript
// SkillTreePage.tsx
export const SkillTreePage = () => {
  const { 
    editMode, 
    pendingChanges, 
    setEditMode, 
    updateNodePositionLocal,
    savePendingChanges, 
    discardPendingChanges 
  } = useSkillTreeStore();

  const [isSavingChanges, setIsSavingChanges] = useState(false);

  const handleToggleEditMode = () => {
    if (editMode && pendingChanges.size > 0) {
      if (!confirm(`You have ${pendingChanges.size} unsaved changes. Discard them?`)) {
        return;
      }
      discardPendingChanges();
    }
    setEditMode(!editMode);
  };

  const handleSavePendingChanges = async () => {
    setIsSavingChanges(true);
    try {
      await savePendingChanges();
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleDiscardPendingChanges = () => {
    if (confirm(`Discard ${pendingChanges.size} pending changes?`)) {
      discardPendingChanges();
    }
  };

  return (
    <div className="skill-tree-container">
      {/* Control Panel */}
      <div className="controls-panel">
        <button 
          onClick={handleToggleEditMode}
          className={editMode ? 'btn-active' : 'btn-inactive'}
        >
          {editMode ? '🔧 Exit Edit' : '✏️ Edit Layout'}
        </button>
        
        {editMode && (
          <>
            <button 
              onClick={handleSavePendingChanges} 
              disabled={pendingChanges.size === 0 || isSavingChanges}
              className="btn-save"
            >
              {isSavingChanges ? '💾 Saving...' : `💾 Save Changes (${pendingChanges.size})`}
            </button>
            
            <button 
              onClick={handleDiscardPendingChanges} 
              disabled={pendingChanges.size === 0}
              className="btn-discard"
            >
              🔄 Discard Changes
            </button>
          </>
        )}
      </div>

      {/* Canvas */}
      <SkillTreeCanvas
        nodes={nodes}
        connections={connections}
        allocatedNodes={userAllocations}
        availablePoints={availablePoints}
        userLevel={userLevel}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        editMode={editMode}
        onNodePositionChange={updateNodePositionLocal}
      />
    </div>
  );
};
```

### 5. Backend Integration

Add the database update command to your Tauri backend:

```rust
// lib.rs
#[tauri::command]
async fn update_node_position(
    node_key: String, 
    x_position: f64, 
    y_position: f64
) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE skill_nodes SET x_position = ?, y_position = ? WHERE node_key = ?",
        rusqlite::params![x_position, y_position, node_key]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

// Register the command
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            update_node_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Key Design Patterns

### 1. Local State Management
- Update UI immediately for responsive feedback
- Batch database operations to prevent crashes
- Track pending changes separately from persisted state

### 2. Viewport Preservation
- Use refs to track initialization state
- Prevent unnecessary viewport resets during interactions
- Only trigger auto-centering on actual data changes

### 3. Error Handling
- Graceful degradation when database operations fail
- User confirmation for destructive actions
- Clear feedback for operation status

### 4. Performance Optimization
- Batch database writes instead of per-drag updates
- Use Promise.allSettled for parallel operations
- Implement request debouncing if needed

## Common Pitfalls

1. **App Crashes**: Don't call database operations on every mouse move
2. **Zoom Reset**: Track initialization state to prevent unnecessary viewport changes
3. **State Inconsistency**: Always update local state optimistically
4. **Memory Leaks**: Clean up event listeners and cancel pending operations

## Testing Checklist

- [ ] Edit mode toggle works correctly
- [ ] Nodes can be dragged smoothly without lag
- [ ] Zoom/pan preserved during drag operations
- [ ] Batch save works with multiple nodes
- [ ] Discard changes reverts visual positions
- [ ] App doesn't crash during drag operations
- [ ] Database updates persist across app restarts

## Customization Options

- Add grid snapping for precise positioning
- Implement undo/redo functionality
- Add keyboard shortcuts for common operations
- Create templates for common node arrangements
- Implement collaborative editing with conflict resolution

This implementation provides a robust foundation for visual layout debugging that can be adapted to various node-based applications.