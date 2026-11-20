// ============================================================
// NEXUSPLAY — Arena hero interaction
// Lightweight canvas telemetry particles + pointer-driven product depth.
// No dependency, no audio, and fully disabled for reduced-motion users.
// ============================================================

interface ArenaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

function initHeroProductViewer(media: HTMLElement): void {
  const stage = media.querySelector<HTMLElement>(".hero__product-stage");
  if (!stage || media.dataset.viewerReady === "true") return;
  media.dataset.viewerReady = "true";

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let yaw = 0;
  let pitch = 0;

  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

  const applyRotation = (): void => {
    stage.style.setProperty("--viewer-rotation-y", yaw.toFixed(2) + "deg");
    stage.style.setProperty("--viewer-rotation-x", pitch.toFixed(2) + "deg");
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.classList.add("is-dragging");
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a progressive enhancement.
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!dragging) return;
    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    yaw = clamp(yaw + deltaX * 0.32, -30, 30);
    pitch = clamp(pitch - deltaY * 0.2, -14, 14);
    applyRotation();
  };

  const handlePointerEnd = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-dragging");
    if (stage.hasPointerCapture(event.pointerId)) {
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may already have released the pointer.
      }
    }
  };

  stage.addEventListener("pointerdown", handlePointerDown);
  stage.addEventListener("pointermove", handlePointerMove, { passive: true });
  stage.addEventListener("pointerup", handlePointerEnd);
  stage.addEventListener("pointercancel", handlePointerEnd);
  stage.addEventListener("lostpointercapture", handlePointerEnd);
  stage.addEventListener("dragstart", (event) => event.preventDefault());

  media.querySelectorAll<HTMLButtonElement>("[data-viewer-action]").forEach((button) => {
    button.addEventListener("click", () => {
      switch (button.dataset.viewerAction) {
        case "left":
          yaw = clamp(yaw - 10, -30, 30);
          break;
        case "right":
          yaw = clamp(yaw + 10, -30, 30);
          break;
        case "reset":
          yaw = 0;
          pitch = 0;
          break;
      }
      applyRotation();
    });
  });
}

export function initHeroArena(): void {
  const media = document.querySelector<HTMLElement>(".hero__media");
  if (!media || media.dataset.arenaReady === "true") return;
  media.dataset.arenaReady = "true";
  initHeroProductViewer(media);

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let removeActiveEffects: (() => void) | null = null;

  const disableEffects = (): void => {
    removeActiveEffects?.();
    removeActiveEffects = null;
  };

  const enableEffects = (): void => {
    if (motionPreference.matches || removeActiveEffects) return;

    const canvas = document.createElement("canvas");
    canvas.className = "hero__particles";
    canvas.setAttribute("aria-hidden", "true");
    media.insertBefore(canvas, media.firstChild);

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      canvas.remove();
      return;
    }

    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let particles: ArenaParticle[] = [];
    let frameId = 0;
    let lastFrame = 0;
    let inView = true;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let pointerActive = false;

    const makeParticles = (): ArenaParticle[] => {
      const count = Math.max(18, Math.min(38, Math.round(width / 23)));
      return Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        radius: 0.7 + Math.random() * 1.25,
      }));
    };

    const resize = (): void => {
      const rect = media.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      particles = makeParticles();
    };

    const draw = (timestamp: number): void => {
      frameId = 0;
      if (!inView || document.hidden || motionPreference.matches) return;
      if (timestamp - lastFrame < 30) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const elapsed = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0.016;
      lastFrame = timestamp;
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx * elapsed;
        particle.y += particle.vy * elapsed;

        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        if (particle.y < -8) particle.y = height + 8;
        if (particle.y > height + 8) particle.y = -8;

        if (pointerActive) {
          const dx = pointerX * width - particle.x;
          const dy = pointerY * height - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 150 && distance > 1) {
            particle.x -= (dx / distance) * 2.2 * elapsed * 30;
            particle.y -= (dy / distance) * 2.2 * elapsed * 30;
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j];
          const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
          if (distance > 112) continue;
          const alpha = (1 - distance / 112) * 0.2;
          context.strokeStyle = "rgba(40, 57, 17, " + alpha.toFixed(3) + ")";
          context.lineWidth = 0.7;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }

      for (const particle of particles) {
        context.fillStyle = "rgba(39, 55, 17, 0.38)";
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }

      frameId = requestAnimationFrame(draw);
    };

    const start = (): void => {
      if (frameId || !inView || document.hidden || motionPreference.matches) return;
      lastFrame = 0;
      frameId = requestAnimationFrame(draw);
    };

    const stop = (): void => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const handlePointerMove = (event: PointerEvent): void => {
      const rect = media.getBoundingClientRect();
      pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      pointerActive = true;

      const x = pointerX - 0.5;
      const y = pointerY - 0.5;
      media.style.setProperty("--arena-shift-x", (-x * 18).toFixed(1) + "px");
      media.style.setProperty("--arena-shift-y", (-y * 14).toFixed(1) + "px");
      media.style.setProperty("--arena-rotate-x", (y * 4).toFixed(2) + "deg");
      media.style.setProperty("--arena-rotate-y", (x * 5).toFixed(2) + "deg");
      media.style.setProperty("--arena-light-x", (pointerX * 100).toFixed(1) + "%");
      media.style.setProperty("--arena-light-y", (pointerY * 100).toFixed(1) + "%");
    };

    const handlePointerLeave = (): void => {
      pointerActive = false;
      media.style.setProperty("--arena-shift-x", "0px");
      media.style.setProperty("--arena-shift-y", "0px");
      media.style.setProperty("--arena-rotate-x", "0deg");
      media.style.setProperty("--arena-rotate-y", "0deg");
      media.style.setProperty("--arena-light-x", "53%");
      media.style.setProperty("--arena-light-y", "46%");
    };

    const handleVisibility = (): void => {
      if (document.hidden) stop();
      else start();
    };

    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          if (inView) start();
          else stop();
        }, { threshold: 0.05 })
      : null;

    resize();
    observer?.observe(media);
    if (!observer) start();

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(media);
    if (!resizeObserver) window.addEventListener("resize", resize);

    if (finePointer.matches) {
      media.addEventListener("pointermove", handlePointerMove, { passive: true });
      media.addEventListener("pointerleave", handlePointerLeave);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    removeActiveEffects = () => {
      stop();
      observer?.disconnect();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      media.removeEventListener("pointermove", handlePointerMove);
      media.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.remove();
      handlePointerLeave();
    };

    start();
  };

  motionPreference.addEventListener("change", (event) => {
    if (event.matches) disableEffects();
    else enableEffects();
  });

  enableEffects();
}