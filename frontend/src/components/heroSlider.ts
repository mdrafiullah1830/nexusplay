// ============================================================
// NEXUSPLAY — Hero Slider (3D transitions + auto-advance + arrows + dots)
//
// Direction-aware: data-dir on .hero drives the entrance keyframes
// and the .is-leaving exit transform in styles/_3d.scss.
//   next → slide in from right / out to left   (prev = mirror)
// ============================================================

type Dir = "next" | "prev";

/** Must cover the 0.75s leave transition in _3d.scss. */
const LEAVE_MS = 800;

export function initHeroSlider(): void {
  const hero = document.querySelector<HTMLElement>(".hero");
  const slides = Array.from(document.querySelectorAll<HTMLElement>(".hero__slide"));
  const dots = Array.from(document.querySelectorAll<HTMLButtonElement>(".hero__dot"));
  if (!hero || slides.length === 0) return;

  let index = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const leaveTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  // Park a slide back at its resting state with transitions off, so
  // a returning slide plays its entrance from a clean slate.
  const park = (el: HTMLElement): void => {
    el.classList.add("is-snap");
    el.classList.remove("is-leaving");
    void el.offsetWidth; // flush while transitions are disabled
    el.classList.remove("is-snap");
  };

  const cancelLeave = (el: HTMLElement): void => {
    const pending = leaveTimers.get(el);
    if (pending !== undefined) {
      clearTimeout(pending);
      leaveTimers.delete(el);
    }
    if (el.classList.contains("is-leaving")) park(el);
  };

  const dirFor = (target: number): Dir => {
    if (target === (index + 1) % slides.length) return "next";
    if (target === (index - 1 + slides.length) % slides.length) return "prev";
    return target > index ? "next" : "prev";
  };

  const show = (next: number, dir: Dir): void => {
    const target = (next + slides.length) % slides.length;
    if (target === index) return; // same slide — nothing to animate

    const outgoing = slides[index];
    const incoming = slides[target];

    // Set before the class swap: CSS reads data-dir for both the
    // exit transform and the entrance keyframes.
    hero.dataset.dir = dir;

    // A slide can be re-used mid-leave on rapid clicks — reset it first.
    cancelLeave(incoming);

    outgoing.classList.remove("is-active");
    outgoing.classList.add("is-leaving");
    leaveTimers.set(
      outgoing,
      setTimeout(() => {
        leaveTimers.delete(outgoing);
        park(outgoing);
      }, LEAVE_MS),
    );

    incoming.classList.add("is-active");

    index = target;
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  };

  const restart = (): void => {
    if (timer) clearInterval(timer);
    timer = setInterval(() => show(index + 1, "next"), 6000);
  };

  dots.forEach((dot, i) =>
    dot.addEventListener("click", () => {
      show(i, dirFor(i));
      restart();
    }),
  );

  document.querySelector(".hero__arrow--prev")?.addEventListener("click", () => {
    show(index - 1, "prev");
    restart();
  });
  document.querySelector(".hero__arrow--next")?.addEventListener("click", () => {
    show(index + 1, "next");
    restart();
  });

  // Triggers the entrance keyframes for the slide that is already
  // marked is-active in the HTML (heroInNext on first paint).
  hero.dataset.dir = "next";
  restart();
}
