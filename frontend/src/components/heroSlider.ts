// ============================================================
// NEXUSPLAY — Hero Slider (auto-advance + arrows + dots)
// ============================================================

export function initHeroSlider(): void {
  const slides = Array.from(document.querySelectorAll<HTMLElement>(".hero__slide"));
  const dots = Array.from(document.querySelectorAll<HTMLButtonElement>(".hero__dot"));
  if (slides.length === 0) return;

  let index = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const show = (next: number): void => {
    index = (next + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  };

  const restart = (): void => {
    if (timer) clearInterval(timer);
    timer = setInterval(() => show(index + 1), 6000);
  };

  dots.forEach((dot, i) =>
    dot.addEventListener("click", () => {
      show(i);
      restart();
    }),
  );

  document.querySelector(".hero__arrow--prev")?.addEventListener("click", () => {
    show(index - 1);
    restart();
  });
  document.querySelector(".hero__arrow--next")?.addEventListener("click", () => {
    show(index + 1);
    restart();
  });

  show(0);
  restart();
}
