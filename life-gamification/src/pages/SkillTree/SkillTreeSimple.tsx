import React from 'react';

const SkillTreeSimple: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-theme-primary">
      {/* Header */}
      <div className="bg-theme-secondary border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-white">Skill Tree (Coming Soon)</h1>
        <p className="text-gray-400 mt-2">
          POE-style skill tree with 2,050 nodes is being implemented.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🌳</div>
          <h2 className="text-2xl font-bold text-white mb-4">Massive Skill Tree</h2>
          <div className="space-y-2 text-gray-300 max-w-md">
            <p>✅ Database schema with 2,050 node capacity</p>
            <p>✅ Canvas-based rendering system</p>
            <p>✅ Level-of-detail optimization</p>
            <p>✅ Advanced search and minimap</p>
            <p>✅ Zustand state management</p>
            <p>🚧 Backend API integration in progress</p>
          </div>
          
          <div className="mt-8 p-6 bg-theme-secondary rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">System Features</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
              <div>2,050 Total Nodes</div>
              <div>5 Primary Stats</div>
              <div>Canvas Rendering</div>
              <div>Viewport Culling</div>
              <div>Search & Filter</div>
              <div>Interactive Minimap</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillTreeSimple;