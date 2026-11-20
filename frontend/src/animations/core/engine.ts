// ============================================================
// NEXUSPLAY — Animation Engine Core
// RAF-based scheduler, batch DOM reads/writes, will-change management
// ============================================================

type FrameCallback = (time: number) => void;
type Priority = 'high' | 'normal' | 'low';

interface ScheduledTask {
  id: number;
  callback: FrameCallback;
  priority: Priority;
  cancelled: boolean;
}

let _taskId = 0;
const _queues: Record<Priority, ScheduledTask[]> = {
  high: [],
  normal: [],
  low: [],
};

let _rafId: number | null = null;
let _isScheduled = false;
let _measureQueue: (() => void)[] = [];
let _mutateQueue: (() => void)[] = [];
let _processing = false;

/**
 * Schedule a callback to run on next RAF
 * Priority determines order within frame: high → normal → low
 */
export function schedule(callback: FrameCallback, priority: Priority = 'normal'): number {
  const id = ++_taskId;
  _queues[priority].push({ id, callback, priority, cancelled: false });
  requestFrame();
  return id;
}

/**
 * Cancel a scheduled task
 */
export function cancel(id: number): boolean {
  for (const queue of Object.values(_queues)) {
    const task = queue.find(t => t.id === id);
    if (task) {
      task.cancelled = true;
      return true;
    }
  }
  return false;
}

/**
 * Run DOM measurements (reads) - batched before mutations
 */
export function measure(callback: () => void): void {
  _measureQueue.push(callback);
  requestFrame();
}

/**
 * Run DOM mutations (writes) - batched after measurements
 */
export function mutate(callback: () => void): void {
  _mutateQueue.push(callback);
  requestFrame();
}

/**
 * Run measure then mutate in same frame
 */
export function measureMutate(measureFn: () => void, mutateFn: () => void): void {
  measure(() => {
    measureFn();
    mutate(mutateFn);
  });
}

/**
 * Promote element to GPU layer for animation
 * Returns cleanup function to remove will-change
 */
export function promote(
  element: HTMLElement,
  properties: string[] = ['transform', 'opacity']
): () => void {
  const style = element.style;
  const existing = style.willChange;
  const newProps = properties.filter(p => !existing?.includes(p));
  
  if (newProps.length > 0) {
    style.willChange = existing 
      ? `${existing}, ${newProps.join(', ')}` 
      : newProps.join(', ');
  }
  
  return () => {
    if (existing) {
      style.willChange = existing;
    } else {
      style.removeProperty('will-change');
    }
  };
}

/**
 * Promote for transform animations (most common)
 */
export function promoteTransform(element: HTMLElement): () => void {
  return promote(element, ['transform']);
}

/**
 * Promote for opacity animations
 */
export function promoteOpacity(element: HTMLElement): () => void {
  return promote(element, ['opacity']);
}

/**
 * Force synchronous layout (use sparingly)
 */
export function forceReflow(element: HTMLElement): void {
  // eslint-disable-next-line no-unused-expressions
  element.offsetHeight;
}

/**
 * Run callback after next paint (use for cleanup after animation)
 */
export function afterPaint(callback: () => void): void {
  schedule(() => {
    requestAnimationFrame(callback);
  }, 'low');
}

/**
 * Wait for next frame (Promise-based)
 */
export function nextFrame(): Promise<number> {
  return new Promise(resolve => {
    requestAnimationFrame(resolve);
  });
}

/**
 * Wait for specified number of frames
 */
export function waitFrames(count: number): Promise<void> {
  return new Promise(resolve => {
    let frames = 0;
    function tick() {
      frames++;
      if (frames >= count) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Check if we're currently in a RAF callback
 */
export function isInAnimationFrame(): boolean {
  return _processing;
}

/**
 * Get queue stats (for debugging)
 */
export function getQueueStats(): Record<Priority, number> {
  return {
    high: _queues.high.filter(t => !t.cancelled).length,
    normal: _queues.normal.filter(t => !t.cancelled).length,
    low: _queues.low.filter(t => !t.cancelled).length,
  };
}

/**
 * Clear all queues (for testing/reset)
 */
export function clearQueues(): void {
  Object.values(_queues).forEach(q => q.length = 0);
  _measureQueue.length = 0;
  _mutateQueue.length = 0;
  if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
    _isScheduled = false;
  }
}

function requestFrame(): void {
  if (_isScheduled) return;
  _isScheduled = true;
  _rafId = requestAnimationFrame(processFrame);
}

function processFrame(time: number): void {
  _rafId = null;
  _isScheduled = false;
  _processing = true;
  
  try {
    // Process measure queue (DOM reads)
    while (_measureQueue.length > 0) {
      const fn = _measureQueue.shift();
      if (fn) fn();
    }
    
    // Process mutate queue (DOM writes)
    while (_mutateQueue.length > 0) {
      const fn = _mutateQueue.shift();
      if (fn) fn();
    }
    
    // Process priority queues in order
    for (const priority of ['high', 'normal', 'low'] as Priority[]) {
      const queue = _queues[priority];
      let i = 0;
      while (i < queue.length) {
        const task = queue[i];
        if (task.cancelled) {
          queue.splice(i, 1);
        } else {
          task.callback(time);
          i++;
        }
      }
    }
  } finally {
    _processing = false;
    
    // Schedule next frame if queues not empty
    const hasWork = _measureQueue.length > 0 
      || _mutateQueue.length > 0
      || Object.values(_queues).some(q => q.some(t => !t.cancelled));
    
    if (hasWork) {
      requestFrame();
    }
  }
}

// ============================================================
// Higher-level animation helpers
// ============================================================

/**
 * Animate a numeric value over time
 */
export function animateValue(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  easing: (t: number) => number = t => t
): Promise<void> {
  const start = performance.now();
  
  return new Promise(resolve => {
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easing(progress);
      const value = from + (to - from) * eased;
      
      onUpdate(value);
      
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Spring animation (configurable)
 */
export function animateSpring(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  config: { stiffness?: number; damping?: number; mass?: number } = {}
): Promise<void> {
  const { stiffness = 150, damping = 15, mass = 1 } = config;
  let position = from;
  let velocity = 0;
  const target = to;
  const threshold = 0.01;
  
  return new Promise(resolve => {
    function tick() {
      const force = -stiffness * (position - target);
      const damper = -damping * velocity;
      const acceleration = (force + damper) / mass;
      
      velocity += acceleration * (1 / 60);
      position += velocity * (1 / 60);
      
      onUpdate(position);
      
      if (Math.abs(velocity) > threshold || Math.abs(position - target) > threshold) {
        requestAnimationFrame(tick);
      } else {
        onUpdate(target);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Throttle function with RAF alignment
 */
export function rafThrottle<T extends (...args: any[]) => void>(
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
 * Chain multiple animations sequentially
 */
export function sequence(...animations: (() => Promise<void>)[]): Promise<void> {
  return animations.reduce((promise, anim) => promise.then(anim), Promise.resolve());
}

/**
 * Run multiple animations in parallel
 */
export function parallel(...animations: (() => Promise<void>)[]): Promise<void> {
  return Promise.all(animations.map(a => a())).then(() => {});
}