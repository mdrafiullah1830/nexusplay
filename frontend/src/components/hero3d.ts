// ============================================================
// NEXUSPLAY — Hero 3D Mouse Follow
// Uses Three.js (global from CDN) for subtle parallax effect.
// After mouse stops, image slowly returns to original position.
// ============================================================

// Three.js is loaded as a global via CDN — declare only the surface we use,
// as real *instance* types (a constructor type would make every property
// access below a type error).
interface ThreeObjects {
  Scene: new () => { add: (object: unknown) => void; children: any[] };
  PerspectiveCamera: new (
    fov: number,
    aspect: number,
    near: number,
    far: number,
  ) => { position: { z: number }; aspect: number; updateProjectionMatrix: () => void };
  WebGLRenderer: new (opts?: { alpha?: boolean; antialias?: boolean }) => {
    setSize: (width: number, height: number) => void;
    setPixelRatio: (ratio: number) => void;
    domElement: HTMLCanvasElement;
  };
  Mesh: new (geometry: unknown, material: unknown) => any;
  PlaneGeometry: new (w: number, h: number, segX: number, segY: number) => unknown;
  MeshBasicMaterial: new (opts: Record<string, unknown>) => unknown;
  CanvasTexture: new (canvas: HTMLCanvasElement) => unknown;
  DoubleSide: number;
}

declare global {
  interface Window {
    THREE: ThreeObjects;
  }
}

type State = 'active' | 'idle' | 'leaving';

export interface Hero3DConfig {
  fadeSpeed: number;   // Speed to return to center after idle
  parallaxStrength: number;  // Mouse follow sensitivity
  smoothness: number;   // Motion smoothness (lower = smoother, more laggy)
  isEnabled: boolean;
}

const DEFAULT_CONFIG: Hero3DConfig = {
  fadeSpeed: 0.03,
  parallaxStrength: 50,
  smoothness: 0.08,
  isEnabled: true,
};

let config: Hero3DConfig = { ...DEFAULT_CONFIG };

// Current states
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let resizeHandler: ((e: WindowEventMap['resize']) => void) | null = null;
let state: State = 'active';

type Scene = InstanceType<ThreeObjects["Scene"]>;
type PerspectiveCamera = InstanceType<ThreeObjects["PerspectiveCamera"]>;
type WebGLRenderer = InstanceType<ThreeObjects["WebGLRenderer"]>;

let scene: Scene | null = null;
let camera: PerspectiveCamera | null = null;
let renderer: WebGLRenderer | null = null;
let heroContainer: HTMLElement | null = null;

// DOM element to animate (defaults to .hero__media)
function findHeroMedia(): HTMLElement | null {
  return document.querySelector('.hero__media') || document.querySelector('.hero__image');
}

// Initialize Three.js scene
function initScene(): void {
  heroContainer = findHeroMedia();
  if (!heroContainer || !config.isEnabled) return;
  if (!window.THREE) return; // Exit if Three.js CDN hasn't loaded yet

  // Hide real image if we're using a color gradient fallback
  const existingImg = heroContainer.querySelector('img');
  if (existingImg) {
    existingImg.style.opacity = '0.3'; // Dim the background image
  }

  // Create gradient background sphere
  if (!scene) {
    const T = window.THREE;
    const builtScene = new T.Scene();
    const builtCamera = new T.PerspectiveCamera(
      75,
      heroContainer.clientWidth / heroContainer.clientHeight,
      0.1,
      1000
    );
    const builtRenderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    builtRenderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
    builtRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = builtScene;
    camera = builtCamera;
    renderer = builtRenderer;

    heroContainer.style.position = 'relative';

    // Gradient material (subtle blue-pink gradient)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new T.CanvasTexture(canvas);
    const geometry = new T.PlaneGeometry(400, 400, 10, 10);
    const material = new T.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide,
    });

    const mesh = new T.Mesh(geometry, material);
    builtScene.add(mesh);

    builtCamera.position.z = 5;

    // Add to container
    builtRenderer.domElement.id = 'hero-3d-canvas';
    builtRenderer.domElement.style.position = 'absolute';
    builtRenderer.domElement.style.top = '0';
    builtRenderer.domElement.style.left = '0';
    builtRenderer.domElement.style.width = '100%';
    builtRenderer.domElement.style.height = '100%';
    builtRenderer.domElement.style.pointerEvents = 'none';
    heroContainer.appendChild(builtRenderer.domElement);
  }
}

// Handle mouse movement
function handleMouseMove(e: MouseEvent): void {
  if (!config.isEnabled) return;

  // Calculate mouse position relative to center of the hero section
  const rect = heroContainer?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  targetX = (e.clientX - centerX) / centerX;
  targetY = (e.clientY - centerY) / centerY;

  // Reset idle timer on any move
  resetIdleTimer();
}

// Reset the idleness timer
function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);

  idleTimer = setTimeout(() => {
    state = 'idle';
  }, 1000); // Stop mouse follow after 1 second of inactivity
}

// Animation loop
let animationId: number | null = null;
function animate(): void {
  if (!config.isEnabled || !renderer) return;

  animationId = requestAnimationFrame(animate);

  if (state === 'idle') {
    // Smoothly return to center
    currentX += (targetX - currentX) * config.fadeSpeed;
    currentY += (targetY - currentY) * config.fadeSpeed;

    // Stop when very close
    if (Math.abs(targetX - currentX) < 0.001 && Math.abs(targetY - currentY) < 0.001) {
      currentX = 0;
      currentY = 0;
      state = 'active';
    }
  } else {
    // Smooth follow
    currentX += (targetX - currentX) * config.smoothness;
    currentY += (targetY - currentY) * config.smoothness;
  }

  if (renderer && camera && scene) {
    const material = scene.children[0] as any;
    if (material) {
      // Apply rotation based on mouse position and parallax strength
      material.rotation.x = currentY * (config.parallaxStrength / 1000);
      material.rotation.y = currentX * (config.parallaxStrength / 1000);
    }
  }
}

// Start the animation
export function initHero3D(): void {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
    return;
  }

  // Set default states
  state = 'active';
  targetX = 0;
  targetY = 0;
  currentX = 0;
  currentY = 0;

  initScene();

  // Enable on hero section
  mouseMoveHandler = (e) => handleMouseMove(e);
  resizeHandler = () => {
    if (heroContainer && renderer && camera) {
      camera.aspect = heroContainer.clientWidth / heroContainer.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
    }
  };

  window.addEventListener('mousemove', mouseMoveHandler);
  window.addEventListener('resize', resizeHandler);

  // Start animation loop
  animate();
}

// Cleanup
export function cleanupHero3D(): void {
  if (animationId) cancelAnimationFrame(animationId);
  if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  if (idleTimer) clearTimeout(idleTimer);

  // Remove canvas from DOM
  const canvas = document.getElementById('hero-3d-canvas');
  if (canvas?.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }

  // Restore original image opacity
  const heroMedia = findHeroMedia();
  const existingImg = heroMedia?.querySelector('img');
  if (existingImg) {
    existingImg.style.opacity = '1';
  }

  scene = null;
  camera = null;
  renderer = null;
  mouseMoveHandler = null;
  resizeHandler = null;
  idleTimer = null;
}

// Update config at runtime
export function updateHero3DConfig(newConfig: Partial<Hero3DConfig>): void {
  config = { ...config, ...newConfig };
}

export function isHero3DEnabled(): boolean {
  return config.isEnabled;
}

export function setHero3DEnabled(enabled: boolean): void {
  config.isEnabled = enabled;
  if (!enabled) {
    // Smoothly return to center
    targetX = 0;
    targetY = 0;
  }
}
