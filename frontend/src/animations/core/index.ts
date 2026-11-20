// ============================================================
// NEXUSPLAY — Animation Core Exports
// ============================================================

// Easings
export { 
  easings, 
  durations, 
  perspectives, 
  staggers,
  type EasingName, 
  type DurationName,
  generateCSSVariables,
  getEasing,
  getDuration as getEasingDuration,
} from './easings';

// Reduced motion
export * from './reduced-motion';

// Engine
export { 
  schedule, 
  cancel, 
  measure, 
  mutate, 
  measureMutate,
  promote,
  promoteTransform,
  promoteOpacity,
  forceReflow,
  afterPaint,
  nextFrame,
  waitFrames,
  isInAnimationFrame,
  getQueueStats,
  clearQueues,
  animateValue,
  animateSpring,
  sequence,
  parallel,
  rafThrottle,
} from './engine';

// Performance
export { 
  markStart,
  markEnd,
  getDuration as getPerfDuration,
  measure as perfMeasure,
  measureAsync,
  startFPSMonitor,
  stopFPSMonitor,
  getCurrentFPS,
  isJanky,
  rafDebounce,
  isInViewport,
  getIntersectionRatio,
  isLowEndDevice,
  getAnimationQuality,
  applyQualitySettings,
} from './performance';