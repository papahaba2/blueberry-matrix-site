/* Blueberry Matrix — presentation-only enhancements.
   No application state, wallet, RPC or transaction logic lives here. */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------------------------------------------------------------- */
/* Hero particle field                                                        */
/* -------------------------------------------------------------------------- */

function initHeroParticles() {
  const hero = document.querySelector(".landing-hero");
  if (!hero || reducedMotion || window.innerWidth < 760) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero-particles";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let active = true;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let scrollY = 0;

  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    r: 0.5 + Math.random() * 1.6,
    vx: (Math.random() - 0.5) * 0.00012,
    vy: (Math.random() - 0.5) * 0.0001,
    alpha: 0.16 + Math.random() * 0.45,
  }));

  const resize = () => {
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = () => {
    if (!active) return;
    ctx.clearRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      width * pointerX,
      height * pointerY,
      0,
      width * pointerX,
      height * pointerY,
      Math.max(width, height) * 0.55,
    );
    glow.addColorStop(0, "rgba(135, 92, 255, 0.085)");
    glow.addColorStop(0.45, "rgba(135, 92, 255, 0.025)");
    glow.addColorStop(1, "rgba(9, 9, 11, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy + scrollY * 0.00003 * p.z;

      if (p.x < -0.02) p.x = 1.02;
      if (p.x > 1.02) p.x = -0.02;
      if (p.y < -0.02) p.y = 1.02;
      if (p.y > 1.02) p.y = -0.02;

      const dx = p.x - pointerX;
      const dy = p.y - pointerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const parallax = Math.max(0, 1 - distance * 2.4);
      const x = p.x * width + dx * parallax * 18;
      const y = p.y * height + dy * parallax * 18;

      ctx.beginPath();
      ctx.fillStyle = `rgba(183, 164, 255, ${p.alpha * (0.45 + parallax * 0.55)})`;
      ctx.arc(x, y, p.r * p.z, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = window.requestAnimationFrame(draw);
  };

  const onPointer = (event) => {
    const rect = hero.getBoundingClientRect();
    pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    pointerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  };

  const onScroll = () => {
    scrollY = window.scrollY;
  };

  const observer = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) {
      raf = window.requestAnimationFrame(draw);
    } else {
      window.cancelAnimationFrame(raf);
    }
  });

  resize();
  hero.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resize);
  observer.observe(hero);
  raf = window.requestAnimationFrame(draw);

  window.addEventListener("pagehide", () => {
    active = false;
    window.cancelAnimationFrame(raf);
    observer.disconnect();
  });
}

/* -------------------------------------------------------------------------- */
/* Scroll reveals                                                             */
/* -------------------------------------------------------------------------- */

function initReveals() {
  if (reducedMotion) return;

  const selectors = [
    ".landing-section",
    ".vault-overview",
    ".stats",
    ".actions",
    ".network-panel",
    ".governance-panel",
    ".landing-ticker",
  ];

  const elements = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)),
  );

  if (!elements.length) return;

  elements.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.transitionDelay = `${Math.min(index * 40, 220)}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("reveal-in");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  elements.forEach((element) => observer.observe(element));
}

/* -------------------------------------------------------------------------- */
/* Metric count-up                                                            */
/* -------------------------------------------------------------------------- */

function animateMetric(element) {
  if (reducedMotion || element.dataset.animated === "true") return;

  const raw = element.textContent?.trim() ?? "";
  const match = raw.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return;

  const [, prefix, numberText, suffix] = match;
  const decimals = numberText.includes(".")
    ? numberText.split(".")[1].length
    : 0;
  const target = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(target) || target === 0) return;

  element.dataset.animated = "true";
  const start = performance.now();
  const duration = 900;

  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
    element.textContent = `${prefix}${formatted}${suffix}`;

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      element.textContent = raw;
    }
  };

  window.requestAnimationFrame(tick);
}

function initMetricCounters() {
  if (reducedMotion) return;

  const values = document.querySelectorAll(
    ".landing-stat-value, .stat-value, #landingTvl, #landingApr",
  );

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animateMetric(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.3 },
  );

  values.forEach((value) => observer.observe(value));

  // The landing numbers are hydrated after RPC reads.
  const mutationObserver = new MutationObserver(() => {
    values.forEach((value) => {
      if (
        value.dataset.animated !== "true" &&
        value.textContent &&
        value.textContent !== "—"
      ) {
        animateMetric(value);
      }
    });
  });

  const landingStats = document.querySelector(".landing-stats");
  if (landingStats) {
    mutationObserver.observe(landingStats, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
}

initHeroParticles();
initReveals();
initMetricCounters();
