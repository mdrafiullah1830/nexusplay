// ============================================================
// NEXUSPLAY — Page Entrance Choreography
// Orchestrated entrance animations for each page
// ============================================================

import { schedule, measure, mutate, waitFrames } from '../core/engine';
import { effectiveReducedMotion } from '../core/reduced-motion';

interface EntranceTarget {
  selector: string;
  variant?: 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'reveal-3d-up' | 'reveal-3d-flip-y' | 'scale-in' | 'slide-right' | 'slide-left';
  delay?: number;
  stagger?: number;
  maxStagger?: number;
  container?: string; // Parent container for scoped selection
}

interface PageChoreography {
  targets: EntranceTarget[];
  onComplete?: () => void;
}

// Pre-defined choreographies for each page
export const pageChoreographies: Record<string, PageChoreography> = {
  home: {
    targets: [
      // Hero content (handled by hero slider)
      // Featured tiles
      { selector: '.featured-grid .tile', variant: 'reveal-3d-up', stagger: 70, maxStagger: 4 },
      // Trending cards
      { selector: '.trending-row .trend-card', variant: 'reveal-3d-flip-y', stagger: 60, maxStagger: 4 },
      // Bestsellers rail
      { selector: '#bestseller-rail .p-card', variant: 'slide-right', stagger: 50, maxStagger: 5, container: '#bestseller-rail' },
      // Savings rail
      { selector: '#new-rail .p-card', variant: 'slide-right', stagger: 50, maxStagger: 5, container: '#new-rail' },
      // Category tiles
      { selector: '.cat-row .cat-tile', variant: 'reveal-3d-flip-y', stagger: 50, maxStagger: 6 },
    ],
  },
  shop: {
    targets: [
      // Filter sidebar
      { selector: '.shop-sidebar .filter-group', variant: 'fade-right', stagger: 60, maxStagger: 5 },
      // Product grid
      { selector: '.p-grid .p-card', variant: 'reveal-3d-up', stagger: 50, maxStagger: 8 },
      // Pagination
      { selector: '.pagination .page-btn', variant: 'scale-in', stagger: 40, maxStagger: 5 },
    ],
  },
  product: {
    targets: [
      // Gallery
      { selector: '.pd-gallery .gallery-main', variant: 'reveal-3d-up', delay: 0 },
      { selector: '.pd-gallery .gallery-thumbs button', variant: 'scale-in', stagger: 40, maxStagger: 6 },
      // Info column
      { selector: '.pd-info .pd-badge', variant: 'fade-down', delay: 100 },
      { selector: '.pd-info .pd-title', variant: 'fade-up', delay: 200 },
      { selector: '.pd-info .pd-rating', variant: 'fade-up', delay: 260 },
      { selector: '.pd-info .pd-price', variant: 'fade-up', delay: 320 },
      { selector: '.pd-info .pd-colors', variant: 'fade-up', delay: 380 },
      { selector: '.pd-info .pd-quantity', variant: 'fade-up', delay: 440 },
      { selector: '.pd-info .pd-actions', variant: 'fade-up', delay: 500 },
      { selector: '.pd-info .pd-meta', variant: 'fade-up', delay: 560 },
      // Specs
      { selector: '.pd-specs .spec-row', variant: 'fade-left', stagger: 30, maxStagger: 8 },
      // Related rail
      { selector: '.related-rail .p-card', variant: 'slide-right', stagger: 50, maxStagger: 4 },
    ],
  },
  cart: {
    targets: [
      { selector: '.cart-layout .cart-items .cart-item', variant: 'slide-right', stagger: 60, maxStagger: 8 },
      { selector: '.cart-layout .cart-summary', variant: 'fade-left', delay: 200 },
    ],
  },
  checkout: {
    targets: [
      { selector: '.checkout-layout .checkout-steps', variant: 'fade-down', delay: 0 },
      { selector: '.checkout-layout .checkout-form .form-row', variant: 'fade-up', stagger: 50, maxStagger: 6 },
      { selector: '.checkout-layout .checkout-summary', variant: 'fade-left', delay: 200 },
    ],
  },
  track: {
    targets: [
      { selector: '.track-form', variant: 'fade-up', delay: 0 },
      { selector: '.track-result .timeline-step', variant: 'slide-right', stagger: 80, maxStagger: 6 },
    ],
  },
  admin: {
    targets: [
      { selector: '.admin-layout .stat-card', variant: 'scale-in', stagger: 60, maxStagger: 4 },
      { selector: '.admin-layout .data-table tbody tr', variant: 'fade-right', stagger: 30, maxStagger: 10 },
    ],
  },
};

/**
 * Run entrance choreography for a page
 */
export async function runEntranceChoreography(page: string): Promise<void> {
  if (effectiveReducedMotion()) return;
  
  const choreography = pageChoreographies[page];
  if (!choreography) return;
  
  // Wait one frame for layout to settle
  await waitFrames(1);
  
  const promises: Promise<void>[] = [];
  
  for (const target of choreography.targets) {
    promises.push(animateTargets(target));
  }
  
  await Promise.all(promises);
  choreography.onComplete?.();
}

/**
 * Animate a group of targets with stagger
 */
async function animateTargets(target: EntranceTarget): Promise<void> {
  const root = target.container 
    ? document.querySelector(target.container)
    : document;
  
  if (!root) return;
  
  const elements = Array.from(root.querySelectorAll<HTMLElement>(target.selector));
  if (elements.length === 0) return;
  
  const variant = target.variant ?? 'fade-up';
  const baseDelay = target.delay ?? 0;
  const stagger = target.stagger ?? 60;
  const maxStagger = target.maxStagger ?? 6;
  
  // Apply animation classes
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const delay = baseDelay + Math.min(i, maxStagger - 1) * stagger;
    
    schedule(() => {
      measure(() => {
        applyEntranceClass(el, variant);
        el.style.setProperty('--entrance-delay', `${delay}ms`);
      });
      
      mutate(() => {
        el.classList.add('animate-in');
      });
      
      // Cleanup
      const duration = getEntranceDuration(variant);
      setTimeout(() => {
        mutate(() => {
          el.style.removeProperty('--entrance-delay');
          el.classList.remove('animate-in');
        });
      }, delay + duration + 100);
      
    }, 'normal');
  }
}

/**
 * Apply entrance animation class based on variant
 */
function applyEntranceClass(el: HTMLElement, variant: string): void {
  // Remove existing entrance classes
  const entranceClasses = [
    'animate-fade-in-up', 'animate-fade-in-down', 'animate-fade-in-left', 'animate-fade-in-right',
    'animate-reveal-3d-up', 'animate-reveal-3d-down', 'animate-reveal-3d-flip-y', 'animate-reveal-3d-flip-x',
    'animate-scale-in', 'animate-scale-in-spring',
    'animate-slide-in-right', 'animate-slide-in-left',
  ];
  el.classList.remove(...entranceClasses);
  
  // Add new variant class
  const classMap: Record<string, string> = {
    'fade-up': 'animate-fade-in-up',
    'fade-down': 'animate-fade-in-down',
    'fade-left': 'animate-fade-in-left',
    'fade-right': 'animate-fade-in-right',
    'reveal-3d-up': 'animate-reveal-3d-up',
    'reveal-3d-down': 'animate-reveal-3d-down',
    'reveal-3d-flip-y': 'animate-reveal-3d-flip-y',
    'reveal-3d-flip-x': 'animate-reveal-3d-flip-x',
    'scale-in': 'animate-scale-in',
    'slide-right': 'animate-slide-in-right',
    'slide-left': 'animate-slide-in-left',
  };
  
  const className = classMap[variant];
  if (className) {
    el.classList.add(className);
  }
}

/**
 * Get entrance duration for variant
 */
function getEntranceDuration(variant: string): number {
  const durations: Record<string, number> = {
    'fade-up': 500,
    'fade-down': 500,
    'fade-left': 500,
    'fade-right': 500,
    'reveal-3d-up': 800,
    'reveal-3d-down': 800,
    'reveal-3d-flip-y': 800,
    'reveal-3d-flip-x': 800,
    'scale-in': 300,
    'slide-right': 500,
    'slide-left': 500,
  };
  return durations[variant] ?? 500;
}

/**
 * Stagger utility for manual use
 */
export function getStaggerDelay(index: number, baseStagger = 60, maxStagger = 6): number {
  return Math.min(index, maxStagger - 1) * baseStagger;
}

/**
 * Apply stagger delays to a NodeList
 */
export function applyStaggerDelays(
  elements: NodeListOf<HTMLElement> | HTMLElement[],
  baseDelay = 0,
  stagger = 60,
  maxStagger = 6
): void {
  Array.from(elements).forEach((el, i) => {
    const delay = baseDelay + Math.min(i, maxStagger - 1) * stagger;
    el.style.setProperty('--reveal-delay', `${delay}ms`);
  });
}

/**
 * Clear stagger delays
 */
export function clearStaggerDelays(elements: NodeListOf<HTMLElement> | HTMLElement[]): void {
  Array.from(elements).forEach(el => {
    el.style.removeProperty('--reveal-delay');
    el.style.removeProperty('--entrance-delay');
  });
}