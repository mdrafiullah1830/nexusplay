// ============================================================
// NEXUSPLAY — Reduced Motion Detection & Opt-Out
// Central authority for all animation motion preferences
// ============================================================

let _prefersReduced: boolean | null = null;
let _mediaQuery: MediaQueryList | null = null;
const _listeners = new Set<() => void>();

/**
 * Check if user prefers reduced motion
 * Caches result, updates on media query change
 */
export function prefersReducedMotion(): boolean {
  if (_prefersReduced !== null) return _prefersReduced;
  
  if (typeof window === 'undefined') return false;
  
  _mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  _prefersReduced = _mediaQuery.matches;
  
  _mediaQuery.addEventListener('change', handleChange);
  
  return _prefersReduced;
}

function handleChange(e: MediaQueryListEvent): void {
  _prefersReduced = e.matches;
  _listeners.forEach(fn => fn());
}

/**
 * Subscribe to reduced-motion preference changes
 * Returns unsubscribe function
 */
export function onReducedMotionChange(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Force enable/disable animations (for testing or user toggle)
 * Overrides system preference
 */
let _forced: boolean | null = null;

export function setForcedReducedMotion(forced: boolean | null): void {
  _forced = forced;
  _listeners.forEach(fn => fn());
}

export function getForcedReducedMotion(): boolean | null {
  return _forced;
}

/**
 * Effective reduced motion check (respects forced override)
 */
export function effectiveReducedMotion(): boolean {
  if (_forced !== null) return _forced;
  return prefersReducedMotion();
}

/**
 * Guard function — returns early if reduced motion is active
 * Usage: if (guardReducedMotion()) return;
 */
export function guardReducedMotion(): boolean {
  return effectiveReducedMotion();
}

/**
 * CSS-in-JS helper for conditional styles
 * Returns empty object if reduced motion, otherwise returns styles
 */
export function motionSafe<T extends Record<string, unknown>>(
  styles: T,
  fallback: Partial<T> = {}
): T | Partial<T> {
  return effectiveReducedMotion() ? fallback : styles;
}

/**
 * Create a MediaQueryList for reduced motion (for external use)
 */
export function getReducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

/**
 * Check if IntersectionObserver is supported
 * Used to gate scroll-reveal animations
 */
export function supportsIntersectionObserver(): boolean {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window;
}

/**
 * Check if View Transitions API is supported
 */
export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * Check if device supports hover (for hover-based animations)
 */
export function supportsHover(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * Check if device supports touch
 */
export function supportsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}