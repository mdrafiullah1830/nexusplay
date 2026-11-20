// ============================================================
// NEXUSPLAY — Feedback Animations
// Toasts, counters, confetti, loading states
// ============================================================

import { mutate, animateValue } from '../core/engine';
import { effectiveReducedMotion } from '../core/reduced-motion';

// ============================================================
// 3D Toast System
// ============================================================

interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  action?: { label: string; onClick: () => void };
  persistent?: boolean;
}

interface Toast {
  id: string;
  message: string;
  options: Required<ToastOptions>;
  element: HTMLElement;
  timeoutId: number | null;
}

const _toasts = new Map<string, Toast>();
let _toastContainer: HTMLElement | null = null;
let _toastId = 0;

const TOAST_DEFAULTS: Required<ToastOptions> = {
  type: 'info',
  duration: 4000,
  position: 'top-right',
  action: { label: '', onClick: () => {} },
  persistent: false,
};

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TOAST_COLORS = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

/**
 * Initialize toast container
 */
function ensureContainer(): HTMLElement {
  if (_toastContainer) return _toastContainer;
  
  _toastContainer = document.createElement('div');
  _toastContainer.id = 'toast-container';
  _toastContainer.style.cssText = `
    position: fixed;
    z-index: var(--z-toast);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
  `;
  
  // Position
  const positions = {
    'top-right': { top: '0', right: '0', alignItems: 'flex-end' },
    'top-left': { top: '0', left: '0', alignItems: 'flex-start' },
    'bottom-right': { bottom: '0', right: '0', alignItems: 'flex-end' },
    'bottom-left': { bottom: '0', left: '0', alignItems: 'flex-start' },
    'top-center': { top: '0', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
    'bottom-center': { bottom: '0', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  };
  
  Object.assign(_toastContainer.style, positions['top-right']);
  
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

/**
 * Show a toast notification
 */
export function showToast(message: string, options: ToastOptions = {}): string {
  if (effectiveReducedMotion()) {
    // Fallback: simple alert
    alert(message);
    return '';
  }
  
  const container = ensureContainer();
  const id = `toast-${++_toastId}-${Date.now()}`;
  const opts = { ...TOAST_DEFAULTS, ...options };
  
  // Update container position
  const positions = {
    'top-right': { top: '16px', right: '16px', bottom: 'auto', left: 'auto', alignItems: 'flex-end' },
    'top-left': { top: '16px', left: '16px', bottom: 'auto', right: 'auto', alignItems: 'flex-start' },
    'bottom-right': { bottom: '16px', right: '16px', top: 'auto', left: 'auto', alignItems: 'flex-end' },
    'bottom-left': { bottom: '16px', left: '16px', top: 'auto', right: 'auto', alignItems: 'flex-start' },
    'top-center': { top: '16px', left: '50%', bottom: 'auto', right: 'auto', transform: 'translateX(-50%)', alignItems: 'center' },
    'bottom-center': { bottom: '16px', left: '50%', top: 'auto', right: 'auto', transform: 'translateX(-50%)', alignItems: 'center' },
  };
  Object.assign(container.style, positions[opts.position]);
  
  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.id = id;
  toastEl.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: var(--card-bg, #1a1a1a);
    border: 1px solid var(--border, #333);
    border-radius: 12px;
    box-shadow: 
      0 8px 24px -8px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    color: var(--text, #fff);
    font-size: 14px;
    font-weight: 500;
    min-width: 280px;
    max-width: 420px;
    pointer-events: auto;
    transform: perspective(800px) rotateX(-10deg) translateY(-20px) scale(0.95);
    opacity: 0;
    transition: 
      transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1),
      opacity 0.3s ease;
    will-change: transform, opacity;
    backdrop-filter: blur(12px);
  `;
  
  const color = TOAST_COLORS[opts.type];
  const icon = TOAST_ICONS[opts.type];
  
  toastEl.innerHTML = `
    <span style="
      width: 24px; height: 24px;
      border-radius: 50%;
      background: ${color}20;
      color: ${color};
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: bold;
      flex-shrink: 0;
    ">${icon}</span>
    <span style="flex: 1;">${message}</span>
    ${opts.action.label ? `
      <button style="
        padding: 6px 12px;
        background: ${color};
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      ">${opts.action.label}</button>
    ` : ''}
    <button style="
      width: 20px; height: 20px;
      border: none;
      background: transparent;
      color: var(--text-muted, #888);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      border-radius: 4px;
      transition: background 0.2s, color 0.2s;
    " aria-label="Dismiss">✕</button>
  `;
  
  // Animate in
  container.appendChild(toastEl);
  
  // Force reflow then animate
  requestAnimationFrame(() => {
    mutate(() => {
      toastEl.style.transform = 'perspective(800px) rotateX(0) translateY(0) scale(1)';
      toastEl.style.opacity = '1';
    });
  });
  
  // Action button
  if (opts.action.label) {
    const actionBtn = toastEl.querySelector('button') as HTMLButtonElement;
    actionBtn.addEventListener('click', () => {
      opts.action.onClick();
      if (!opts.persistent) dismissToast(id);
    });
  }
  
  // Dismiss button
  const dismissBtn = toastEl.querySelector('button:last-child') as HTMLButtonElement;
  dismissBtn.addEventListener('click', () => dismissToast(id));
  
  // Auto-dismiss
  let timeoutId: number | null = null;
  if (!opts.persistent && opts.duration > 0) {
    timeoutId = window.setTimeout(() => dismissToast(id), opts.duration);
  }
  
  // Pause on hover
  toastEl.addEventListener('mouseenter', () => {
    if (timeoutId) clearTimeout(timeoutId);
  });
  
  toastEl.addEventListener('mouseleave', () => {
    if (!opts.persistent && opts.duration > 0) {
      timeoutId = window.setTimeout(() => dismissToast(id), opts.duration);
    }
  });
  
  _toasts.set(id, { id, message, options: opts, element: toastEl, timeoutId });
  
  return id;
}

/**
 * Dismiss a toast
 */
export function dismissToast(id: string): void {
  const toast = _toasts.get(id);
  if (!toast) return;
  
  if (toast.timeoutId) clearTimeout(toast.timeoutId);
  
  mutate(() => {
    toast.element.style.transform = 'perspective(800px) rotateX(10deg) translateY(-20px) scale(0.95)';
    toast.element.style.opacity = '0';
  });
  
  setTimeout(() => {
    toast.element.remove();
    _toasts.delete(id);
  }, 400);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts(): void {
  _toasts.forEach((_, id) => dismissToast(id));
}

// Convenience methods
export const toast = {
  success: (msg: string, opts?: ToastOptions) => showToast(msg, { ...opts, type: 'success' }),
  error: (msg: string, opts?: ToastOptions) => showToast(msg, { ...opts, type: 'error' }),
  warning: (msg: string, opts?: ToastOptions) => showToast(msg, { ...opts, type: 'warning' }),
  info: (msg: string, opts?: ToastOptions) => showToast(msg, { ...opts, type: 'info' }),
};

// ============================================================
// Counter Animation
// ============================================================

interface CounterOptions {
  duration?: number;
  easing?: (t: number) => number;
  format?: (value: number) => string;
  onComplete?: () => void;
}

const COUNTER_DEFAULTS: Required<CounterOptions> = {
  duration: 1500,
  easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
  format: (v) => Math.round(v).toLocaleString(),
  onComplete: () => {},
};

/**
 * Animate a number counter
 */
export function animateCounter(
  element: HTMLElement,
  from: number,
  to: number,
  options: CounterOptions = {}
): Promise<void> {
  if (effectiveReducedMotion()) {
    element.textContent = COUNTER_DEFAULTS.format(to);
    return Promise.resolve();
  }
  
  const opts = { ...COUNTER_DEFAULTS, ...options };
  
  return animateValue(from, to, opts.duration, (value) => {
    mutate(() => {
      element.textContent = opts.format(value);
    });
  }, opts.easing).then(opts.onComplete);
}

/**
 * Animate multiple counters with stagger
 */
export async function animateCounters(
  counters: Array<{ element: HTMLElement; from: number; to: number; options?: CounterOptions }>,
  stagger = 100
): Promise<void> {
  const promises = counters.map(({ element, from, to, options }, i) => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        animateCounter(element, from, to, options).then(resolve);
      }, i * stagger);
    });
  });
  
  await Promise.all(promises);
}

// ============================================================
// Confetti Celebration
// ============================================================

interface ConfettiOptions {
  count?: number;
  colors?: string[];
  duration?: number;
  gravity?: number;
  spread?: number;
  origin?: { x: number; y: number };
}

const CONFETTI_DEFAULTS: Required<ConfettiOptions> = {
  count: 50,
  colors: ['#8e2de2', '#4a00e0', '#00d4ff', '#ff6b6b', '#ffd93d', '#6bcb77'],
  duration: 3000,
  gravity: 0.5,
  spread: 60,
  origin: { x: 0.5, y: 0.5 },
};

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  shape: 'square' | 'circle' | 'triangle';
  opacity: number;
}

/**
 * Fire confetti celebration
 */
export function fireConfetti(options: ConfettiOptions = {}): Promise<void> {
  if (effectiveReducedMotion()) return Promise.resolve();
  
  const opts = { ...CONFETTI_DEFAULTS, ...options };
  const canvas = createConfettiCanvas();
  const ctx = canvas.getContext('2d')!;
  const particles: ConfettiParticle[] = [];
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width * opts.origin.x;
  const centerY = rect.height * opts.origin.y;
  
  // Create particles
  for (let i = 0; i < opts.count; i++) {
    const angle = (Math.random() - 0.5) * opts.spread * (Math.PI / 180);
    const speed = 5 + Math.random() * 10;
    const color = opts.colors[Math.floor(Math.random() * opts.colors.length)];
    const shapes: ConfettiParticle['shape'][] = ['square', 'circle', 'triangle'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed - 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 8,
      color,
      shape,
      opacity: 1,
    });
  }
  
  let startTime = performance.now();
  let rafId: number | null = null;
  
  return new Promise(resolve => {
    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = elapsed / opts.duration;
      
      if (progress >= 1) {
        cleanup();
        resolve();
        return;
      }
      
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      for (const p of particles) {
        p.vy += opts.gravity * 0.1;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = 1 - progress;
        
        if (p.opacity <= 0) continue;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        
        const halfSize = p.size / 2;
        
        switch (p.shape) {
          case 'square':
            ctx.fillRect(-halfSize, -halfSize, p.size, p.size);
            break;
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -halfSize);
            ctx.lineTo(halfSize, halfSize);
            ctx.lineTo(-halfSize, halfSize);
            ctx.closePath();
            ctx.fill();
            break;
        }
        
        ctx.restore();
      }
      
      rafId = requestAnimationFrame(animate);
    }
    
    function cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      canvas.remove();
    }
    
    rafId = requestAnimationFrame(animate);
  });
}

function createConfettiCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: var(--z-toast, 9999);
  `;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  
  // Handle resize
  const handleResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', handleResize);
  
  // Store cleanup
  (canvas as any)._cleanup = () => {
    window.removeEventListener('resize', handleResize);
  };
  
  return canvas;
}

// ============================================================
// Typewriter Effect
// ============================================================

interface TypewriterOptions {
  speed?: number; // ms per character
  cursor?: string;
  onComplete?: () => void;
}

const TYPEWRITER_DEFAULTS: Required<TypewriterOptions> = {
  speed: 30,
  cursor: '|',
  onComplete: () => {},
};

/**
 * Typewriter animation for text
 */
export function typewriter(
  element: HTMLElement,
  text: string,
  options: TypewriterOptions = {}
): Promise<void> {
  if (effectiveReducedMotion()) {
    element.textContent = text;
    return Promise.resolve();
  }
  
  const opts = { ...TYPEWRITER_DEFAULTS, ...options };
  let index = 0;
  
  return new Promise(resolve => {
    function type() {
      if (index <= text.length) {
        element.textContent = text.slice(0, index) + opts.cursor;
        index++;
        setTimeout(type, opts.speed + Math.random() * 50);
      } else {
        element.textContent = text;
        opts.onComplete();
        resolve();
      }
    }
    type();
  });
}

// ============================================================
// Loading Spinner (3D)
// ============================================================

/**
 * Create a 3D loading spinner element
 */
export function createSpinner3D(size = 40, color = 'var(--accent, #8e2de2)'): HTMLElement {
  const spinner = document.createElement('div');
  spinner.className = 'spinner-3d';
  spinner.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    position: relative;
    transform-style: preserve-3d;
    animation: spinner-3d-rotate 1.2s linear infinite;
  `;
  
  // Add rings
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      width: ${size}px; height: ${size}px;
      margin: -${size/2}px 0 0 -${size/2}px;
      border: 3px solid transparent;
      border-top-color: ${color};
      border-radius: 50%;
      transform-origin: center;
      transform: rotateX(${i * 45}deg) rotateY(${i * 30}deg);
      animation: spinner-ring-pulse 1.5s ease-in-out infinite;
      animation-delay: ${i * 0.15}s;
    `;
    spinner.appendChild(ring);
  }
  
  // Add keyframes if not present
  if (!document.getElementById('spinner-3d-styles')) {
    const style = document.createElement('style');
    style.id = 'spinner-3d-styles';
    style.textContent = `
      @keyframes spinner-3d-rotate {
        from { transform: rotateX(0) rotateY(0) rotateZ(0); }
        to { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
      }
      @keyframes spinner-ring-pulse {
        0%, 100% { opacity: 0.3; transform: rotateX(var(--rx, 0)) rotateY(var(--ry, 0)) scale(1); }
        50% { opacity: 1; transform: rotateX(var(--rx, 0)) rotateY(var(--ry, 0)) scale(1.1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  return spinner;
}

// ============================================================
// Skeleton Shimmer (Enhanced)
// ============================================================

/**
 * Create enhanced skeleton loader
 */
export function createSkeleton(type: 'card' | 'text' | 'circle' | 'rect', options: { width?: string; height?: string } = {}): HTMLElement {
  const skeleton = document.createElement('div');
  skeleton.className = `p-skeleton p-skeleton--${type}`;
  skeleton.style.cssText = `
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.03) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.03) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s linear infinite;
    border-radius: 8px;
    ${options.width ? `width: ${options.width};` : ''}
    ${options.height ? `height: ${options.height};` : ''}
  `;
  
  if (type === 'circle') {
    skeleton.style.borderRadius = '50%';
  }
  
  return skeleton;
}

/**
 * Create skeleton card matching product card structure
 */
export function createProductSkeleton(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'p-card p-skeleton-card';
  card.style.cssText = `
    background: var(--card-bg, #1a1a1a);
    border: 1px solid var(--border, #333);
    border-radius: 16px;
    overflow: hidden;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;
  
  card.innerHTML = `
    <div class="p-skeleton p-skeleton--rect" style="width: 100%; height: 180px; border-radius: 8px;"></div>
    <div class="p-skeleton p-skeleton--text" style="width: 70%; height: 20px;"></div>
    <div class="p-skeleton p-skeleton--text" style="width: 40%; height: 16px;"></div>
    <div class="p-skeleton p-skeleton--text" style="width: 60%; height: 24px;"></div>
    <div class="p-skeleton p-skeleton--rect" style="width: 100%; height: 44px; border-radius: 10px;"></div>
  `;
  
  return card;
}