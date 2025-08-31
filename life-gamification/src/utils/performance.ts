import { useEffect, useState, useCallback } from 'react';
import { logger } from './logger';

// Performance monitoring
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();
  
  static startMeasurement(label: string): void {
    this.measurements.set(label, performance.now());
  }
  
  static endMeasurement(label: string, logThreshold = 100): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      logger.warn(`No start time found for measurement: ${label}`, undefined, 'PerformanceMonitor');
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.measurements.delete(label);
    
    if (duration > logThreshold) {
      logger.warn(`Slow operation detected: ${label} took ${duration.toFixed(2)}ms`, 
        { duration, threshold: logThreshold }, 'PerformanceMonitor');
    } else {
      logger.debug(`Performance: ${label} completed in ${duration.toFixed(2)}ms`, 
        { duration }, 'PerformanceMonitor');
    }
    
    return duration;
  }
  
  static measureAsync<T>(
    label: string,
    operation: () => Promise<T>,
    logThreshold = 100
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      this.startMeasurement(label);
      try {
        const result = await operation();
        this.endMeasurement(label, logThreshold);
        resolve(result);
      } catch (error) {
        this.endMeasurement(label, logThreshold);
        reject(error);
      }
    });
  }
}

// Hook for measuring component render performance
export const useRenderPerformance = (componentName: string, enabled = process.env.NODE_ENV === 'development') => {
  useEffect(() => {
    if (!enabled) return;
    
    const measurementLabel = `${componentName}_render`;
    PerformanceMonitor.startMeasurement(measurementLabel);
    
    return () => {
      PerformanceMonitor.endMeasurement(measurementLabel, 16); // 60fps = ~16ms per frame
    };
  });
};

// Hook for debouncing values
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Hook for throttling function calls
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const [lastCall, setLastCall] = useState(0);

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        setLastCall(now);
        return callback(...args);
      }
    }) as T,
    [callback, delay, lastCall]
  );
};

// Memory usage monitoring
export const getMemoryUsage = (): {
  used: number;
  total: number;
  percentage: number;
} => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
    };
  }
  
  return { used: 0, total: 0, percentage: 0 };
};

// Log memory usage periodically
export const startMemoryMonitoring = (intervalMs = 30000) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  const interval = setInterval(() => {
    const memory = getMemoryUsage();
    if (memory.used > 0) {
      logger.debug('Memory usage', memory, 'PerformanceMonitor');
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
};

// Virtual scrolling helper
export const useVirtualList = <T>(
  items: T[],
  containerHeight: number,
  itemHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStartIndex = Math.floor(scrollTop / itemHeight);
  const visibleEndIndex = Math.min(
    visibleStartIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length - 1
  );
  
  const visibleItems = items.slice(visibleStartIndex, visibleEndIndex + 1);
  const offsetY = visibleStartIndex * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  return {
    visibleItems,
    offsetY,
    totalHeight,
    scrollTop,
    setScrollTop,
    visibleStartIndex,
    visibleEndIndex
  };
};