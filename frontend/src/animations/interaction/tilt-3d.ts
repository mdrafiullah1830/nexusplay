// ============================================================
// NEXUSPLAY — 3D Tilt Interaction
// Unified tilt system for cards, tiles, buttons
// ============================================================

import { 
  mutate, 
  promoteTransform,
  rafThrottle 
} from '../core/engine';
import { effectiveReducedMotion, supportsHover } from '../core/reduced-motion';

interface TiltConfig {
  maxAngle: number;
  perspective: number;
  scale?: number;
  glow?: boolean;
  glowColor?: string;
  reverse?: boolean;
  onTilt?: (rx: number, ry: number) => void;
}

const DEFAULT_TILT_CONFIG: Required<TiltConfig> = {
  maxAngle: 8,
  perspective: 1100,
  scale: 1.02,
  glow: false,
  glowColor: 'rgba(142, 45, 226, 0.4)',
  reverse: false,
  onTilt: () => {},
};

interface TiltInstance {
  element: HTMLElement;
  config: Required<TiltConfig>;
  cleanup: () => void;
  rafId: number | null;
  isActive: boolean;
}

const _instances = new Map<HTMLElement, TiltInstance>();

/**
 * Initialize 3D tilt on an element
 */
export function initTilt3D(element: HTMLElement, config: Partial<TiltConfig> = {}): () => void {
  if (effectiveReducedMotion()) return () => {};
  if (!supportsHover()) return () => {};
  
  const existing = _instances.get(element);
  if (existing) {
    existing.cleanup();
  }
  
  const fullConfig: Required<TiltConfig> = { ...DEFAULT_TILT_CONFIG, ...config };
  const cleanupPromote = promoteTransform(element);
  
  let currentRx = 0;
  let currentRy = 0;
  let targetRx = 0;
  let targetRy = 0;
  let rafId: number | null = null;
  let isHovering = false;
  
  // Smooth animation loop
  function animate() {
    if (!isHovering && Math.abs(currentRx) < 0.1 && Math.abs(currentRy) < 0.1) {
      rafId = null;
      return;
    }
    
    // Spring interpolation
    currentRx += (targetRx - currentRx) * 0.15;
    currentRy += (targetRy - currentRy) * 0.15;
    
    // Apply transform
    mutate(() => {
      const multiplier = fullConfig.reverse ? -1 : 1;
      const rx = currentRx * multiplier;
      const ry = currentRy * multiplier;
      
      element.style.transform = `
        perspective(${fullConfig.perspective}px)
        rotateX(${rx.toFixed(2)}deg)
        rotateY(${ry.toFixed(2)}deg)
        scale3d(${fullConfig.scale}, ${fullConfig.scale}, ${fullConfig.scale})
      `;
      
      if (fullConfig.glow) {
        const intensity = Math.min((Math.abs(rx) + Math.abs(ry)) / (fullConfig.maxAngle * 2), 1);
        const glowSpread = 20 + intensity * 40;
        element.style.boxShadow = `
          0 ${12 + intensity * 20}px ${24 + intensity * 30}px -${14 + intensity * 10}px rgba(0, 0, 0, ${0.4 + intensity * 0.2}),
          0 0 ${glowSpread}px ${-4 + intensity * 8}px ${fullConfig.glowColor}
        `;
      }
    });
    
    fullConfig.onTilt(currentRx, currentRy);
    
    rafId = requestAnimationFrame(animate);
  }
  
  // Throttled mousemove handler
  const handleMove = rafThrottle((e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    
    targetRx = -deltaY * fullConfig.maxAngle;
    targetRy = deltaX * fullConfig.maxAngle;
    
    if (!rafId) {
      rafId = requestAnimationFrame(animate);
    }
  });
  
  // Mouse enter
  function handleEnter() {
    isHovering = true;
    element.style.transition = 'transform 0.1s cubic-bezier(0.2, 0.8, 0.3, 1), box-shadow 0.15s ease';
  }
  
  // Mouse leave
  function handleLeave() {
    isHovering = false;
    targetRx = 0;
    targetRy = 0;
    
    element.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1), box-shadow 0.4s ease';
    
    // Ensure animation runs to return to center
    if (!rafId) {
      rafId = requestAnimationFrame(animate);
    }
  }
  
  // Touch support (tap to tilt center)
  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (touch.clientX - centerX) / (rect.width / 2);
    const deltaY = (touch.clientY - centerY) / (rect.height / 2);
    
    targetRx = -deltaY * fullConfig.maxAngle * 0.5;
    targetRy = deltaX * fullConfig.maxAngle * 0.5;
    isHovering = true;
    
    if (!rafId) rafId = requestAnimationFrame(animate);
  }
  
  function handleTouchEnd() {
    isHovering = false;
    targetRx = 0;
    targetRy = 0;
    element.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1), box-shadow 0.4s ease';
    if (!rafId) rafId = requestAnimationFrame(animate);
  }
  
  // Attach listeners
  element.addEventListener('mousemove', handleMove);
  element.addEventListener('mouseenter', handleEnter);
  element.addEventListener('mouseleave', handleLeave);
  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd);
  
  // Cleanup function
  const cleanup = () => {
    element.removeEventListener('mousemove', handleMove);
    element.removeEventListener('mouseenter', handleEnter);
    element.removeEventListener('mouseleave', handleLeave);
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
    
    if (rafId) cancelAnimationFrame(rafId);
    cleanupPromote();
    element.style.removeProperty('transform');
    element.style.removeProperty('transition');
    element.style.removeProperty('box-shadow');
    _instances.delete(element);
  };
  
  _instances.set(element, {
    element,
    config: fullConfig,
    cleanup,
    rafId: null,
    isActive: true,
  });
  
  return cleanup;
}

/**
 * Initialize tilt on multiple elements (delegated for dynamic content)
 */
export function initTilt3DDelegated(
  container: Element,
  selector: string,
  config: Partial<TiltConfig> = {}
): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.matches(selector)) {
            initTilt3D(el, config);
          }
          el.querySelectorAll<HTMLElement>(selector).forEach(child => {
            initTilt3D(child, config);
          });
        }
      });
    }
  });
  
  observer.observe(container, { childList: true, subtree: true });
  
  // Init existing
  container.querySelectorAll<HTMLElement>(selector).forEach(el => {
    initTilt3D(el, config);
  });
  
  return () => observer.disconnect();
}

/**
 * Remove tilt from element
 */
export function removeTilt3D(element: HTMLElement): void {
  const instance = _instances.get(element);
  if (instance) {
    instance.cleanup();
  }
}

/**
 * Get tilt instance for element
 */
export function getTiltInstance(element: HTMLElement): TiltInstance | undefined {
  return _instances.get(element);
}

/**
 * Set tilt target programmatically (for testing/demo)
 */
export function setTiltTarget(element: HTMLElement, rx: number, ry: number): void {
  const instance = _instances.get(element);
  if (instance) {
    // Access private targetRx/targetRy via element
    (element as any)._tiltTargetRx = rx;
    (element as any)._tiltTargetRy = ry;
  }
}

// ============================================================
// Magnetic Cursor Attraction
// ============================================================

interface MagneticConfig {
  radius: number;
  strength: number;
  perspective?: number;
  onAttract?: (x: number, y: number) => void;
}

const DEFAULT_MAGNETIC_CONFIG: Required<MagneticConfig> = {
  radius: 40,
  strength: 0.3,
  perspective: 1100,
  onAttract: () => {},
};

const _magneticInstances = new Map<HTMLElement, { cleanup: () => void }>();

/**
 * Initialize magnetic attraction on element
 */
export function initMagnetic(element: HTMLElement, config: Partial<MagneticConfig> = {}): () => void {
  if (effectiveReducedMotion()) return () => {};
  if (!supportsHover()) return () => {};
  
  const existing = _magneticInstances.get(element);
  if (existing) existing.cleanup();
  
  const fullConfig = { ...DEFAULT_MAGNETIC_CONFIG, ...config };
  const cleanupPromote = promoteTransform(element);
  
  let rafId: number | null = null;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let isHovering = false;
  
  function animate() {
    if (!isHovering && Math.abs(currentX) < 0.1 && Math.abs(currentY) < 0.1) {
      rafId = null;
      return;
    }
    
    currentX += (targetX - currentX) * 0.2;
    currentY += (targetY - currentY) * 0.2;
    
    mutate(() => {
      element.style.transform = `
        perspective(${fullConfig.perspective}px)
        translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)
      `;
    });
    
    fullConfig.onAttract(currentX, currentY);
    rafId = requestAnimationFrame(animate);
  }
  
  function handleMove(e: MouseEvent) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance <= fullConfig.radius) {
      const force = (1 - distance / fullConfig.radius) * fullConfig.strength;
      targetX = deltaX * force;
      targetY = deltaY * force;
      isHovering = true;
      
      if (!rafId) rafId = requestAnimationFrame(animate);
    } else if (isHovering) {
      isHovering = false;
    }
  }
  
  function handleLeave() {
    isHovering = false;
    targetX = 0;
    targetY = 0;
    element.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1)';
    if (!rafId) rafId = requestAnimationFrame(animate);
  }
  
  element.addEventListener('mousemove', handleMove);
  element.addEventListener('mouseleave', handleLeave);
  
  const cleanup = () => {
    element.removeEventListener('mousemove', handleMove);
    element.removeEventListener('mouseleave', handleLeave);
    if (rafId) cancelAnimationFrame(rafId);
    cleanupPromote();
    element.style.removeProperty('transform');
    element.style.removeProperty('transition');
    _magneticInstances.delete(element);
  };
  
  _magneticInstances.set(element, { cleanup });
  return cleanup;
}

/**
 * Combined magnetic + 3D tilt
 */
export function initMagneticTilt(
  element: HTMLElement,
  tiltConfig: Partial<TiltConfig> = {},
  magneticConfig: Partial<MagneticConfig> = {}
): () => void {
  const tiltCleanup = initTilt3D(element, tiltConfig);
  const magneticCleanup = initMagnetic(element, magneticConfig);
  
  return () => {
    tiltCleanup();
    magneticCleanup();
  };
}

/**
 * Button press ripple effect
 */
export function initPressRipple(element: HTMLElement): () => void {
  if (effectiveReducedMotion()) return () => {};
  
  function handlePointerDown(e: PointerEvent) {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ripple = document.createElement('span');
    ripple.className = 'press-ripple';
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: press-ripple-anim 0.4s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    ripple.addEventListener('animationend', () => ripple.remove());
  }
  
  element.addEventListener('pointerdown', handlePointerDown);
  
  return () => {
    element.removeEventListener('pointerdown', handlePointerDown);
  };
}

/**
 * Initialize press ripple on multiple buttons
 */
export function initPressRippleDelegated(container: Element, selector: string = 'button, .btn'): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.matches(selector)) initPressRipple(el);
          el.querySelectorAll<HTMLElement>(selector).forEach(child => initPressRipple(child));
        }
      });
    }
  });
  
  observer.observe(container, { childList: true, subtree: true });
  container.querySelectorAll<HTMLElement>(selector).forEach(initPressRipple);
  
  return () => observer.disconnect();
}