// ============================================================
// NEXUSPLAY — Raw 3D animation layer (vanilla JS, no libraries)
//   * IntersectionObserver scroll reveal with batch stagger, plus
//     a MutationObserver for dynamically injected content
//   * hero mouse parallax tilt (CSS vars --rx / --ry on .hero)
//   * Hero 3D mouse follow (Three.js)
//
// Pair file: styles/_3d.scss. The reveal hidden state there is
// gated behind html.has-anim, which is only added below when
// IntersectionObserver exists and reduced-motion is off — so the
// page is never invisible without JS.
// ============================================================

import { initHeroSlider } from './heroSlider';
import { initHero3D } from './hero3d';

const REVEAL_SELECTOR = [
  ".section__head",
  ".tile",
  ".trend-card",
  ".cat-tile",
  ".p-card",
  ".pd-layout",
  ".cart-layout",
  ".checkout-layout",
  ".track-result",
  ".page-message",
].join(", ");

const STAGGER_MS = 70; // per element within the same viewport batch
const MAX_STAGGER = 6; // cap so long batches don't drag out
const REVEAL_MS = 650; // longest reveal transition in _3d.scss

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initAnimations(): void {
  // Hard opt-outs — without this call html never gets .has-anim,
  // so _3d.scss keeps every reveal target visible by default.
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("has-anim");
  initScrollReveal();
  initHeroParallax();
  initHeroSlider();
  initHero3D();
}

// -- Scroll reveal ---------------------------------------------
function initScrollReveal(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      let batch = 0;

      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        if (el.classList.contains("is-inview")) continue;

        const delay = Math.min(batch, MAX_STAGGER - 1) * STAGGER_MS;
        batch += 1;

        el.style.setProperty("--reveal-delay", `${delay}ms`);
        el.classList.add("is-inview");

        // Drop the stagger delay once the entrance finished, so
        // hover transitions on tiles/cards stay instant.
        window.setTimeout(
          () => el.style.removeProperty("--reveal-delay"),
          delay + REVEAL_MS + 100,
        );
      }
    },
    { threshold: 0, rootMargin: "0px 0px -8% 0px" },
  );

  const observe = (root: Node): void => {
    if (!(root instanceof Element)) return;
    if (root.matches(REVEAL_SELECTOR) && !root.classList.contains("is-inview")) {
      observer.observe(root);
    }
    root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
      if (!el.classList.contains("is-inview")) observer.observe(el);
    });
  };

  // Static markup present at init
  observe(document.documentElement);

  // Dynamically injected content (cards, page renders, track results…)
  const mo = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(observe);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// -- Hero mouse parallax ---------------------------------------
// Writes --rx / --ry on .hero; _3d.scss applies them to the
// active slide's transform. Pointer-fine devices only.
function initHeroParallax(): void {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 … 1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    hero.style.setProperty("--rx", `${(-ny * 3.5).toFixed(2)}deg`);
    hero.style.setProperty("--ry", `${(nx * 4.5).toFixed(2)}deg`);
  });

  hero.addEventListener("mouseleave", () => {
    hero.style.removeProperty("--rx");
    hero.style.removeProperty("--ry");
  });
}
