// Performance monitoring and optimization utilities
'use client';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  totalTrades: number;
  memoryUsage?: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean
  value: number
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize?: number
  }
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initObservers();
    }
  }

  private initObservers() {
    // Monitor long tasks that could block the main thread
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) { // Tasks longer than 50ms
          // Long task detected
        }
      });
    });

    try {
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (e) {
      // Longtask observer not supported in all browsers
    }

    // Monitor layout shifts
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      list.getEntries().forEach((entry) => {
        const layoutShift = entry as LayoutShiftEntry
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
        }
      });

      if (clsValue > 0.1) { // CLS threshold
        // High Cumulative Layout Shift detected
      }
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (e) {
      // Layout shift observer not supported in all browsers
    }
  }

  measureRender<T>(componentName: string, renderFn: () => T): T {
    const startTime = performance.now();
    const result = renderFn();
    const endTime = performance.now();
    
    return result;
  }

  measureDataProcessing<T>(operationName: string, operation: () => T): T {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    
    return result;
  }

  trackComponentMetrics(componentName: string, metrics: Partial<PerformanceMetrics>) {
    const existing = this.metrics.get(componentName) || {
      loadTime: 0,
      renderTime: 0,
      totalTrades: 0,
    };

    this.metrics.set(componentName, { ...existing, ...metrics });
  }

  getMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  getMemoryUsage(): number | undefined {
    return (performance as PerformanceWithMemory).memory?.usedJSHeapSize;
  }

  isPerformanceDegraded(): boolean {
    const memory = this.getMemoryUsage();
    if (memory && memory > 100 * 1024 * 1024) {
      return true;
    }
    return false;
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

// Virtual scrolling utility for large datasets
export function calculateVisibleItems(
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  totalItems: number,
  overscan: number = 5
) {
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    totalItems - 1
  );

  return {
    start: Math.max(0, visibleStart - overscan),
    end: Math.min(totalItems - 1, visibleEnd + overscan),
    visibleStart,
    visibleEnd,
  };
}

// Memoization utility with size limit
export function createMemoCache<T extends (...args: any[]) => any>(
  fn: T,
  maxSize: number = 100
) {
  const cache = new Map<string, ReturnType<T>>();
  const keyOrder: string[] = [];

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    
    if (keyOrder.length >= maxSize) {
      const oldestKey = keyOrder.shift()!;
      cache.delete(oldestKey);
    }

    cache.set(key, result);
    keyOrder.push(key);

    return result;
  };
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const trackRender = (renderTime: number) => {
    performanceMonitor.trackComponentMetrics(componentName, { renderTime });
  };

  const trackLoad = (loadTime: number) => {
    performanceMonitor.trackComponentMetrics(componentName, { loadTime });
  };

  return { trackRender, trackLoad };
}
