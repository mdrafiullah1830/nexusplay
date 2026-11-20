// ============================================================
// NEXUSPLAY — View Transitions for MPA
// Seamless page transitions using View Transitions API
// ============================================================

import { supportsViewTransitions, effectiveReducedMotion } from '../core/reduced-motion';

interface TransitionConfig {
  // Selectors for shared elements
  sharedElements?: Record<string, string>; // view-transition-name -> selector
  // Custom transition name for root
  rootName?: string;
  // Skip transition for certain paths
  skipPaths?: string[];
  // Callback when transition starts
  onStart?: () => void;
  // Callback when transition finishes
  onFinish?: () => void;
}

const DEFAULT_CONFIG: Required<TransitionConfig> = {
  sharedElements: {},
  rootName: 'page',
  skipPaths: ['/admin', '/checkout'],
  onStart: () => {},
  onFinish: () => {},
};

let _initialized = false;
let _config: Required<TransitionConfig> = DEFAULT_CONFIG;
let _pendingTransition: Promise<void> | null = null;

/**
 * Initialize view transitions for MPA navigation
 */
export function initViewTransitions(config: TransitionConfig = {}): void {
  if (_initialized) return;
  if (!supportsViewTransitions()) return;
  if (effectiveReducedMotion()) return;
  
  _config = { ...DEFAULT_CONFIG, ...config };
  
  // Intercept navigation
  document.addEventListener('click', handleNavigation, true);
  
  // Handle browser back/forward
  window.addEventListener('pageshow', handlePageShow);
  
  _initialized = true;
}

/**
 * Handle link clicks for view transitions
 */
async function handleNavigation(event: MouseEvent): Promise<void> {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!link) return;
  
  const href = link.getAttribute('href');
  if (!href) return;
  
  // Skip external links, anchors, new tabs, downloads
  if (
    href.startsWith('http') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#') ||
    link.target === '_blank' ||
    link.hasAttribute('download')
  ) {
    return;
  }
  
  // Skip configured paths
  const url = new URL(href, window.location.origin);
  if (_config.skipPaths.some(p => url.pathname.startsWith(p))) return;
  
  event.preventDefault();
  
  await performTransition(href);
}

/**
 * Perform the view transition
 */
async function performTransition(url: string): Promise<void> {
  if (_pendingTransition) {
    await _pendingTransition;
  }
  
  _pendingTransition = (async () => {
    _config.onStart();
    
    // Capture shared elements before navigation
    const sharedStyles = captureSharedElements();
    
    // Apply view-transition-name to shared elements
    applySharedElementNames();
    
    // Set root transition name
    document.documentElement.style.viewTransitionName = _config.rootName;
    
    try {
      // Start view transition
      const transition = document.startViewTransition(async () => {
        // Navigate
        window.location.href = url;
      });
      
      // Wait for transition to complete
      await transition.finished;
      
    } catch (error) {
      // Fallback: direct navigation
      window.location.href = url;
    } finally {
      // Cleanup
      cleanupSharedElements(sharedStyles);
      document.documentElement.style.removeProperty('view-transition-name');
      _config.onFinish();
    }
  })();
  
  await _pendingTransition;
  _pendingTransition = null;
}

/**
 * Capture current shared element styles for restoration
 */
function captureSharedElements(): Map<HTMLElement, string> {
  const styles = new Map<HTMLElement, string>();
  
  for (const [name, selector] of Object.entries(_config.sharedElements)) {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach(el => {
      styles.set(el, el.style.viewTransitionName || '');
      el.style.viewTransitionName = name;
    });
  }
  
  return styles;
}

/**
 * Apply view-transition-name to shared elements
 */
function applySharedElementNames(): void {
  for (const [name, selector] of Object.entries(_config.sharedElements)) {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach(el => {
      el.style.viewTransitionName = name;
    });
  }
}

/**
 * Restore shared element styles
 */
function cleanupSharedElements(styles: Map<HTMLElement, string>): void {
  styles.forEach((original, el) => {
    if (original) {
      el.style.viewTransitionName = original;
    } else {
      el.style.removeProperty('view-transition-name');
    }
  });
}

/**
 * Handle page show (back/forward navigation)
 */
function handlePageShow(event: PageTransitionEvent): void {
  if (event.persisted) {
    // Page restored from bfcache - re-apply shared element names
    applySharedElementNames();
  }
}

/**
 * Register a shared element for transitions
 * Call this when rendering elements that should transition between pages
 */
export function registerSharedElement(name: string, selector: string): void {
  _config.sharedElements[name] = selector;
  
  // Apply immediately if on current page
  if (_initialized) {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach(el => {
      el.style.viewTransitionName = name;
    });
  }
}

/**
 * Unregister a shared element
 */
export function unregisterSharedElement(name: string): void {
  delete _config.sharedElements[name];
}

/**
 * Skip transitions for a path pattern
 */
export function addSkipPath(path: string): void {
  if (!_config.skipPaths.includes(path)) {
    _config.skipPaths.push(path);
  }
}

/**
 * Check if view transitions are active
 */
export function isViewTransitionActive(): boolean {
  return _pendingTransition !== null;
}

/**
 * Get current config
 */
export function getTransitionConfig(): Required<TransitionConfig> {
  return { ..._config };
}

/**
 * Destroy view transitions
 */
export function destroyViewTransitions(): void {
  document.removeEventListener('click', handleNavigation, true);
  window.removeEventListener('pageshow', handlePageShow);
  cleanupSharedElements(new Map());
  document.documentElement.style.removeProperty('view-transition-name');
  _initialized = false;
}

/**
 * Shared element helpers for common patterns
 */
export const sharedElements = {
  // Product image on product page -> product card on shop
  productImage: (productId: string) => `product-image-${productId}`,
  
  // Category tile -> shop page header
  categoryTile: (category: string) => `category-${category}`,
  
  // Cart icon -> cart page
  cartIcon: 'cart-icon',
  
  // User avatar -> profile/account
  userAvatar: 'user-avatar',
  
  // Logo (home link)
  logo: 'site-logo',
};

/**
 * Auto-register shared elements from data attributes
 * Usage: <img data-shared-element="product-image-123" ...>
 */
export function autoRegisterSharedElements(): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-shared-element]');
  elements.forEach(el => {
    const name = el.getAttribute('data-shared-element');
    if (name) {
      el.style.viewTransitionName = name;
      _config.sharedElements[name] = `[data-shared-element="${name}"]`;
    }
  });
}

/**
 * CSS-in-JS helper for defining transition styles
 */
export function createTransitionStyles(): string {
  if (!supportsViewTransitions()) return '';
  
  return `
    @keyframes vt-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes vt-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes vt-slide-in-right {
      from { transform: translateX(30px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }
    
    @keyframes vt-slide-out-left {
      from { transform: none; opacity: 1; }
      to { transform: translateX(-30px); opacity: 0; }
    }
    
    ::view-transition-old(${_config.rootName}) {
      animation: vt-fade-out var(--dur-smooth) var(--ease-spring),
                 vt-slide-out-left var(--dur-smooth) var(--ease-spring);
    }
    
    ::view-transition-new(${_config.rootName}) {
      animation: vt-fade-in var(--dur-smooth) var(--ease-spring),
                 vt-slide-in-right var(--dur-smooth) var(--ease-spring);
    }
    
    /* Shared element transitions */
    ::view-transition-group(*) {
      animation-duration: var(--dur-smooth);
      animation-timing-function: var(--ease-spring);
    }
    
    ::view-transition-image-pair(*) {
      animation-duration: var(--dur-smooth);
      animation-timing-function: var(--ease-spring);
    }
  `;
}