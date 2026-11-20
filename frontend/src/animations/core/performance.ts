// ============================================================
// NEXUSPLAY — Performance Utilities
// Monitoring, debugging, and optimization helpers
// ============================================================

interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
}

const _marks = new Map<string, PerformanceMark>();
const _frameTimes: number[] = [];
let _fpsCallback: ((fps: number) => void) | null = null;
let _fpsInterval: number | null = null;

/**
 * Mark the start of a performance measurement
 */
export function markStart(name: string): void {
  _marks.set(name, { name, startTime: performance.now() });
}

/**
 * Mark the end of a performance measurement
 */
export function markEnd(name: string): number | null {
  const mark = _marks.get(name);
  if (!mark) return null;
  
  const duration = performance.now() - mark.startTime;
  mark.duration = duration;
  return duration;
}

/**
 * Get duration of a marked measurement
 */
export function getDuration(name: string): number | null {
  const mark = _marks.get(name);
  return mark?.duration ?? null;
}

/**
 * Measure a function's execution time
 */
export function measure<T>(name: string, fn: () => T): T {
  markStart(name);
  try {
    return fn();
  } finally {
    markEnd(name);
  }
}

/**
 * Measure async function
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  markStart(name);
  try {
    return await fn();
  } finally {
    markEnd(name);
  }
}

/**
 * Start FPS monitoring
 */
export function startFPSMonitor(callback: (fps: number) => void, interval = 1000): void {
  stopFPSMonitor();
  _fpsCallback = callback;
  _frameTimes.length = 0;
  
  function tick(now: number) {
    _frameTimes.push(now);
    
    // Remove frames older than interval
    const cutoff = now - interval;
    while (_frameTimes.length > 0 && _frameTimes[0] < cutoff) {
      _frameTimes.shift();
    }
    
    if (_frameTimes.length >= 2) {
      const fps = Math.round((_frameTimes.length - 1) / ((now - _frameTimes[0]) / 1000));
      _fpsCallback?.(fps);
    }
    
    _fpsInterval = requestAnimationFrame(tick);
  }
  
  _fpsInterval = requestAnimationFrame(tick);
}

/**
 * Stop FPS monitoring
 */
export function stopFPSMonitor(): void {
  if (_fpsInterval) {
    cancelAnimationFrame(_fpsInterval);
    _fpsInterval = null;
  }
  _fpsCallback = null;
}

/**
 * Get current FPS estimate
 */
export function getCurrentFPS(): number {
  const now = performance.now();
  const cutoff = now - 1000;
  const recent = _frameTimes.filter(t => t > cutoff);
  if (recent.length < 2) return 60;
  return Math.round((recent.length - 1) / ((now - recent[0]) / 1000));
}

/**
 * Check if animation is likely janky (dropping frames)
 */
export function isJanky(threshold = 45): boolean {
  return getCurrentFPS() < threshold;
}

/**
 * Debounce function with RAF alignment
 */
export function rafDebounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay = 0
): T {
  let rafId: number | null = null;
  let timeoutId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    
    if (rafId) cancelAnimationFrame(rafId);
    
    rafId = requestAnimationFrame(() => {
      if (delay > 0) {
        timeoutId = window.setTimeout(() => {
          fn(...(lastArgs as Parameters<T>));
        }, delay);
      } else {
        fn(...(lastArgs as Parameters<T>));
      }
    });
  }) as T;
  
  (debounced as any).cancel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) clearTimeout(timeoutId);
  };
  
  return debounced;
}

/**
 * Throttle function with RAF alignment
 */
export function rafThrottle<T extends (...args: unknown[]) => void>(
  fn: T
): T {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args;
    
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fn(...(lastArgs as Parameters<T>));
      });
    }
  }) as T;
  
  (throttled as any).cancel = () => {
    if (rafId) cancelAnimationFrame(rafId);
  };
  
  return throttled;
}

/**
 * Check if element is visible in viewport
 */
export function isInViewport(
  element: Element,
  threshold = 0
): boolean {
  const rect = element.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  
  return (
    rect.bottom >= threshold * vh &&
    rect.top <= (1 - threshold) * vh &&
    rect.right >= threshold * vw &&
    rect.left <= (1 - threshold) * vw
  );
}

/**
 * Get element's intersection ratio with viewport
 */
export function getIntersectionRatio(element: Element): number {
  const rect = element.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  
  const intersectionRect = {
    top: Math.max(rect.top, 0),
    left: Math.max(rect.left, 0),
    bottom: Math.min(rect.bottom, vh),
    right: Math.min(rect.right, vw),
  };
  
  const intersectionArea = Math.max(0, intersectionRect.bottom - intersectionRect.top) *
    Math.max(0, intersectionRect.right - intersectionRect.left);
  const elementArea = rect.width * rect.height;
  
  return elementArea > 0 ? intersectionArea / elementArea : 0;
}

/**
 * Detect if we're on a low-end device
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  // Check hardware concurrency
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 2) return true;
  
  // Check device memory (if available)
  const memory = (navigator as any).deviceMemory;
  if (memory && memory <= 2) return true;
  
  // Check connection
  const connection = (navigator as any).connection;
  if (connection?.saveData) return true;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return true;
  
  return false;
}

/**
 * Get recommended animation quality based on device
 */
export function getAnimationQuality(): 'high' | 'medium' | 'low' {
  if (isLowEndDevice()) return 'low';
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency >= 8) return 'high';
  return 'medium';
}

/**
 * Apply quality settings to animation config
 */
export function applyQualitySettings<T extends Record<string, any>>(
  config: T,
  quality: 'high' | 'medium' | 'low' = getAnimationQuality()
): T {
  const multipliers = {
    high: { duration: 1, particles: 1, shadows: true, blur: true },
    medium: { duration: 1, particles: 0.5, shadows: true, blur: false },
    low: { duration: 0.5, particles: 0, shadows: false, blur: false },
  };
  
  const settings = multipliers[quality];
  const result = { ...config } as T & { 
    duration?: number; 
    particleCount?: number; 
    enableShadows?: boolean; 
    enableBlur?: boolean;
  };
  
  if (result.duration !== undefined) result.duration *= settings.duration;
  if (result.particleCount !== undefined) result.particleCount = Math.round(result.particleCount * settings.particles);
  if (result.enableShadows !== undefined) result.enableShadows = settings.shadows;
  if (result.enableBlur !== undefined) result.enableBlur = settings.blur;
  
  return result;
}