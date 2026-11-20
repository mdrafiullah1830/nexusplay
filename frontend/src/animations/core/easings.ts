// ============================================================
// NEXUSPLAY — Custom Easing Curves
// Professional cubic-bezier values matching Apple/Nike/Stripe feel
// ============================================================

/**
 * Standard easings as CSS cubic-bezier strings
 * Use in CSS: var(--ease-out-expo) etc.
 * Use in JS: easings.outExpo
 */
export const easings = {
  // Expressive, heroic entrances (Apple/Nike style)
  outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  outExpoStrong: 'cubic-bezier(0.1, 1, 0.2, 1)',
  
  // Spring-like, lively (Framer/Linear feel)
  spring: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
  springGentle: 'cubic-bezier(0.25, 0.8, 0.4, 1)',
  springSharp: 'cubic-bezier(0.15, 0.85, 0.35, 1)',
  
  // Sharp, decisive (Stripe/Vercel)
  sharp: 'cubic-bezier(0.4, 0, 0.2, 1)',
  sharpEnter: 'cubic-bezier(0, 0, 0.2, 1)',
  sharpExit: 'cubic-bezier(0.4, 0, 1, 1)',
  
  // Standard material
  easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOutQuint: 'cubic-bezier(0.23, 1, 0.32, 1)',
  
  // Specialized
  bounceSubtle: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  elasticGentle: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  
  // Linear (for continuous motion)
  linear: 'linear',
} as const;

export type EasingName = keyof typeof easings;

/**
 * Duration tokens in milliseconds
 * Use in CSS: var(--dur-base) etc.
 */
export const durations = {
  instant: 80,
  fast: 150,
  base: 250,
  smooth: 400,
  heroic: 800,
  epic: 1200,
} as const;

export type DurationName = keyof typeof durations;

/**
 * Perspective depths for 3D transforms
 */
export const perspectives = {
  shallow: 600,
  medium: 1100,
  deep: 1500,
  hero: 2000,
} as const;

/**
 * Stagger delays
 */
export const staggers = {
  tight: 40,
  base: 60,
  relaxed: 80,
  heroic: 100,
} as const;

/**
 * Generate CSS custom properties object for :root
 */
export function generateCSSVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  
  // Easings
  Object.entries(easings).forEach(([key, value]) => {
    vars[`--ease-${kebabCase(key)}`] = value;
  });
  
  // Durations
  Object.entries(durations).forEach(([key, value]) => {
    vars[`--dur-${key}`] = `${value}ms`;
  });
  
  // Perspectives
  Object.entries(perspectives).forEach(([key, value]) => {
    vars[`--perspective-${key}`] = `${value}px`;
  });
  
  // Staggers
  Object.entries(staggers).forEach(([key, value]) => {
    vars[`--stagger-${key}`] = `${value}ms`;
  });
  
  return vars;
}

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Get easing by name (for JS usage)
 */
export function getEasing(name: EasingName): string {
  return easings[name];
}

/**
 * Get duration by name (for JS usage)
 */
export function getDuration(name: DurationName): number {
  return durations[name];
}