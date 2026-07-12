import React, { useState, useMemo, useCallback } from 'react';
import { SkillNode, STAT_COLORS } from '../CanvasSkillTree/types';

interface SkillTreeSearchProps {
  nodes: SkillNode[];
  allocatedNodes: Set<string>;
  onNodeSelect: (node: SkillNode) => void;
  onNodeFocus: (node: SkillNode) => void;
  className?: string;
}

interface SearchResult {
  node: SkillNode;
  score: number;
  matchType: 'name' | 'description' | 'stat' | 'type';
}

export const SkillTreeSearch: React.FC<SkillTreeSearchProps> = ({
  nodes,
  allocatedNodes,
  onNodeSelect,
  onNodeFocus,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Search algorithm with fuzzy matching and scoring
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    nodes.forEach(node => {
      let score = 0;
      let matchType: SearchResult['matchType'] = 'name';

      // Name matching (highest priority)
      const nameLower = node.name.toLowerCase();
      if (nameLower.includes(query)) {
        score += nameLower.indexOf(query) === 0 ? 100 : 80; // Exact start match gets higher score
        matchType = 'name';
      }

      // Description matching
      const descLower = node.description.toLowerCase();
      if (descLower.includes(query)) {
        score += 60;
        if (score < 60) matchType = 'description';
      }

      // Stat matching
      if (node.primary_stat.toLowerCase().includes(query) || 
          node.secondary_stat?.toLowerCase().includes(query)) {
        score += 40;
        if (score < 40) matchType = 'stat';
      }

      // Node type matching
      if (node.node_type.toLowerCase().includes(query)) {
        score += 30;
        if (score < 30) matchType = 'type';
      }

      // Bonus for allocated nodes
      if (allocatedNodes.has(node.node_key)) {
        score += 10;
      }

      if (score > 0) {
        results.push({ node, score, matchType });
      }
    });

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score).slice(0, 20); // Limit to top 20 results
  }, [searchQuery, nodes, allocatedNodes]);

  // Filter results based on selected filter
  const filteredResults = useMemo(() => {
    if (selectedFilter === 'all') return searchResults;
    if (selectedFilter === 'allocated') {
      return searchResults.filter(result => allocatedNodes.has(result.node.node_key));
    }
    if (selectedFilter === 'available') {
      return searchResults.filter(result => !allocatedNodes.has(result.node.node_key));
    }
    // Filter by node type or primary stat
    return searchResults.filter(result => 
      result.node.node_type === selectedFilter || 
      result.node.primary_stat === selectedFilter
    );
  }, [searchResults, selectedFilter, allocatedNodes]);

  // Quick filters
  const quickFilters = useMemo(() => [
    { key: 'all', label: 'All', count: searchResults.length },
    { key: 'allocated', label: 'Allocated', count: searchResults.filter(r => allocatedNodes.has(r.node.node_key)).length },
    { key: 'available', label: 'Available', count: searchResults.filter(r => !allocatedNodes.has(r.node.node_key)).length },
    { key: 'start', label: 'Start', count: searchResults.filter(r => r.node.node_type === 'start').length },
    { key: 'specialized', label: 'Specialized', count: searchResults.filter(r => r.node.node_type === 'specialized').length },
    { key: 'augmenting', label: 'Augmenting', count: searchResults.filter(r => r.node.node_type === 'augmenting').length },
    { key: 'strength', label: 'STR', count: searchResults.filter(r => r.node.primary_stat === 'strength').length },
    { key: 'intelligence', label: 'INT', count: searchResults.filter(r => r.node.primary_stat === 'intelligence').length },
    { key: 'luck', label: 'LCK', count: searchResults.filter(r => r.node.primary_stat === 'luck').length },
    { key: 'aura', label: 'AUR', count: searchResults.filter(r => r.node.primary_stat === 'aura').length },
    { key: 'will', label: 'WIL', count: searchResults.filter(r => r.node.primary_stat === 'will').length }
  ].filter(filter => filter.count > 0), [searchResults, allocatedNodes]);

  // Handle node selection
  const handleNodeClick = useCallback((node: SkillNode, action: 'select' | 'focus') => {
    if (action === 'select') {
      onNodeSelect(node);
      setIsExpanded(false); // Collapse search after selection
    } else {
      onNodeFocus(node);
    }
  }, [onNodeSelect, onNodeFocus]);

  // Get match type indicator
  const getMatchTypeIcon = (matchType: SearchResult['matchType']) => {
    switch (matchType) {
      case 'name': return '📛';
      case 'description': return '📝';
      case 'stat': return '⚡';
      case 'type': return '🏷️';
      default: return '🔍';
    }
  };

  // Get node type color
  const getNodeTypeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'start': return 'text-yellow-400';
      case 'augmenting': return 'text-purple-400';
      case 'specialized': return 'text-blue-400';
      case 'regular': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded ${className}`}>
      <div className="p-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search skill nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <div className="absolute right-2 top-2 text-gray-400">
            🔍
          </div>
        </div>

        {/* Search Results */}
        {(isExpanded && searchQuery.trim() && filteredResults.length > 0) && (
          <div className="mt-2 border border-gray-600 rounded bg-gray-800 max-h-80 overflow-y-auto">
            {/* Quick Filters */}
            <div className="p-2 border-b border-gray-600">
              <div className="flex flex-wrap gap-1">
                {quickFilters.slice(0, 8).map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setSelectedFilter(filter.key)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedFilter === filter.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredResults.map(({ node, matchType }) => {
                const isAllocated = allocatedNodes.has(node.node_key);
                const statColor = STAT_COLORS[node.primary_stat];
                
                return (
                  <div
                    key={node.node_key}
                    className={`p-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0 ${
                      isAllocated ? 'bg-green-900 bg-opacity-30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1 min-w-0"
                        onClick={() => handleNodeClick(node, 'focus')}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs">{getMatchTypeIcon(matchType)}</span>
                          <span 
                            className="font-medium text-sm truncate"
                            style={{ color: isAllocated ? statColor.primary : '#ffffff' }}
                          >
                            {node.name}
                          </span>
                          {isAllocated && <span className="text-xs text-green-400">✓</span>}
                        </div>
                        
                        <div className="flex items-center space-x-3 text-xs text-gray-400">
                          <span className={getNodeTypeColor(node.node_type)}>
                            {node.node_type}
                          </span>
                          <span style={{ color: statColor.secondary }}>
                            {node.primary_stat}
                          </span>
                          <span>Lv.{node.level_requirement}</span>
                          <span>{node.skill_point_cost}SP</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleNodeClick(node, 'select')}
                        className="ml-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        Go
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Results */}
        {(isExpanded && searchQuery.trim() && filteredResults.length === 0 && searchResults.length > 0) && (
          <div className="mt-2 p-3 text-center text-gray-400 text-sm border border-gray-600 rounded bg-gray-800">
            No results for "{selectedFilter}" filter
          </div>
        )}

        {/* No Search Results */}
        {(isExpanded && searchQuery.trim() && searchResults.length === 0) && (
          <div className="mt-2 p-3 text-center text-gray-400 text-sm border border-gray-600 rounded bg-gray-800">
            No nodes found for "{searchQuery}"
          </div>
        )}

        {/* Search Stats */}
        {searchQuery.trim() && (
          <div className="mt-2 text-xs text-gray-500 flex justify-between">
            <span>
              {filteredResults.length} of {searchResults.length} results
            </span>
            {isExpanded && (
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-blue-400 hover:text-blue-300"
              >
                Collapse
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};