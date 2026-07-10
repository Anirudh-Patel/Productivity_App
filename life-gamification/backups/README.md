# Skill Tree Database Backups

## Available Backups

### game_clean_spaced_20250907_205912.db
**Created:** September 7, 2025, 8:59 PM
**Features:**
- Clean connection structure (3,424 logical connections vs 4,374 messy ones)
- Proper node spacing with no overlaps
- Larger 6000x6000 canvas
- Branch-based progression paths
- Updated prerequisites system
- Strategic cross-branch bridges only

**Use Case:** If you want the cleanest possible skill tree structure with proper spacing

### Current Database (restored)
**Features:**
- Original constellation aesthetic with organic feel
- Some overlapping nodes (20 duplicate positions)
- Original 4000x4000 canvas size
- Dense spiral patterns
- Mixed connection structure
- Original node sizes and spacing

**Use Case:** Maintains the original artistic vision while allowing for incremental improvements

## Scripts Available

### Overlap Fixing
- `scripts/fixNodeOverlaps.cjs` - Moderate overlap fixing
- `scripts/fixNodeOverlapsAggressive.cjs` - Aggressive spacing
- `scripts/rebuildNodePositions.cjs` - Complete position rebuild

### Connection Management  
- `scripts/rebuildConnections.cjs` - Clean connection paths
- `scripts/updatePrerequisites.cjs` - Update prerequisite chains

### Other Utilities
- `scripts/fixDuplicatePositions.cjs` - Fix nodes at identical positions
- `scripts/improve_constellation_bridges.cjs` - Add outer ring connectivity

## Restoration Commands

To restore the clean spaced version:
```bash
cp backups/game_clean_spaced_20250907_205912.db src-tauri/game.db
```

To keep current (original aesthetic) version:
- No action needed, already active