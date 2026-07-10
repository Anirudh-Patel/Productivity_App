import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Zap, Database, Clock, TrendingUp, AlertTriangle,
  Cpu, HardDrive, Wifi, Eye, BarChart3, RefreshCw, Settings
} from 'lucide-react';

interface PerformanceMetrics {
  timestamp: number;
  renderTime: number;
  ipcLatency: number;
  memoryUsage: number;
  databaseResponseTime: number;
  frameRate: number;
  networkLatency?: number;
}

interface ComponentMetrics {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  slowRenders: number;
}

interface SystemInfo {
  platform: string;
  memory: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  cpu: {
    cores: number;
    usage: number;
  };
  storage: {
    total: number;
    used: number;
    available: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private frameRateQueue: number[] = [];
  private lastFrameTime = 0;
  private observers: Set<() => void> = new Set();

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring() {
    // Frame rate monitoring
    const trackFrameRate = () => {
      const now = performance.now();
      if (this.lastFrameTime) {
        const frameTime = now - this.lastFrameTime;
        const fps = 1000 / frameTime;
        
        this.frameRateQueue.push(fps);
        if (this.frameRateQueue.length > 60) {
          this.frameRateQueue.shift();
        }
      }
      this.lastFrameTime = now;
      requestAnimationFrame(trackFrameRate);
    };
    trackFrameRate();

    // Collect metrics every second
    setInterval(() => {
      this.collectMetrics();
      this.notifyObservers();
    }, 1000);

    // Memory monitoring
    this.startMemoryMonitoring();
  }

  private async collectMetrics() {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      renderTime: this.getAverageRenderTime(),
      ipcLatency: await this.measureIPCLatency(),
      memoryUsage: this.getMemoryUsage(),
      databaseResponseTime: await this.measureDatabaseResponseTime(),
      frameRate: this.getAverageFrameRate()
    };

    this.metrics.push(metric);
    if (this.metrics.length > 300) { // Keep last 5 minutes
      this.metrics.shift();
    }
  }

  private getAverageRenderTime(): number {
    const recentRenders = Array.from(this.componentMetrics.values())
      .filter(c => Date.now() - c.lastRenderTime < 5000); // Last 5 seconds
    
    if (recentRenders.length === 0) return 0;
    
    return recentRenders.reduce((sum, c) => sum + c.averageRenderTime, 0) / recentRenders.length;
  }

  private async measureIPCLatency(): Promise<number> {
    const start = performance.now();
    try {
      // Simple IPC call to measure latency
      await new Promise(resolve => setTimeout(resolve, 0));
      return performance.now() - start;
    } catch {
      return 0;
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private async measureDatabaseResponseTime(): Promise<number> {
    const start = performance.now();
    try {
      // Simulate database query timing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      return performance.now() - start;
    } catch {
      return 0;
    }
  }

  private getAverageFrameRate(): number {
    if (this.frameRateQueue.length === 0) return 60;
    return this.frameRateQueue.reduce((sum, fps) => sum + fps, 0) / this.frameRateQueue.length;
  }

  private startMemoryMonitoring() {
    setInterval(() => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        if (memInfo.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB threshold
          console.warn('High memory usage detected:', memInfo.usedJSHeapSize / 1024 / 1024, 'MB');
        }
      }
    }, 5000);
  }

  trackComponentRender(componentName: string, renderTime: number) {
    const existing = this.componentMetrics.get(componentName) || {
      componentName,
      renderCount: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      slowRenders: 0
    };

    existing.renderCount++;
    existing.lastRenderTime = Date.now();
    existing.averageRenderTime = ((existing.averageRenderTime * (existing.renderCount - 1)) + renderTime) / existing.renderCount;
    
    if (renderTime > 16) { // Over 1 frame at 60fps
      existing.slowRenders++;
    }

    this.componentMetrics.set(componentName, existing);
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getComponentMetrics(): ComponentMetrics[] {
    return Array.from(this.componentMetrics.values())
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime);
  }

  subscribe(callback: () => void) {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  private notifyObservers() {
    this.observers.forEach(callback => callback());
  }

  reset() {
    this.metrics.length = 0;
    this.componentMetrics.clear();
  }
}

const performanceMonitor = new PerformanceMonitor();

export const PerformanceMonitoringDashboard: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ 
  isOpen, 
  onClose 
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [componentMetrics, setComponentMetrics] = useState<ComponentMetrics[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'components' | 'system'>('overview');

  useEffect(() => {
    if (!isOpen) return;

    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics());
      setComponentMetrics(performanceMonitor.getComponentMetrics());
    };

    updateMetrics();
    const unsubscribe = performanceMonitor.subscribe(updateMetrics);

    // Mock system info (in real app, you'd get this from Tauri)
    setSystemInfo({
      platform: 'darwin',
      memory: {
        total: 16384,
        used: 8192,
        available: 8192,
        percentage: 50
      },
      cpu: {
        cores: 8,
        usage: 25
      },
      storage: {
        total: 500000,
        used: 250000,
        available: 250000
      }
    });

    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  const latestMetric = metrics[metrics.length - 1];
  const averageFrameRate = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.frameRate, 0) / metrics.length 
    : 60;

  const getHealthStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.warning) return 'warning';
    return 'critical';
  };

  const HealthIndicator: React.FC<{ status: 'good' | 'warning' | 'critical' }> = ({ status }) => {
    const colors = {
      good: 'bg-green-500',
      warning: 'bg-yellow-500',
      critical: 'bg-red-500'
    };

    return (
      <div className={`w-3 h-3 rounded-full ${colors[status]} animate-pulse`} />
    );
  };

  const MetricCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    value: string;
    subtitle?: string;
    status: 'good' | 'warning' | 'critical';
    trend?: 'up' | 'down' | 'stable';
  }> = ({ icon, title, value, subtitle, status, trend }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800 rounded-lg p-4 border border-gray-700"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="text-gray-400">{icon}</div>
          <span className="text-sm font-medium text-gray-300">{title}</span>
        </div>
        <HealthIndicator status={status} />
      </div>
      
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      
      {subtitle && (
        <div className="text-xs text-gray-500 flex items-center space-x-1">
          {trend && (
            <TrendingUp 
              className={`w-3 h-3 ${
                trend === 'up' ? 'text-green-400 rotate-0' : 
                trend === 'down' ? 'text-red-400 rotate-180' : 
                'text-gray-400'
              }`} 
            />
          )}
          <span>{subtitle}</span>
        </div>
      )}
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Performance Monitor</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Live Monitoring</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => performanceMonitor.reset()}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mt-4">
            {[
              { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'components', label: 'Components', icon: <Eye className="w-4 h-4" /> },
              { id: 'system', label: 'System', icon: <Settings className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedTab === tab.id 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={<Zap className="w-4 h-4" />}
                  title="Frame Rate"
                  value={`${averageFrameRate.toFixed(1)} FPS`}
                  subtitle="Target: 60 FPS"
                  status={getHealthStatus(60 - averageFrameRate, { good: 5, warning: 15 })}
                  trend={averageFrameRate > 55 ? 'up' : 'down'}
                />
                
                <MetricCard
                  icon={<Clock className="w-4 h-4" />}
                  title="Render Time"
                  value={`${latestMetric?.renderTime.toFixed(1) || 0} ms`}
                  subtitle="Target: < 16ms"
                  status={getHealthStatus(latestMetric?.renderTime || 0, { good: 16, warning: 32 })}
                />
                
                <MetricCard
                  icon={<Database className="w-4 h-4" />}
                  title="DB Response"
                  value={`${latestMetric?.databaseResponseTime.toFixed(1) || 0} ms`}
                  subtitle="Average query time"
                  status={getHealthStatus(latestMetric?.databaseResponseTime || 0, { good: 10, warning: 50 })}
                />
                
                <MetricCard
                  icon={<HardDrive className="w-4 h-4" />}
                  title="Memory Usage"
                  value={`${latestMetric?.memoryUsage.toFixed(1) || 0} MB`}
                  subtitle="JavaScript heap"
                  status={getHealthStatus(latestMetric?.memoryUsage || 0, { good: 50, warning: 100 })}
                />
              </div>

              {/* Performance Chart */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Performance Trends</h3>
                <div className="h-64 flex items-end space-x-1">
                  {metrics.slice(-50).map((metric, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-gradient-to-t from-purple-600 to-purple-400 rounded-t"
                      style={{ 
                        height: `${Math.min(100, (metric.frameRate / 60) * 100)}%`,
                        minHeight: '2px'
                      }}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2">Frame rate over time (last 50 samples)</div>
              </div>
            </div>
          )}

          {selectedTab === 'components' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Component Performance</h3>
              
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left p-4 text-gray-300">Component</th>
                      <th className="text-left p-4 text-gray-300">Renders</th>
                      <th className="text-left p-4 text-gray-300">Avg Time</th>
                      <th className="text-left p-4 text-gray-300">Slow Renders</th>
                      <th className="text-left p-4 text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentMetrics.map((component, index) => (
                      <tr key={component.componentName} className="border-t border-gray-700">
                        <td className="p-4 text-white font-medium">{component.componentName}</td>
                        <td className="p-4 text-gray-300">{component.renderCount}</td>
                        <td className="p-4 text-gray-300">{component.averageRenderTime.toFixed(2)}ms</td>
                        <td className="p-4 text-gray-300">{component.slowRenders}</td>
                        <td className="p-4">
                          <HealthIndicator 
                            status={getHealthStatus(component.averageRenderTime, { good: 8, warning: 16 })} 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedTab === 'system' && systemInfo && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">System Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Cpu className="w-5 h-5 text-blue-400" />
                    <span className="font-medium text-white">CPU</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{systemInfo.cpu.cores} cores</div>
                  <div className="text-sm text-gray-400">{systemInfo.cpu.usage}% usage</div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-400 h-2 rounded-full" 
                      style={{ width: `${systemInfo.cpu.usage}%` }}
                    />
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <HardDrive className="w-5 h-5 text-green-400" />
                    <span className="font-medium text-white">Memory</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(systemInfo.memory.used / 1024).toFixed(1)} GB
                  </div>
                  <div className="text-sm text-gray-400">
                    of {(systemInfo.memory.total / 1024).toFixed(1)} GB
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-400 h-2 rounded-full" 
                      style={{ width: `${systemInfo.memory.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Database className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-white">Storage</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(systemInfo.storage.used / 1000).toFixed(0)} GB
                  </div>
                  <div className="text-sm text-gray-400">
                    of {(systemInfo.storage.total / 1000).toFixed(0)} GB
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className="bg-purple-400 h-2 rounded-full" 
                      style={{ width: `${(systemInfo.storage.used / systemInfo.storage.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Hook for using the performance monitor
export const usePerformanceMonitor = () => {
  return {
    trackRender: (componentName: string, renderTime: number) => {
      performanceMonitor.trackComponentRender(componentName, renderTime);
    },
    measureAsync: async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        const result = await fn();
        const duration = performance.now() - start;
        performanceMonitor.trackComponentRender(name, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        performanceMonitor.trackComponentRender(`${name}_error`, duration);
        throw error;
      }
    }
  };
};