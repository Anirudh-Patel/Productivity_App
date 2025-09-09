# POE-Style Skill Tree Implementation Guide for Life Gamification App

## System Overview
A massive branching skill tree with **2,050 total nodes** inspired by Path of Exile, designed for gradual character progression with 5 distinct starting areas that blend into each other at borders.

## Node Distribution & Structure

### Total Node Breakdown
- **1,500 Regular Nodes** (73%) - Small incremental bonuses
- **500 Specialized Nodes** (24%) - Medium impact, cluster keystones
- **50 Augmenting Nodes** (2.5%) - Major game-changing effects
- **5 Starting Nodes** (0.5%) - Entry points for each stat

### Spatial Organization
```
         INTELLIGENCE (North)
              /     \
            /         \
      AURA             WILL
    (Northwest)     (Northeast)
         |             |
         |    CENTER   |
         |             |
    STRENGTH -------- LUCK
    (Southwest)    (Southeast)
```

## Database Schema

```sql
-- Skill tree node definitions
CREATE TABLE skill_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_key TEXT UNIQUE NOT NULL, -- e.g., "STR_001", "INT_SPEC_042"
    name TEXT NOT NULL,
    description TEXT,
    node_type TEXT CHECK (node_type IN ('start', 'regular', 'specialized', 'augmenting')),
    primary_stat TEXT CHECK (primary_stat IN ('strength', 'intelligence', 'luck', 'aura', 'will')),
    secondary_stat TEXT, -- For border synergy nodes
    
    -- Position on the skill tree canvas
    x_position REAL NOT NULL,
    y_position REAL NOT NULL,
    
    -- Requirements
    level_requirement INTEGER DEFAULT 1,
    prerequisite_nodes JSON DEFAULT '[]', -- Array of node_keys
    skill_point_cost INTEGER DEFAULT 1,
    
    -- Effects (JSON for flexibility)
    stat_bonuses JSON DEFAULT '{}', -- {"strength": 5, "health": 10}
    productivity_effects JSON DEFAULT '{}', -- {"task_xp_bonus": 0.05}
    game_effects JSON DEFAULT '{}', -- For future game integration
    
    -- Visual
    icon_sprite TEXT,
    color_hex TEXT,
    size TEXT DEFAULT 'small' CHECK (size IN ('small', 'medium', 'large', 'massive')),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User's allocated skill points
CREATE TABLE user_skill_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    node_key TEXT NOT NULL,
    allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (node_key) REFERENCES skill_nodes(node_key),
    UNIQUE(user_id, node_key)
);

-- Skill tree paths for visual connections
CREATE TABLE skill_tree_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    path_type TEXT DEFAULT 'normal' CHECK (path_type IN ('normal', 'synergy', 'hidden')),
    FOREIGN KEY (from_node) REFERENCES skill_nodes(node_key),
    FOREIGN KEY (to_node) REFERENCES skill_nodes(node_key),
    UNIQUE(from_node, to_node)
);
```

## Node Types & Effects

### 1. Regular Nodes (1,500 total - 300 per stat area)
Small incremental bonuses that form paths between specialized nodes.

#### Strength Regular Nodes
```javascript
const strengthRegularNodes = {
  // Type 1: Pure stat increases (150 nodes)
  "STR_001-150": {
    effects: { strength: "+2", health: "+5" },
    description: "Minor Strength increase"
  },
  
  // Type 2: Task-specific bonuses (100 nodes)
  "STR_151-250": {
    effects: { physical_task_xp: "+3%" },
    description: "Increased XP from physical tasks"
  },
  
  // Type 3: Recovery bonuses (50 nodes)
  "STR_251-300": {
    effects: { health_regen: "+1/hour" },
    description: "Faster health recovery"
  }
};
```

#### Intelligence Regular Nodes
```javascript
const intelligenceRegularNodes = {
  // Type 1: Pure stat increases (150 nodes)
  "INT_001-150": {
    effects: { intelligence: "+2", mana: "+5" },
    description: "Minor Intelligence increase"
  },
  
  // Type 2: Learning bonuses (100 nodes)
  "INT_151-250": {
    effects: { study_task_xp: "+3%" },
    description: "Increased XP from learning tasks"
  },
  
  // Type 3: Efficiency bonuses (50 nodes)
  "INT_251-300": {
    effects: { task_time_reduction: "+1%" },
    description: "Slightly faster task completion"
  }
};
```

### 2. Specialized Nodes (500 total - 100 per stat area)
Medium-impact nodes that define build paths.

#### Example Specialized Clusters

**Strength - "Titan's Endurance" Cluster**
```javascript
{
  keystone: "STR_SPEC_015",
  name: "Titan's Endurance",
  effects: {
    health: "+50",
    damage_reduction: "+10%",
    unlock_feature: "overdrive_mode"
  },
  supportNodes: [
    "STR_SPEC_016-020" // 5 supporting specialized nodes
  ]
}
```

**Intelligence - "Scholar's Focus" Cluster**
```javascript
{
  keystone: "INT_SPEC_015",
  name: "Scholar's Focus",
  effects: {
    intelligence: "+15",
    skill_combo_detection: "advanced",
    multi_task_bonus: "+25%"
  }
}
```

### 3. Augmenting Nodes (50 total - 10 per stat area)
Game-changing effects that fundamentally alter mechanics.

#### Augmenting Node Examples

**Strength Augment - "Berserker's Oath"**
```javascript
{
  id: "STR_AUG_001",
  requirements: { level: 30, allocated_strength_nodes: 50 },
  effects: {
    health_as_damage: true, // Convert missing health to bonus XP
    unlock_berserk_mode: true,
    strength_scaling: "exponential"
  }
}
```

**Luck Augment - "Fortune's Favorite"**
```javascript
{
  id: "LUCK_AUG_001",
  requirements: { level: 25, allocated_luck_nodes: 40 },
  effects: {
    daily_legendary_task: true, // One task per day becomes legendary
    cascade_rewards: true, // Rewards can trigger more rewards
    bad_luck_protection: "enhanced"
  }
}
```

### 4. Synergy Border Nodes (20% of nodes in border regions)
Nodes that blend two neighboring stats.

**Strength-Aura Border**
```javascript
{
  id: "STR_AURA_SYN_001",
  name: "Commanding Presence",
  effects: {
    strength: "+5",
    aura: "+5",
    intimidation_bonus: "+15%",
    team_physical_bonus: "+10%" // If social features enabled
  }
}
```

**Intelligence-Will Border**
```javascript
{
  id: "INT_WILL_SYN_001",
  name: "Mental Fortress",
  effects: {
    intelligence: "+5",
    will: "+5",
    focus_duration: "+30%",
    distraction_resistance: "+25%"
  }
}
```

## Canvas Rendering Implementation

### Coordinate System
```javascript
// Polar coordinate system with 5 origin points
const SKILL_TREE_CONFIG = {
  canvasSize: { width: 4000, height: 4000 },
  center: { x: 2000, y: 2000 },
  
  startingNodes: {
    strength: { x: 1400, y: 2600, angle: 234 }, // Southwest
    intelligence: { x: 2000, y: 1400, angle: 90 }, // North
    luck: { x: 2600, y: 2600, angle: 306 }, // Southeast
    aura: { x: 1400, y: 1400, angle: 162 }, // Northwest
    will: { x: 2600, y: 1400, angle: 18 } // Northeast
  },
  
  nodeSpacing: {
    regular: 40,
    specialized: 60,
    augmenting: 100
  },
  
  maxRadiusFromStart: 800 // How far nodes extend from starting points
};
```

### React Component Structure
```typescript
// components/SkillTree/SkillTreeCanvas.tsx
interface SkillTreeCanvasProps {
  userId: number;
  allocatedNodes: Set<string>;
  availablePoints: number;
  onNodeClick: (nodeKey: string) => void;
}

const SkillTreeCanvas: React.FC<SkillTreeCanvasProps> = ({
  userId,
  allocatedNodes,
  availablePoints,
  onNodeClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // Render logic with zoom/pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply viewport transformation
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    
    // Render connections first
    renderConnections(ctx, allocatedNodes);
    
    // Render nodes
    renderNodes(ctx, allocatedNodes, hoveredNode);
    
    ctx.restore();
  }, [viewport, allocatedNodes, hoveredNode]);
  
  return (
    <div className="skill-tree-container">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onWheel={handleZoom}
      />
      <SkillTreeControls 
        onReset={handleReset}
        availablePoints={availablePoints}
      />
    </div>
  );
};
```

## Zustand Store Implementation

```typescript
// stores/skillTreeStore.ts
interface SkillTreeState {
  nodes: Map<string, SkillNode>;
  userAllocations: Set<string>;
  availablePoints: number;
  
  // Actions
  allocateNode: (nodeKey: string) => Promise<void>;
  deallocateNode: (nodeKey: string) => Promise<void>;
  resetTree: () => Promise<void>;
  loadUserTree: (userId: number) => Promise<void>;
  
  // Computed
  getNodeStatus: (nodeKey: string) => 'locked' | 'available' | 'allocated';
  getStatTotals: () => StatTotals;
}

const useSkillTreeStore = create<SkillTreeState>((set, get) => ({
  nodes: new Map(),
  userAllocations: new Set(),
  availablePoints: 0,
  
  allocateNode: async (nodeKey) => {
    const node = get().nodes.get(nodeKey);
    if (!node) return;
    
    // Check prerequisites
    const canAllocate = node.prerequisite_nodes.every(
      prereq => get().userAllocations.has(prereq)
    );
    
    if (!canAllocate || get().availablePoints < node.skill_point_cost) {
      return;
    }
    
    // Call Tauri backend
    await invoke('allocate_skill_node', { nodeKey });
    
    // Update state
    set(state => ({
      userAllocations: new Set([...state.userAllocations, nodeKey]),
      availablePoints: state.availablePoints - node.skill_point_cost
    }));
  },
  
  getStatTotals: () => {
    const totals = {
      strength: 0,
      intelligence: 0,
      luck: 0,
      aura: 0,
      will: 0,
      health: 0,
      mana: 0
    };
    
    get().userAllocations.forEach(nodeKey => {
      const node = get().nodes.get(nodeKey);
      if (node?.stat_bonuses) {
        Object.entries(node.stat_bonuses).forEach(([stat, value]) => {
          totals[stat] = (totals[stat] || 0) + value;
        });
      }
    });
    
    return totals;
  }
}));
```

## Progression Formulas

### Skill Points Earning Rate
```typescript
const calculateSkillPoints = (level: number, achievements: number): number => {
  const basePoints = 3; // Starting points
  const levelPoints = Math.floor(level / 2); // 1 point every 2 levels
  const achievementPoints = Math.floor(achievements / 10); // 1 point per 10 achievements
  const milestonePoints = getMilestonePoints(level); // Bonus at 10, 25, 50, 100
  
  return basePoints + levelPoints + achievementPoints + milestonePoints;
};

const getMilestonePoints = (level: number): number => {
  let points = 0;
  if (level >= 10) points += 5;
  if (level >= 25) points += 10;
  if (level >= 50) points += 15;
  if (level >= 100) points += 25;
  return points;
};
```

### Node Power Scaling
```typescript
// Distance from center affects power
const getNodePowerMultiplier = (distanceFromStart: number): number => {
  const maxDistance = 800;
  const normalized = Math.min(distanceFromStart / maxDistance, 1);
  
  // Exponential scaling: nodes further out are much stronger
  return 1 + (normalized ** 2) * 4; // 1x to 5x multiplier
};

// Example: A strength node at distance 400 (midway)
// Power multiplier = 1 + (0.5^2) * 4 = 1 + 1 = 2x
// So "+2 strength" becomes "+4 strength"
```

### Respec System
```typescript
const calculateRespecCost = (allocatedNodes: number, level: number): number => {
  const baseCost = 100; // Base gold cost
  const perNodeCost = allocatedNodes * 10;
  const levelDiscount = Math.max(0, 100 - level); // Higher level = cheaper
  
  return Math.max(50, baseCost + perNodeCost - levelDiscount);
};
```

## Visual Design Guidelines

### Node Visual States
```css
/* Placeholder styles for Canvas rendering */
.node-regular {
  size: 16px;
  border: 2px solid;
  background: radial-gradient(circle, rgba(255,255,255,0.8), rgba(255,255,255,0.2));
}

.node-specialized {
  size: 24px;
  border: 3px solid;
  background: radial-gradient(circle, rgba(255,215,0,0.8), rgba(255,215,0,0.2));
  glow: 0 0 10px rgba(255,215,0,0.5);
}

.node-augmenting {
  size: 32px;
  border: 4px solid;
  background: radial-gradient(circle, rgba(255,0,255,0.8), rgba(255,0,255,0.2));
  glow: 0 0 20px rgba(255,0,255,0.8);
  animation: pulse 2s infinite;
}
```

### Color Coding by Stat
```javascript
const STAT_COLORS = {
  strength: { 
    primary: '#FF6B6B', // Warm coral red
    secondary: '#FF4444',
    glow: 'rgba(255, 107, 107, 0.5)'
  },
  intelligence: {
    primary: '#4ECDC4', // Teal turquoise
    secondary: '#2AA39A',
    glow: 'rgba(78, 205, 196, 0.5)'
  },
  luck: {
    primary: '#FFE066', // Golden yellow
    secondary: '#FFD700',
    glow: 'rgba(255, 224, 102, 0.5)'
  },
  aura: {
    primary: '#9B59B6', // Royal purple
    secondary: '#8E44AD',
    glow: 'rgba(155, 89, 182, 0.5)'
  },
  will: {
    primary: '#3498DB', // Sky blue
    secondary: '#2980B9',
    glow: 'rgba(52, 152, 219, 0.5)'
  }
};
```

## Implementation Steps for Claude Code

### Phase 1: Database Setup (Day 1)
1. Create migration file with all skill node tables
2. Generate seed data for 2050 nodes using the distribution formula
3. Set up Tauri commands for skill tree operations

### Phase 2: Node Generation Script (Day 2)
```typescript
// scripts/generateSkillTree.ts
const generateSkillTree = () => {
  const nodes = [];
  
  // Generate nodes for each stat area
  ['strength', 'intelligence', 'luck', 'aura', 'will'].forEach((stat, statIndex) => {
    const startAngle = (statIndex * 72) * Math.PI / 180; // 72° apart
    const startX = 2000 + Math.cos(startAngle) * 600;
    const startY = 2000 + Math.sin(startAngle) * 600;
    
    // Starting node
    nodes.push({
      node_key: `${stat.toUpperCase()}_START`,
      name: `${stat} Origin`,
      node_type: 'start',
      primary_stat: stat,
      x_position: startX,
      y_position: startY
    });
    
    // Generate regular nodes (300 per stat)
    for (let i = 1; i <= 300; i++) {
      const distance = 50 + (i / 300) * 750; // Spread from 50 to 800 pixels
      const angle = startAngle + (Math.random() - 0.5) * Math.PI / 3; // ±30° spread
      
      nodes.push({
        node_key: `${stat.toUpperCase()}_${String(i).padStart(3, '0')}`,
        name: `${stat} Node ${i}`,
        node_type: 'regular',
        primary_stat: stat,
        x_position: startX + Math.cos(angle) * distance,
        y_position: startY + Math.sin(angle) * distance,
        stat_bonuses: generateRegularBonus(stat, distance)
      });
    }
    
    // Generate specialized nodes (100 per stat)
    // ... similar pattern but clustered
    
    // Generate augmenting nodes (10 per stat)
    // ... placed at maximum distance
  });
  
  return nodes;
};
```

### Phase 3: Canvas Renderer (Day 3-4)
1. Implement zoom/pan controls
2. Create node rendering with placeholder shapes
3. Add connection path rendering
4. Implement hover and click interactions

### Phase 4: State Management (Day 5)
1. Set up Zustand store
2. Connect to Tauri backend
3. Implement allocation/deallocation logic
4. Add computed properties for stats

### Phase 5: UI Components (Day 6)
1. Create skill tree container component
2. Add control panel (reset, search, filters)
3. Build stat summary panel
4. Implement tooltip system

### Phase 6: Testing & Optimization (Day 7)
1. Performance test with 2000+ nodes
2. Optimize rendering (culling, LOD)
3. Add keyboard shortcuts
4. Implement save/load presets

## Performance Optimization

### Rendering Optimizations
```javascript
// Only render nodes in viewport
const cullNodes = (nodes, viewport) => {
  return nodes.filter(node => {
    const inViewport = 
      node.x > viewport.left &&
      node.x < viewport.right &&
      node.y > viewport.top &&
      node.y < viewport.bottom;
    return inViewport;
  });
};

// Level of Detail (LOD) system
const getNodeLOD = (zoom) => {
  if (zoom < 0.5) return 'minimal'; // Just dots
  if (zoom < 1) return 'simple'; // Basic shapes
  return 'full'; // Full details with text
};
```

### State Management Optimizations
```javascript
// Use shallow comparison for re-renders
const allocatedNodesSet = useSkillTreeStore(
  state => state.userAllocations,
  shallow
);

// Memoize expensive computations
const statTotals = useMemo(
  () => calculateStatTotals(allocatedNodesSet),
  [allocatedNodesSet]
);
```

## Future Extensions

### Game Integration Preparation
```typescript
interface GameEffects {
  // Idle Clicker
  autoClickDamage?: number;
  criticalChance?: number;
  goldMultiplier?: number;
  
  // Bullet Hell
  projectileCount?: number;
  projectileSpeed?: number;
  dashCharges?: number;
  shieldStrength?: number;
}
```

### Social Features Preparation
```typescript
interface SocialSkillTree {
  shareableBuilds: boolean;
  compareWithFriends: boolean;
  globalLeaderboard: boolean;
  buildTemplates: SkillBuild[];
}
```

## Testing Checklist

- [ ] Can allocate/deallocate nodes correctly
- [ ] Prerequisites are enforced
- [ ] Skill points are tracked accurately
- [ ] Visual states update properly
- [ ] Zoom/pan works smoothly
- [ ] Performance with 2000+ nodes is acceptable
- [ ] Save/load functionality works
- [ ] Respec cost calculation is correct
- [ ] Stat bonuses apply to gameplay
- [ ] Synergy nodes work at borders

## Notes for Claude Code

1. **Start with placeholder graphics** - Use colored circles/squares for nodes
2. **Build incrementally** - Get 50 nodes working before scaling to 2000+
3. **Test performance early** - Canvas rendering 2000+ nodes needs optimization
4. **Keep node data separate from rendering** - Use a data layer + view layer
5. **Plan for changes** - Use JSON for effects so they're easily modified

This system is designed to be implemented progressively. Start with the core structure and a small subset of nodes, then expand once the foundation is solid.