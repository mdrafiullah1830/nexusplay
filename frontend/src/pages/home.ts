// ============================================================
// NEXUSPLAY — Signal / Precision homepage
// API-first catalogue with local fallback.
// ============================================================
import { products as localProducts } from "../data/products";
import { productCard } from "../components/productCard";
import { api } from "../services/api";
import type { Product, PagedResult } from "../types";
import { initHeroArena } from "../components/heroArena";

const REPO_IMAGE_ROOT = "https://raw.githubusercontent.com/mdrafiullah1830/nexusplay/main/product_images";

function renderInto(selector: string, html: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.innerHTML = html;
}

async function loadProducts(): Promise<Product[]> {
  try {
    const res = await api.get<PagedResult<Product>>("/products?pageSize=100&sort=featured");
    return res.items.length > 0 ? res.items : localProducts;
  } catch {
    return localProducts;
  }
}

/**
 * Desktop scroll-story: the sticky showcase follows the most visible step.
 * Mobile keeps one image per step so the story remains readable without a
 * sticky visual competing with the content.
 */
function initScrollStory(): void {
  const section = document.querySelector<HTMLElement>("[data-experience]");
  const stage = section?.querySelector<HTMLElement>("[data-story-stage]");
  const stageImage = stage?.querySelector<HTMLImageElement>(".experience__stage-image");
  const currentLabel = stage?.querySelector<HTMLElement>("[data-story-label-current]");
  const currentCount = stage?.querySelector<HTMLElement>("[data-story-count]");
  const steps = Array.from(section?.querySelectorAll<HTMLElement>("[data-story-step]") ?? []);

  if (!section || !stage || !stageImage || steps.length === 0) return;

  let activeStep: HTMLElement | null = null;
  const visibleSteps = new Map<HTMLElement, number>();

  const activate = (step: HTMLElement): void => {
    if (activeStep === step) return;
    activeStep = step;

    steps.forEach((item) => {
      const active = item === step;
      item.dataset.active = String(active);
      if (active) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });

    const index = step.dataset.storyStep ?? "01";
    const source = step.dataset.storyImage;
    stage.dataset.index = index;
    if (currentCount) currentCount.textContent = index + " — " + String(steps.length).padStart(2, "0");
    if (currentLabel) currentLabel.textContent = step.dataset.storyLabel ?? "NEXUSPLAY / FEATURED GEAR";

    if (!source || stageImage.getAttribute("src") === source) return;

    const incoming = new Image();
    incoming.decoding = "async";
    incoming.onload = () => {
      if (activeStep !== step) return;
      stage.classList.add("is-changing");
      stageImage.addEventListener("load", () => stage.classList.remove("is-changing"), { once: true });
      stageImage.src = source;
      stageImage.alt = step.dataset.storyAlt ?? "Featured NexusPlay gaming hardware";
    };
    incoming.src = source;
  };

  activate(steps[0]);

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const target = entry.target as HTMLElement;
      if (entry.isIntersecting) visibleSteps.set(target, entry.intersectionRatio);
      else visibleSteps.delete(target);
    });

    const mostVisible = [...visibleSteps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostVisible) activate(mostVisible);
  }, {
    root: null,
    rootMargin: "-20% 0px -20% 0px",
    threshold: [0, 0.2, 0.4, 0.6, 0.8],
  });

  steps.forEach((step) => observer.observe(step));
}

export async function initHomePage(): Promise<void> {
  initHeroArena();
  initScrollStory();
  const collections = [
    { number: "01", label: "Controller lineup", eyebrow: "PRECISION CONTROL", sub: "Find the feel that fits your game.", href: "/shop.html?category=controllers", image: REPO_IMAGE_ROOT + "/GameSir_G7_Pro_8K_PC_Phantom_Blade_Zero_Limited_Edition/01_angle.webp", alt: "GameSir G7 Pro 8K controller", tone: "tile--controller" },
    { number: "02", label: "Pro performance", eyebrow: "BUILT TO COMPETE", sub: "Explore the Flydigi Apex range.", href: "/shop.html?brand=Flydigi", image: REPO_IMAGE_ROOT + "/Flydigi_Apex_6_Pro/01_angle.webp", alt: "Flydigi Apex 6 Pro controller", tone: "tile--performance" },
    { number: "03", label: "Everyday favourites", eyebrow: "PLAY YOUR WAY", sub: "Smart picks for every setup.", href: "/shop.html?max=5000", image: REPO_IMAGE_ROOT + "/8BitDo_Ultimate_2c/01_angle.png", alt: "8BitDo Ultimate 2C controller", tone: "tile--everyday" },
    { number: "04", label: "Setup essentials", eyebrow: "BEYOND THE CONTROLLER", sub: "Docks, cooling and more.", href: "/shop.html?category=other", image: REPO_IMAGE_ROOT + "/Flydigi_Dock_2_Pro/01_angle.png", alt: "Flydigi Dock 2 Pro accessory", tone: "tile--accessories" },
  ];

  renderInto(
    "#featured-grid",
    collections.map((item) =>
      '<a class="tile reveal reveal--card ' + item.tone + '" href="' + item.href + '" aria-label="' + item.label + '">' +
        '<div class="tile__bg"><img src="' + item.image + '" alt="' + item.alt + '" loading="lazy" decoding="async" /></div>' +
        '<div class="tile__copy"><span class="tile__eyebrow">' + item.number + ' / ' + item.eyebrow + '</span>' +
        '<span class="tile__label">' + item.label + '</span><span class="tile__sub">' + item.sub + '</span>' +
        '<span class="tile__btn">Explore <span aria-hidden="true">↗</span></span></div></a>',
    ).join(""),
  );

  const brands = [
    { name: "GameSir", href: "/shop.html?brand=GameSir", index: "01" },
    { name: "Flydigi", href: "/shop.html?brand=Flydigi", index: "02" },
    { name: "8BitDo", href: "/shop.html?brand=8BitDo", index: "03" },
    { name: "EasySMX", href: "/shop.html?brand=EasySMX", index: "04" },
  ];
  renderInto(
    "#brand-row",
    brands.map((brand) =>
      '<a class="brand-row__item" href="' + brand.href + '">' +
        '<span class="brand-row__index">' + brand.index + '</span><strong>' + brand.name + '</strong>' +
        '<span class="brand-row__arrow" aria-hidden="true">↗</span></a>',
    ).join(""),
  );

  const all = await loadProducts();
  const stockRank = (stock: string): number => stock === "in-stock" ? 0 : stock === "pre-order" ? 1 : 2;
  const bestsellers = [...all]
    .sort((a, b) => stockRank(a.stock) - stockRank(b.stock) || b.rating - a.rating)
    .slice(0, 10);
  renderInto("#bestseller-rail", bestsellers.map(productCard).join(""));

  const savings = [...all]
    .filter((product) => product.oldPrice > product.price)
    .sort((a, b) => (b.oldPrice - b.price) - (a.oldPrice - a.price))
    .slice(0, 10);
  renderInto("#new-rail", savings.map(productCard).join(""));

  const categories = [
    { name: "Controllers", detail: "Find your control", href: "/shop.html?category=controllers", image: REPO_IMAGE_ROOT + "/8BitDo_Ultimate_2c/01_angle.png", alt: "8BitDo controller", number: "01" },
    { name: "Docks & charging", detail: "Power your setup", href: "/shop.html?q=dock", image: REPO_IMAGE_ROOT + "/Flydigi_Dock_2_Pro/01_angle.png", alt: "Flydigi controller charging dock", number: "02" },
    { name: "Cooling gear", detail: "Keep your setup ready", href: "/shop.html?q=cooling", image: REPO_IMAGE_ROOT + "/Flydigi_BS2_Pro/01_angle.png", alt: "Flydigi BS2 Pro cooling pad", number: "03" },
  ];
  renderInto(
    "#cat-row",
    categories.map((category) =>
      '<a class="cat-tile reveal reveal--card" href="' + category.href + '">' +
        '<div class="cat-tile__circle"><img src="' + category.image + '" alt="' + category.alt + '" loading="lazy" decoding="async" /></div>' +
        '<div class="cat-tile__meta"><span>' + category.number + ' / CATEGORY</span><strong>' + category.name + '</strong><small>' + category.detail + '</small></div>' +
        '<span class="cat-tile__arrow" aria-hidden="true">↗</span></a>',
    ).join("") +
    '<a class="cat-tile cat-tile--all reveal reveal--card" href="/shop.html">' +
      '<div class="cat-tile--all__mark" aria-hidden="true">N<span>↗</span></div>' +
      '<div class="cat-tile__meta"><span>04 / THE FULL LINEUP</span><strong>All hardware</strong><small>Explore every product</small></div>' +
      '<span class="cat-tile__arrow" aria-hidden="true">↗</span></a>',
  );
}