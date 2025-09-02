import React, { useState } from 'react';
import { AvatarCanvas } from '../AvatarCanvas/AvatarCanvas';
import { EquipmentPanel } from '../EquipmentPanel/EquipmentPanel';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useAvatarStore } from '../../../../store/slices/avatarSlice';

export const AvatarDisplay: React.FC<{
  showEquipment?: boolean;
  compact?: boolean;
}> = ({ showEquipment = true, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(2);
  const { loadUserEquipment } = useAvatarStore();

  const handleZoomChange = (value: number) => {
    setCurrentZoom(value);
  };

  const handleRefresh = () => {
    loadUserEquipment(1); // Refresh equipment data
  };

  if (compact) {
    // Small version for dashboard
    return (
      <div 
        className="relative cursor-pointer hover:scale-105 transition-transform"
        onClick={() => setIsExpanded(true)}
      >
        <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center w-16 h-16 p-0.5">
          <div className="rounded flex items-center justify-center w-full h-full" style={{
            background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)'
          }}>
            <AvatarCanvas width={50} height={60} zoom={1} />
          </div>
        </div>
        
        {/* Expanded Modal for compact view */}
        {isExpanded && (
          <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
            onClick={() => setIsExpanded(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-theme-primary rounded-xl p-8 border border-gray-800"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-200">Character Preview</h2>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Minimize2 className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex justify-center mb-4">
                <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center p-0.5">
                  <div className="rounded flex items-center justify-center" style={{
                    background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)',
                    width: '256px',
                    height: '320px'
                  }}>
                    <AvatarCanvas width={200} height={240} zoom={2} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="w-full px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-solo-accent/25 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar Display */}
      <div className="bg-theme-primary rounded-xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-200">Character Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-theme-bg hover:bg-theme-secondary rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        <div className="flex justify-center mb-4">
          <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center p-0.5">
            <div className="rounded flex items-center justify-center" style={{
              background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)',
              width: `${128 * currentZoom}px`,
              height: `${128 * currentZoom}px`
            }}>
              <AvatarCanvas 
                width={100} 
                height={120} 
                zoom={currentZoom} 
              />
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center gap-4">
          <label className="text-gray-400 text-sm">Zoom:</label>
          <input
            type="range"
            min="1"
            max="4"
            step="0.5"
            value={currentZoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-gray-400 text-sm w-8">{currentZoom}x</span>
        </div>
      </div>

      {/* Equipment Panel */}
      {showEquipment && <EquipmentPanel />}

      {/* Full Screen Modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setIsExpanded(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-theme-primary rounded-xl p-8 border border-gray-800 max-w-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-200">Full Screen Preview</h2>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center p-1">
                <div className="rounded flex items-center justify-center" style={{
                  background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)',
                  width: '384px',
                  height: '480px'
                }}>
                  <AvatarCanvas width={300} height={360} zoom={3} />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setIsExpanded(false)}
                className="px-6 py-3 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-solo-accent/25 transition-all"
              >
                Close Full Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};