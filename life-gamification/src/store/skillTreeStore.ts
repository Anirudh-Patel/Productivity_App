import { create } from 'zustand';
import { useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  SkillNode, 
  SkillTreeConnection, 
  UserSkillStats, 
  NodeStatus, 
  StatTotals,
  SkillTreeState 
} from '../shared/components/ui/CanvasSkillTree/types';
import { logger, logPerformance } from '../utils/logger';
import { withErrorHandling } from '../utils/errorHandler';
import { PerformanceMonitor } from '../utils/performance';

export const useSkillTreeStore = create<SkillTreeState>((set, get) => ({
  nodes: [],
  connections: [],
  userAllocations: new Set<string>(),
  userStats: null,
  loading: false,
  error: null,

  loadSkillTree: async () => {
    console.log('SkillTreeStore: loadSkillTree called');
    set({ loading: true, error: null });
    
    const startTime = Date.now();
    
    try {
      await PerformanceMonitor.measureAsync(
        'loadSkillTree',
        async () => {
          console.log('SkillTreeStore: Starting parallel data fetch...');
          // Load nodes, connections, and user allocations in parallel
          const [nodesResult, connectionsResult, allocationsResult, statsResult] = await Promise.allSettled([
            withErrorHandling(
              () => invoke<SkillNode[]>('get_skill_nodes'),
              { component: 'SkillTreeStore', action: 'loadNodes' }
            ),
            withErrorHandling(
              () => invoke<SkillTreeConnection[]>('get_skill_tree_connections'), 
              { component: 'SkillTreeStore', action: 'loadConnections' }
            ),
            withErrorHandling(
              () => invoke<string[]>('get_user_skill_allocations'),
              { component: 'SkillTreeStore', action: 'loadAllocations' }
            ),
            withErrorHandling(
              () => invoke<UserSkillStats>('get_user_skill_stats'),
              { component: 'SkillTreeStore', action: 'loadStats' }
            )
          ]);

          // Process results with better error logging
          const nodes = nodesResult.status === 'fulfilled' && !nodesResult.value.error 
            ? nodesResult.value.data || [] 
            : [];
          if (nodesResult.status === 'rejected' || (nodesResult.status === 'fulfilled' && nodesResult.value.error)) {
            console.error('Failed to load nodes:', nodesResult.status === 'rejected' ? nodesResult.reason : nodesResult.value.error);
          }
            
          const connections = connectionsResult.status === 'fulfilled' && !connectionsResult.value.error
            ? connectionsResult.value.data || []
            : [];
          if (connectionsResult.status === 'rejected' || (connectionsResult.status === 'fulfilled' && connectionsResult.value.error)) {
            console.error('Failed to load connections:', connectionsResult.status === 'rejected' ? connectionsResult.reason : connectionsResult.value.error);
          }
            
          const allocations = allocationsResult.status === 'fulfilled' && !allocationsResult.value.error
            ? new Set(allocationsResult.value.data || [])
            : new Set<string>();
          if (allocationsResult.status === 'rejected' || (allocationsResult.status === 'fulfilled' && allocationsResult.value.error)) {
            console.error('Failed to load allocations:', allocationsResult.status === 'rejected' ? allocationsResult.reason : allocationsResult.value.error);
          }
            
          const stats = statsResult.status === 'fulfilled' && !statsResult.value.error
            ? statsResult.value.data
            : null;
          if (statsResult.status === 'rejected' || (statsResult.status === 'fulfilled' && statsResult.value.error)) {
            console.error('Failed to load stats:', statsResult.status === 'rejected' ? statsResult.reason : statsResult.value.error);
          }
          
          console.log('SkillTreeStore: Final processed data:', {
            nodesLoaded: nodes.length,
            connectionsLoaded: connections.length,
            allocationsLoaded: allocations.size,
            hasStats: !!stats
          });

          set({
            nodes,
            connections,
            userAllocations: allocations,
            userStats: stats,
            loading: false,
            error: null
          });

          const duration = Date.now() - startTime;
          logPerformance('loadSkillTree', duration, 'SkillTreeStore');
          
          logger.info('Skill tree loaded successfully', {
            nodeCount: nodes.length,
            connectionCount: connections.length,
            allocatedCount: allocations.size,
            loadTime: duration
          }, 'SkillTreeStore');
        },
        1000 // Log if loading takes longer than 1 second
      );
    } catch (error) {
      logger.error('Failed to load skill tree', error, 'SkillTreeStore');
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to load skill tree'
      });
      throw error;
    }
  },

  allocateNode: async (nodeKey: string) => {
    const { nodes, userAllocations, userStats } = get();
    const node = nodes.find(n => n.node_key === nodeKey);
    
    if (!node) {
      throw new Error(`Node ${nodeKey} not found`);
    }

    if (userAllocations.has(nodeKey)) {
      throw new Error('Node already allocated');
    }

    // Check prerequisites
    const unmetPrereqs = node.prerequisite_nodes.filter(prereq => 
      !userAllocations.has(prereq)
    );
    
    if (unmetPrereqs.length > 0) {
      throw new Error(`Missing prerequisites: ${unmetPrereqs.join(', ')}`);
    }

    // Check skill points
    const availablePoints = userStats?.available_skill_points || 0;
    if (availablePoints < node.skill_point_cost) {
      throw new Error('Not enough skill points');
    }

    try {
      await PerformanceMonitor.measureAsync(
        `allocateNode_${nodeKey}`,
        async () => {
          const result = await withErrorHandling(
            () => invoke<UserSkillStats>('allocate_skill_node', { nodeKey }),
            { component: 'SkillTreeStore', action: 'allocateNode' }
          );

          if (result.error) {
            throw result.error;
          }

          // Update local state
          set(state => ({
            userAllocations: new Set([...state.userAllocations, nodeKey]),
            userStats: result.data || state.userStats
          }));

          logger.info('Node allocated successfully', { nodeKey, nodeName: node.name }, 'SkillTreeStore');
        },
        300
      );
    } catch (error) {
      logger.error('Failed to allocate node', error, 'SkillTreeStore', 'allocateNode');
      throw error;
    }
  },

  deallocateNode: async (nodeKey: string) => {
    const { userAllocations } = get();
    
    if (!userAllocations.has(nodeKey)) {
      throw new Error('Node not allocated');
    }

    // Check if any other nodes depend on this one
    const { nodes } = get();
    const dependentNodes = nodes.filter(node => 
      node.prerequisite_nodes.includes(nodeKey) && userAllocations.has(node.node_key)
    );

    if (dependentNodes.length > 0) {
      throw new Error(`Cannot deallocate: ${dependentNodes.length} allocated nodes depend on this one`);
    }

    try {
      const result = await withErrorHandling(
        () => invoke<UserSkillStats>('deallocate_skill_node', { nodeKey }),
        { component: 'SkillTreeStore', action: 'deallocateNode' }
      );

      if (result.error) {
        throw result.error;
      }

      // Update local state
      set(state => {
        const newAllocations = new Set(state.userAllocations);
        newAllocations.delete(nodeKey);
        
        return {
          userAllocations: newAllocations,
          userStats: result.data || state.userStats
        };
      });

      logger.info('Node deallocated successfully', { nodeKey }, 'SkillTreeStore');
    } catch (error) {
      logger.error('Failed to deallocate node', error, 'SkillTreeStore', 'deallocateNode');
      throw error;
    }
  },

  resetTree: async () => {
    try {
      const result = await withErrorHandling(
        () => invoke<UserSkillStats>('reset_skill_tree'),
        { component: 'SkillTreeStore', action: 'resetTree' }
      );

      if (result.error) {
        throw result.error;
      }

      // Update local state
      set({
        userAllocations: new Set<string>(),
        userStats: result.data || null
      });

      logger.info('Skill tree reset successfully', {}, 'SkillTreeStore');
    } catch (error) {
      logger.error('Failed to reset skill tree', error, 'SkillTreeStore', 'resetTree');
      throw error;
    }
  },

  getNodeStatus: (nodeKey: string): NodeStatus => {
    const { userAllocations, userStats, nodes } = get();
    const node = nodes.find(n => n.node_key === nodeKey);
    
    if (!node) return 'locked';
    
    if (userAllocations.has(nodeKey)) {
      return 'allocated';
    }

    const userLevel = userStats?.total_nodes_allocated || 0; // Use allocated nodes as proxy for level
    const meetsLevelReq = userLevel >= node.level_requirement;
    const hasSkillPoints = (userStats?.available_skill_points || 0) >= node.skill_point_cost;
    const prereqsMet = node.prerequisite_nodes.every(prereq => 
      userAllocations.has(prereq)
    );

    if (meetsLevelReq && hasSkillPoints && prereqsMet) {
      return 'available';
    }

    return 'locked';
  },

  getStatTotals: (): StatTotals => {
    const { userStats } = get();
    
    if (!userStats) {
      return {
        strength: 0,
        intelligence: 0,
        luck: 0,
        aura: 0,
        will: 0,
        health: 0,
        mana: 0
      };
    }

    return {
      strength: userStats.strength_bonus,
      intelligence: userStats.intelligence_bonus,
      luck: userStats.luck_bonus,
      aura: userStats.aura_bonus,
      will: userStats.will_bonus,
      health: userStats.health_bonus,
      mana: userStats.mana_bonus
    };
  },

  canAllocateNode: (nodeKey: string): boolean => {
    return get().getNodeStatus(nodeKey) === 'available';
  }
}));

// Selectors for performance optimization
export const useSkillTreeNodes = () => useSkillTreeStore(state => state.nodes);
export const useSkillTreeConnections = () => useSkillTreeStore(state => state.connections);
export const useUserAllocations = () => useSkillTreeStore(state => state.userAllocations);
export const useUserStats = () => useSkillTreeStore(state => state.userStats);
export const useSkillTreeLoading = () => useSkillTreeStore(state => state.loading);
export const useSkillTreeError = () => useSkillTreeStore(state => state.error);

// Computed selectors
export const useAllocatedNodeCount = () => useSkillTreeStore(state => state.userAllocations.size);
export const useAvailableSkillPoints = () => useSkillTreeStore(state => state.userStats?.available_skill_points || 0);

// Removed problematic selectors that caused infinite loops.
// Components should use direct store access or individual selectors instead.