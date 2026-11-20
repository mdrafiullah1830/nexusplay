// ============================================================
// NEXUSPLAY — Hero 3D Mouse Follow (Three.js via CDN)
// Subtle parallax rotation on hero gradient plane based on mouse.
// Returns to center after 1s of no mouse movement.
// Requires the Three.js CDN script to be loaded first (in main.ts).
// ============================================================

declare global {
  interface Window { THREE?: ThreeJS }
}

interface WebGLRendererOptions {
  canvas?: HTMLCanvasElement;
  alpha?: boolean;
  antialias?: boolean;
}

interface ThreeJS {
  Scene: new () => any;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => any;
  WebGLRenderer: new (opts?: WebGLRendererOptions) => any;
  Mesh: new (geometry: any, material: any) => any;
  PlaneGeometry: new (w: number, h: number, segW: number, segH: number) => any;
  MeshBasicMaterial: new (opts: any) => any;
  CanvasTexture: new (canvas: HTMLCanvasElement) => any;
  DoubleSide: number;
}

type State = 'active' | 'idle';

let state: State = 'active';
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let animId: number | null = null;
let scene: any = null;
let camera: any = null;
let renderer: any = null;
let heroContainer: HTMLElement | null = null;

const FADE_SPEED = 0.03;
const PARALLAX_STRENGTH = 50;
const SMOOTHNESS = 0.08;
const IDLE_MS = 1000;

function findHeroMedia(): HTMLElement | null {
  return document.querySelector('.hero__media') ?? document.querySelector('.hero');
}

function initScene(): void {
  const el = findHeroMedia();
  if (!el) return;
  heroContainer = el;
  el.style.position = 'relative';

  // Create canvas for Three.js
  const canvas = renderer ? renderer.domElement : (() => {
    const c = document.createElement('canvas');
    c.id = 'hero-3d-canvas';
    c.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    el.appendChild(c);
    return c;
  })();

  if (!scene && window.THREE) {
    const T = window.THREE!;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Gradient background
    const gc = document.createElement('canvas');
    gc.width = 512; gc.height = 512;
    const ctx = gc.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const geo = new T.PlaneGeometry(400, 400, 10, 10);
    const mat = new T.MeshBasicMaterial({
      map: new T.CanvasTexture(gc),
      transparent: true, opacity: 0.4, side: T.DoubleSide,
    });
    const mesh = new T.Mesh(geo, mat);
    scene.add(mesh);
    camera.position.z = 5;
  }
}

function handleMouseMove(e: MouseEvent): void {
  if (!window.THREE || !renderer) return;
  const rect = heroContainer?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  state = 'active';
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { state = 'idle'; }, IDLE_MS);
}

function animate(): void {
  animId = requestAnimationFrame(animate);
  if (!renderer) return;

  if (state === 'idle') {
    currentX += (targetX - currentX) * FADE_SPEED;
    currentY += (targetY - currentY) * FADE_SPEED;
    if (Math.abs(targetX - currentX) < 0.001 && Math.abs(targetY - currentY) < 0.001) {
      currentX = 0; currentY = 0; state = 'active';
    }
  } else {
    currentX += (targetX - currentX) * SMOOTHNESS;
    currentY += (targetY - currentY) * SMOOTHNESS;
  }

  if (scene) {
    const m = scene.children[0];
    if (m) {
      m.rotation.x = currentY * (PARALLAX_STRENGTH / 1000);
      m.rotation.y = currentX * (PARALLAX_STRENGTH / 1000);
    }
  }
  renderer.render(scene, camera);
}

export function initHero3D(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
    return;
  }
  // Wait a tick for the Three.js script to load
  setTimeout(() => {
    if (!window.THREE) return; // Skip if Three.js failed to load
    initScene();
    window.addEventListener('mousemove', handleMouseMove);
    animate();
  }, 500);
}

export function cleanupHero3D(): void {
  if (animId) cancelAnimationFrame(animId);
  window.removeEventListener('mousemove', handleMouseMove);
  if (idleTimer) clearTimeout(idleTimer);
  const canvas = document.getElementById('hero-3d-canvas');
  canvas?.parentNode?.removeChild(canvas);
  scene = null; camera = null; renderer = null;
}

export function setHero3DEnabled(_enabled: boolean): void {}
export const updateHero3DConfig = (_c: Partial<{ fadeSpeed: number; parallaxStrength: number; smoothness: number; isEnabled: boolean }>) => {};
export const isHero3DEnabled = () => true;
