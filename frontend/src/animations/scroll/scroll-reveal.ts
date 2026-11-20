// ============================================================
// NEXUSPLAY — Enhanced Scroll Reveal System
// IntersectionObserver with variants, stagger, and MutationObserver
// ============================================================

import { 
  effectiveReducedMotion, 
  supportsIntersectionObserver,
  onReducedMotionChange 
} from '../core/reduced-motion';
import { schedule, measure, mutate } from '../core/engine';

interface RevealConfig {
  selector: string;
  rootMargin?: string;
  threshold?: number | number[];
  variant?: 'default' | 'section' | 'card' | 'text' | 'cta' | 'stat';
  stagger?: number;
  maxStagger?: number;
  once?: boolean;
}

const DEFAULT_CONFIG: Required<RevealConfig> = {
  selector: '.reveal',
  rootMargin: '0px 0px -8% 0px',
  threshold: 0,
  variant: 'default',
  stagger: 60,
  maxStagger: 6,
  once: true,
};

const VARIANT_CLASSES = {
  default: 'reveal',
  section: 'reveal reveal--section',
  card: 'reveal reveal--card',
  text: 'reveal reveal--text',
  cta: 'reveal reveal--cta',
  stat: 'reveal reveal--stat',
} as const;

let _observer: IntersectionObserver | null = null;
let _mutationObserver: MutationObserver | null = null;
let _configs: RevealConfig[] = [];
let _initialized = false;

/**
 * Initialize the scroll reveal system
 * Call once on app startup
 */
export function initScrollReveal(configs: RevealConfig[] = []): void {
  if (_initialized) return;
  
  // Hard opt-outs
  if (effectiveReducedMotion() || !supportsIntersectionObserver()) {
    // Still need to observe for dynamic content to add is-inview immediately
    _configs = configs.length > 0 ? configs : [DEFAULT_CONFIG];
    initMutationObserver();
    return;
  }
  
  document.documentElement.classList.add('has-anim');
  _configs = configs.length > 0 ? configs : [DEFAULT_CONFIG];
  
  createObserver();
  observeStaticContent();
  initMutationObserver();
  
  // Listen for reduced motion changes
  onReducedMotionChange(() => {
    if (effectiveReducedMotion()) {
      destroy();
      document.documentElement.classList.remove('has-anim');
      // Show all content immediately
      document.querySelectorAll<HTMLElement>('.reveal').forEach(el => {
        el.classList.add('is-inview');
        el.style.removeProperty('--reveal-delay');
      });
    } else {
      document.documentElement.classList.add('has-anim');
      createObserver();
      observeStaticContent();
    }
  });
  
  _initialized = true;
}

/**
 * Create the IntersectionObserver
 */
function createObserver(): void {
  if (_observer) _observer.disconnect();
  
  _observer = new IntersectionObserver(handleIntersection, {
    rootMargin: _configs[0]?.rootMargin ?? DEFAULT_CONFIG.rootMargin,
    threshold: _configs[0]?.threshold ?? DEFAULT_CONFIG.threshold,
  });
}

/**
 * Handle intersection entries
 */
function handleIntersection(entries: IntersectionObserverEntry[]): void {
  if (!_observer) return;
  
  let batch = 0;
  
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    
    const el = entry.target as HTMLElement;
    if (el.classList.contains('is-inview')) continue;
    
    // Find matching config for this element
    const config = findConfig(el);
    if (!config) continue;
    
    _observer?.unobserve(el);
    
    // Stagger delay
    const delay = Math.min(batch, (config.maxStagger ?? DEFAULT_CONFIG.maxStagger) - 1) * (config.stagger ?? DEFAULT_CONFIG.stagger);
    batch++;
    
    // Apply variant class if not already present
    const variantClass = VARIANT_CLASSES[config.variant ?? 'default'];
    if (!el.classList.contains(variantClass.replace('reveal ', ''))) {
      el.classList.add(...variantClass.split(' ').filter(c => c !== 'reveal'));
    }
    
    // Schedule reveal with delay
    schedule(() => {
      measure(() => {
        el.style.setProperty('--reveal-delay', `${delay}ms`);
      });
      
      mutate(() => {
        el.classList.add('is-inview');
      });
      
      // Clean up delay after animation
      const revealDuration = getRevealDuration(config.variant ?? 'default');
      setTimeout(() => {
        mutate(() => {
          el.style.removeProperty('--reveal-delay');
        });
      }, delay + revealDuration + 100);
      
    }, 'normal');
  }
}

/**
 * Find matching config for element
 */
function findConfig(el: HTMLElement): RevealConfig | null {
  for (const config of _configs) {
    try {
      if (el.matches(config.selector)) return config;
    } catch {
      // Invalid selector, skip
    }
  }
  return null;
}

/**
 * Get reveal duration for variant
 */
function getRevealDuration(variant: string): number {
  const durations: Record<string, number> = {
    default: 650,
    section: 800,
    card: 650,
    text: 400,
    cta: 500,
    stat: 800,
  };
  return durations[variant] ?? 650;
}

/**
 * Observe all static content matching configs
 */
function observeStaticContent(): void {
  if (!_observer) return;
  
  for (const config of _configs) {
    try {
      document.querySelectorAll(config.selector).forEach(el => {
        if (!el.classList.contains('is-inview')) {
          _observer!.observe(el);
        }
      });
    } catch {
      // Invalid selector, skip
    }
  }
}

/**
 * Initialize MutationObserver for dynamic content
 */
function initMutationObserver(): void {
  _mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          observeNode(node as Element);
        }
      });
    }
  });
  
  _mutationObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Observe a newly added node and its children
 */
function observeNode(node: Element): void {
  if (!_observer && effectiveReducedMotion()) {
    // Reduced motion: just show immediately
    node.querySelectorAll('.reveal').forEach(el => {
      (el as HTMLElement).classList.add('is-inview');
      (el as HTMLElement).style.removeProperty('--reveal-delay');
    });
    if (node.matches('.reveal')) {
      (node as HTMLElement).classList.add('is-inview');
      (node as HTMLElement).style.removeProperty('--reveal-delay');
    }
    return;
  }
  
  if (!_observer) return;
  
  // Check the node itself
  for (const config of _configs) {
    try {
      if (node.matches(config.selector) && !node.classList.contains('is-inview')) {
        _observer?.observe(node);
      }
    } catch {
      // Invalid selector
    }
  }
  
  // Check children
  if (_observer) {
    for (const config of _configs) {
      try {
        node.querySelectorAll(config.selector).forEach(el => {
          if (!el.classList.contains('is-inview')) {
            _observer?.observe(el);
          }
        });
      } catch {
        // Invalid selector
      }
    }
  }
}

/**
 * Manually trigger reveal for an element (bypass observer)
 */
export function revealNow(element: HTMLElement, variant: RevealConfig['variant'] = 'default'): void {
  const variantClass = VARIANT_CLASSES[variant];
  if (!element.classList.contains(variantClass.replace('reveal ', ''))) {
    element.classList.add(...variantClass.split(' ').filter(c => c !== 'reveal'));
  }
  
  element.classList.add('is-inview');
  element.style.removeProperty('--reveal-delay');
}

/**
 * Reset element to hidden state (for re-animation)
 */
export function resetReveal(element: HTMLElement): void {
  element.classList.remove('is-inview');
  element.style.removeProperty('--reveal-delay');
  
  if (_observer && !effectiveReducedMotion()) {
    _observer.observe(element);
  }
}

/**
 * Destroy observers (cleanup)
 */
export function destroy(): void {
  _observer?.disconnect();
  _observer = null;
  _mutationObserver?.disconnect();
  _mutationObserver = null;
  _initialized = false;
}

/**
 * Get observer instance (for testing)
 */
export function getObserver(): IntersectionObserver | null {
  return _observer;
}

/**
 * Check if initialized
 */
export function isInitialized(): boolean {
  return _initialized;
}