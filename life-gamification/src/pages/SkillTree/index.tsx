import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SkillTreeCanvas } from '../../shared/components/ui/CanvasSkillTree';
import { SkillTreeMinimap, SkillTreeSearch } from '../../shared/components/ui/SkillTreeNavigation';
import { 
  useSkillTreeNodes,
  useSkillTreeConnections, 
  useUserAllocations,
  useUserStats,
  useSkillTreeLoading,
  useSkillTreeError,
  useSkillTreeStore
} from '../../store/skillTreeStore';
import { useGameStore } from '../../store/gameStore';
import { SkillNode, Viewport } from '../../shared/components/ui/CanvasSkillTree/types';
import { logger } from '../../utils/logger';
import LoadingSpinner from '../../shared/components/ui/LoadingSpinner';

const SkillTreePage: React.FC = () => {
  // Skill tree state
  const nodes = useSkillTreeNodes();
  const connections = useSkillTreeConnections();
  const userAllocations = useUserAllocations();
  const userStats = useUserStats();
  const skillTreeLoading = useSkillTreeLoading();
  const skillTreeError = useSkillTreeError();
  
  // Debug logging
  console.log('SkillTreePage: State:', {
    nodeCount: nodes?.length || 0,
    connectionCount: connections?.length || 0,
    allocationsCount: userAllocations?.size || 0,
    loading: skillTreeLoading,
    error: skillTreeError,
    hasStats: !!userStats
  });
  // Direct store access to avoid problematic selectors
  const availablePoints = userStats?.available_skill_points || 0;
  const loadSkillTree = useSkillTreeStore(state => state.loadSkillTree);
  const allocateNode = useSkillTreeStore(state => state.allocateNode);
  const deallocateNode = useSkillTreeStore(state => state.deallocateNode);
  const resetTree = useSkillTreeStore(state => state.resetTree);
  
  // Calculate stat totals directly
  const statTotals = userStats ? {
    strength: userStats.strength_bonus,
    intelligence: userStats.intelligence_bonus,
    luck: userStats.luck_bonus,
    aura: userStats.aura_bonus,
    will: userStats.will_bonus,
    health: userStats.health_bonus,
    mana: userStats.mana_bonus
  } : {
    strength: 0,
    intelligence: 0,
    luck: 0,
    aura: 0,
    will: 0,
    health: 0,
    mana: 0
  };
  
  // Game state (for user level)
  const { user } = useGameStore();
  
  // Local UI state
  const [hoveredNode, setHoveredNode] = useState<SkillNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 0.5,
    width: 0,
    height: 0
  });

  // Ref to track if we've already loaded the skill tree
  const hasLoadedRef = useRef(false);

  // Load skill tree on component mount
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      console.log('SkillTreePage: Component mounted, starting load...');
      
      // Test direct API call
      import('@tauri-apps/api/core').then(async ({ invoke }) => {
        try {
          console.log('SkillTreePage: Testing direct API call...');
          const testNodes = await invoke('get_skill_nodes');
          console.log('SkillTreePage: Direct API call result:', { 
            nodeCount: testNodes?.length || 0,
            firstNode: testNodes?.[0] || 'none'
          });
        } catch (directError) {
          console.error('SkillTreePage: Direct API call failed:', directError);
        }
      });
      
      console.log('SkillTreePage: Starting store loadSkillTree...');
      loadSkillTree().then(() => {
        console.log('SkillTreePage: Store loadSkillTree completed successfully');
      }).catch(error => {
        console.error('SkillTreePage: Store loadSkillTree failed:', error);
        logger.error('Failed to load skill tree in component', error, 'SkillTreePage');
      });
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback(async (nodeKey: string) => {
    const node = nodes.find(n => n.node_key === nodeKey);
    if (!node) return;

    setSelectedNode(node);
    
    // If already allocated, allow deallocation
    if (userAllocations.has(nodeKey)) {
      try {
        setIsAllocating(true);
        await deallocateNode(nodeKey);
        logger.info('Node deallocated via UI', { nodeKey, nodeName: node.name }, 'SkillTreePage');
      } catch (error) {
        logger.error('Failed to deallocate node via UI', error, 'SkillTreePage');
        // Could show error toast here
      } finally {
        setIsAllocating(false);
      }
    } else {
      // Try to allocate
      try {
        setIsAllocating(true);
        await allocateNode(nodeKey);
        logger.info('Node allocated via UI', { nodeKey, nodeName: node.name }, 'SkillTreePage');
      } catch (error) {
        logger.error('Failed to allocate node via UI', error, 'SkillTreePage');
        // Could show error toast here
      } finally {
        setIsAllocating(false);
      }
    }
  }, [nodes, userAllocations, allocateNode, deallocateNode]);

  // Handle node hover
  const handleNodeHover = useCallback((nodeKey: string | null) => {
    const node = nodeKey ? nodes.find(n => n.node_key === nodeKey) : null;
    setHoveredNode(node);
  }, [nodes]);

  // Handle reset tree
  const handleResetTree = useCallback(async () => {
    try {
      await resetTree();
      setShowResetConfirm(false);
      logger.info('Skill tree reset via UI', {}, 'SkillTreePage');
    } catch (error) {
      logger.error('Failed to reset skill tree via UI', error, 'SkillTreePage');
    }
  }, [resetTree]);

  // Handle viewport changes from navigation
  const handleViewportChange = useCallback((newViewport: Partial<Viewport>) => {
    setViewport(prev => ({ ...prev, ...newViewport }));
  }, []);

  // Handle node focus from search (centers node in viewport)
  const handleNodeFocus = useCallback((node: SkillNode) => {
    const newViewport = {
      x: viewport.width / 2 - node.x_position * viewport.zoom,
      y: viewport.height / 2 - node.y_position * viewport.zoom
    };
    handleViewportChange(newViewport);
    setSelectedNode(node);
    logger.info('Node focused from search', { nodeKey: node.node_key, nodeName: node.name }, 'SkillTreePage');
  }, [viewport, handleViewportChange]);

  // Handle node select from search (focuses and selects)
  const handleNodeSelect = useCallback((node: SkillNode) => {
    handleNodeFocus(node);
    // Optionally trigger click action
    handleNodeClick(node.node_key);
  }, [handleNodeFocus, handleNodeClick]);

  if (skillTreeLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
        <span className="ml-4 text-lg">Loading massive skill tree...</span>
      </div>
    );
  }

  if (skillTreeError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️ Failed to load skill tree</div>
          <div className="text-gray-400 mb-4">{skillTreeError}</div>
          <button 
            onClick={() => loadSkillTree()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-theme-primary">
      {/* Header */}
      <div className="bg-theme-secondary border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-2xl font-bold text-white">Skill Tree</h1>
          
          {/* Stats Display */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="px-3 py-1 bg-blue-600 rounded">
              <span className="text-blue-100">Skill Points: </span>
              <span className="text-white font-bold">{availablePoints}</span>
            </div>
            
            <div className="px-3 py-1 bg-green-600 rounded">
              <span className="text-green-100">Allocated: </span>
              <span className="text-white font-bold">{userAllocations.size}</span>
            </div>

            <div className="px-3 py-1 bg-purple-600 rounded">
              <span className="text-purple-100">Nodes: </span>
              <span className="text-white font-bold">{nodes.length}</span>
            </div>
            
            {/* DEBUG: Show loading state and error info */}
            <div className="px-3 py-1 bg-yellow-500 text-black rounded text-xs">
              <span className="font-bold">DEBUG:</span>
              <span className="ml-1">Loading: {String(skillTreeLoading)}</span>
              {skillTreeError && <span className="ml-1 text-red-800">Error: {skillTreeError}</span>}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={userAllocations.size === 0}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Reset Tree
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Skill Tree Canvas */}
        <div className="flex-1 relative">
          <SkillTreeCanvas
            nodes={nodes}
            connections={connections}
            allocatedNodes={userAllocations}
            availablePoints={availablePoints}
            userLevel={user?.level || 1}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onViewportChange={handleViewportChange}
            className={isAllocating ? 'pointer-events-none opacity-75' : ''}
          />
          
          {isAllocating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-25">
              <div className="bg-theme-secondary px-6 py-3 rounded border border-gray-600">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-white">Processing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-theme-secondary border-l border-gray-700 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-700">
            <SkillTreeSearch
              nodes={nodes}
              allocatedNodes={userAllocations}
              onNodeSelect={handleNodeSelect}
              onNodeFocus={handleNodeFocus}
            />
          </div>

          {/* Minimap */}
          <div className="p-4 border-b border-gray-700">
            <SkillTreeMinimap
              nodes={nodes}
              allocatedNodes={userAllocations}
              viewport={viewport}
              onViewportChange={handleViewportChange}
            />
          </div>

          {/* Stat Totals */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Total Stats</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-red-300">Strength:</span>
                <span className="text-white font-bold">{statTotals.strength}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-300">Intelligence:</span>
                <span className="text-white font-bold">{statTotals.intelligence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-300">Luck:</span>
                <span className="text-white font-bold">{statTotals.luck}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Aura:</span>
                <span className="text-white font-bold">{statTotals.aura}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-300">Will:</span>
                <span className="text-white font-bold">{statTotals.will}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-300">Health:</span>
                <span className="text-white font-bold">{statTotals.health}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-300">Mana:</span>
                <span className="text-white font-bold">{statTotals.mana}</span>
              </div>
            </div>
          </div>

          {/* Node Details */}
          <div className="flex-1 p-4">
            {selectedNode ? (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{selectedNode.name}</h3>
                <p className="text-gray-300 text-sm mb-4">{selectedNode.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white capitalize">{selectedNode.node_type}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Primary Stat:</span>
                    <span className="text-white capitalize">{selectedNode.primary_stat}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Level Req:</span>
                    <span className="text-white">{selectedNode.level_requirement}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Skill Points:</span>
                    <span className="text-white">{selectedNode.skill_point_cost}</span>
                  </div>

                  {selectedNode.prerequisite_nodes.length > 0 && (
                    <div>
                      <span className="text-gray-400">Prerequisites:</span>
                      <div className="mt-1 text-xs">
                        {selectedNode.prerequisite_nodes.map(prereq => (
                          <div key={prereq} className={`px-2 py-1 rounded mb-1 ${userAllocations.has(prereq) ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>
                            {prereq}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : hoveredNode ? (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{hoveredNode.name}</h3>
                <p className="text-gray-300 text-sm">{hoveredNode.description}</p>
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-8">
                <div className="text-6xl mb-4">🌳</div>
                <p className="text-lg mb-2">POE-Style Skill Tree</p>
                <p className="text-sm">Click or hover nodes to see details</p>
                <p className="text-xs mt-4">{nodes.length} nodes loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-theme-secondary border border-gray-700 rounded-lg p-6 max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Reset Skill Tree?</h3>
            <p className="text-gray-300 mb-6">
              This will refund all {userAllocations.size} allocated skill points. This action cannot be undone.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleResetTree}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reset Tree
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillTreePage;