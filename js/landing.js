/* ==========================================================================
   One-Off Portfolio: cosmic one-pager motion.
   GSAP 3.15 (ScrollTrigger, SplitText, Draggable, Inertia, MotionPath,
   DrawSVG, ScrambleText, Text), Lenis 1.3, Swiper 14, Matter.js 0.20.
   House rules: start states are set here (never in CSS), reduced motion
   gets end states and no loops, breakpoints go through gsap.matchMedia().
   ========================================================================== */
(() => {
  "use strict";
  if (typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin, MotionPathPlugin, DrawSVGPlugin, ScrambleTextPlugin, TextPlugin);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = gsap.utils.random;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const state = { meme: true, warp: false, gravity: false, boost: 0, dy: 0 };
  const mm = gsap.matchMedia();

  /* ---------------- Toasts ---------------- */
  const toastList = $("[data-toasts]");
  const toastSeen = new Set();
  function toast(text, once) {
    if (once) { if (toastSeen.has(once)) return; toastSeen.add(once); }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="toast_icon"><svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/></svg></span><span></span>';
    el.lastElementChild.textContent = text;
    toastList.append(el);
    const max = innerWidth < 768 ? 1 : 3;
    while (toastList.children.length > max) toastList.firstElementChild.remove();
    gsap.fromTo(el, { x: -40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: reduce ? 0 : 0.5, ease: "back.out(1.6)" });
    gsap.to(el, { x: -40, autoAlpha: 0, duration: 0.4, delay: 4.5, onComplete: () => el.remove() });
  }
  const memeToast = (text, once) => { if (state.meme) toast(text, once); };

  /* ---------------- Meme mode ---------------- */
  const swaps = $$("[data-meme-swap]").map((el) => ({ el, serious: el.textContent, meme: el.dataset.memeSwap }));
  const headingSplits = new Map();
  function applyMeme(on, animate) {
    state.meme = on;
    document.body.classList.toggle("is-serious", !on);
    swaps.forEach((s) => {
      const text = on ? s.meme : s.serious;
      const split = headingSplits.get(s.el);
      if (split) { split.revert(); headingSplits.delete(s.el); }
      if (animate && !reduce) {
        gsap.to(s.el, { duration: 0.9, scrambleText: { text, chars: "upperCase", speed: 0.8 }, ease: "none" });
      } else {
        s.el.textContent = text;
      }
    });
    const logo = $("[data-logo]");
    logo.setAttribute("aria-label", on ? "Eugene Quilban. Make the logo bigger." : "Eugene Quilban. Back to top.");
    if (!on) resetLogo();
    ScrollTrigger.refresh();
  }
  applyMeme(true, false);

  /* ---------------- Lenis smooth scroll ---------------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToTarget(target) {
    if (lenis) return lenis.scrollTo(target, { duration: 1.6 });
    if (typeof target === "number") window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }
  $$("[data-scroll-to]").forEach((a) => a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
  }));
  $("[data-scroll-top]").addEventListener("click", () => {
    scrollToTarget(0);
    memeToast("Beaming you up. Mind the asteroids.", "top");
  });

  // Scroll speed per frame, shared by the starfield, marquee and the speedrun joke
  let lastScrollY = window.scrollY;
  gsap.ticker.add(() => {
    state.dy = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    if (Math.abs(state.dy) > 150) memeToast("Whoa. This is a portfolio, not a speedrun.", "speed");
  });

  /* ---------------- Starfield (3D warp, reacts to scroll and pointer) ---------------- */
  function starfield() {
    const canvas = $("[data-starfield]");
    const ctx = canvas.getContext("2d");
    const colours = ["#ffffff", "#ffffff", "#ffffff", "#d4ccff", "#a8dbff", "#ffd9a0", "#ffb8d6"];
    const count = innerWidth < 768 ? 260 : 620;
    const stars = [];
    let w = 0, h = 0, speed = 0.0006, px = 0, py = 0, tx = 0, ty = 0;
    const reset = (s, z) => {
      s.x = rand(-1.2, 1.2); s.y = rand(-1.2, 1.2); s.z = z ?? rand(0.05, 1); s.pz = s.z;
      s.c = colours[(Math.random() * colours.length) | 0]; s.r = rand(0.3, 1.5);
    };
    for (let i = 0; i < count; i++) { const s = {}; reset(s); stars.push(s); }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener("resize", resize);
    if (finePointer) addEventListener("pointermove", (e) => { tx = e.clientX / w - 0.5; ty = e.clientY / h - 0.5; });

    const draw = () => {
      const target = 0.0005 + Math.min(Math.abs(state.dy), 140) * 0.00011 + (state.warp ? 0.016 : 0) + state.boost;
      speed += (target - speed) * 0.06;
      px += (tx - px) * 0.04; py += (ty - py) * 0.04;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2 - px * 80, cy = h / 2 - py * 60, scale = Math.max(w, h) * 0.5;
      const streak = speed > 0.0035;
      for (const s of stars) {
        s.pz = s.z;
        if (!reduce) s.z -= speed;
        if (s.z <= 0.04) { reset(s, 1); continue; }
        const sx = cx + (s.x / s.z) * scale, sy = cy + (s.y / s.z) * scale;
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { reset(s, 1); continue; }
        const size = s.r * (1.4 - s.z) + 0.15;
        ctx.globalAlpha = Math.min(1, 1.15 - s.z);
        if (streak) {
          const ox = cx + (s.x / s.pz) * scale, oy = cy + (s.y / s.pz) * scale;
          ctx.strokeStyle = s.c; ctx.lineWidth = size;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(sx, sy); ctx.stroke();
        } else {
          ctx.fillStyle = s.c;
          ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    if (reduce) { draw(); addEventListener("resize", draw); } else gsap.ticker.add(draw);
  }
  window.EQ = { state, starfield, toast, memeToast, reduce, finePointer };

  /* ---------------- Cursor ---------------- */
  if (finePointer && !reduce) {
    const ring = $("[data-cursor-ring]"), dot = $("[data-cursor-dot]");
    gsap.set([ring, dot], { autoAlpha: 0 });
    const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
    const dx = gsap.quickTo(dot, "x", { duration: 0.08 }), dy = gsap.quickTo(dot, "y", { duration: 0.08 });
    let shown = false;
    addEventListener("pointermove", (e) => {
      if (!shown) { shown = true; gsap.set([ring, dot], { x: e.clientX, y: e.clientY }); gsap.to([ring, dot], { autoAlpha: 1, duration: 0.3 }); }
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    });
    document.addEventListener("pointerover", (e) => {
      const hit = e.target.closest("a, button, summary, label, [data-pill], [data-shot], .swiper-slide, .sticker");
      ring.classList.toggle("is-active", !!hit);
      gsap.to(ring, { scale: hit ? 1.7 : 1, duration: 0.35, ease: "power3.out", overwrite: "auto" });
    });
    document.addEventListener("pointerleave", () => gsap.to([ring, dot], { autoAlpha: 0, duration: 0.2 }));
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (finePointer && !reduce) {
    $$("[data-magnetic]").forEach((el) => {
      const mx = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" }), my = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.3); my((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener("pointerleave", () => { mx(0); my(0); });
    });
  }

  /* ---------------- Nav: progress, hide on scroll down, logo joke ---------------- */
  const nav = $("[data-nav]");
  const progressBar = $("[data-progress]");
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => {
      gsap.set(progressBar, { scaleX: self.progress });
      document.body.classList.toggle("is-scrolled", window.scrollY > 80);
      if (self.progress > 0.985) memeToast("Achievement unlocked: read a whole portfolio. Rare.", "bottom");
    },
  });

  const logo = $("[data-logo]");
  const logoLines = ["Bigger.", "Even bigger.", "Client: still not big enough.", "It is now legally a billboard.", "Okay, that's the max. The div is crying."];
  let logoClicks = 0;
  function resetLogo() { logoClicks = 0; gsap.to(logo, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }); }
  logo.addEventListener("click", () => {
    if (!state.meme) { scrollToTarget(0); return; }
    if (logoClicks >= logoLines.length) {
      gsap.to(logo, { rotation: "+=360", scale: 1, duration: 0.8, ease: "power3.inOut" });
      toast("Fine. Back to normal. Happy now?");
      logoClicks = 0;
      return;
    }
    toast(logoLines[logoClicks]);
    logoClicks++;
    gsap.to(logo, { scale: 1 + logoClicks * 0.3, duration: reduce ? 0 : 0.6, ease: "elastic.out(1, 0.45)" });
  });

  /* ---------------- Burger + off-canvas warp portal ---------------- */
  function menu() {
    const burger = $("[data-burger]"), menuEl = $("[data-menu]"), portal = $("[data-menu-portal]");
    const label = $("[data-burger-label]");
    const lines = $$("[data-burger-line]"), links = $$("[data-menu-link]"), page = $("[data-page]");
    const starsBox = $("[data-menu-stars]");
    for (let i = 0; i < 80; i++) { const s = document.createElement("i"); gsap.set(s, { left: `${rand(0, 100)}%`, top: `${rand(0, 100)}%` }); starsBox.append(s); }
    const splits = links.map((a) => SplitText.create(a.querySelector(".menu_link-text"), { type: "chars", charsClass: "char" }));
    const icon = $(".nav_burger-icon");
    let isOpen = false, tl;

    // Idle loops inside the portal, paused while it is closed
    const loops = reduce ? [] : [
      gsap.to("[data-menu-swirl]", { rotation: "+=360", duration: 26, repeat: -1, ease: "none" }),
      gsap.to("[data-menu-rings]", { rotation: "-=360", duration: 60, repeat: -1, ease: "none", transformOrigin: "50% 50%" }),
      gsap.to("[data-menu-moon]", { motionPath: { path: "[data-menu-orbit]" }, duration: 9, repeat: -1, ease: "none" }),
      gsap.to(starsBox.children, { opacity: 0.2, duration: 1.4, repeat: -1, yoyo: true, stagger: { each: 0.05, from: "random" } }),
    ];
    loops.forEach((l) => l.pause());

    links.forEach((a, i) => a.addEventListener("pointerenter", () => {
      if (reduce) return;
      gsap.fromTo(splits[i].chars, { yPercent: 0, rotation: 0 }, { yPercent: -28, rotation: () => rand(-12, 12), duration: 0.18, stagger: 0.02, yoyo: true, repeat: 1, ease: "power2.out", overwrite: "auto" });
    }));

    const origin = () => { const r = icon.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const setLabel = () => { label.textContent = isOpen ? (state.meme ? "Eject" : "Close") : (state.meme ? "Hyperdrive" : "Menu"); };

    function openMenu() {
      isOpen = true;
      menuEl.hidden = false;
      document.body.classList.add("is-menu-open");
      page.inert = true;
      lenis?.stop();
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Close menu");
      setLabel();
      loops.forEach((l) => l.play());
      toastList.replaceChildren();
      memeToast("Hyperdrive engaged. Mind the wormhole.", "menu");
      tl?.kill();
      if (reduce) { links[0].focus(); return; }
      const o = origin();
      const R = Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y)) + 40;
      gsap.timeline()
        .to(icon, { rotation: 180, scale: 1.15, duration: 0.6, ease: "back.out(2.5)" }, 0)
        .to(lines[0], { y: 7.5, rotation: 45, duration: 0.4, ease: "back.out(2)" }, 0.05)
        .to(lines[1], { scaleX: 0, autoAlpha: 0, duration: 0.25 }, 0)
        .to(lines[2], { y: -7.5, rotation: -45, duration: 0.4, ease: "back.out(2)" }, 0.05)
        .fromTo(label, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4 }, 0.15);
      tl = gsap.timeline({ onComplete: () => links[0].focus({ preventScroll: true }) })
        .fromTo(portal, { clipPath: `circle(0px at ${o.x}px ${o.y}px)` }, { clipPath: `circle(${R}px at ${o.x}px ${o.y}px)`, duration: 1.05, ease: "expo.inOut" }, 0)
        .fromTo("[data-menu-swirl]", { scale: 0.2 }, { scale: 1, duration: 1.6, ease: "expo.out" }, 0)
        .fromTo("[data-menu-rings] .menu_ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, stagger: 0.12, ease: "power3.out" }, 0.3)
        .fromTo(starsBox.children, { scale: 0 }, { scale: () => rand(0.5, 1.8), duration: 0.6, stagger: { amount: 0.9, from: "random" }, ease: "back.out(3)" }, 0.35)
        .fromTo(links, { yPercent: 130, rotationX: -85, z: -300, transformPerspective: 900 }, { yPercent: 0, rotationX: 0, z: 0, duration: 1.1, stagger: 0.07, ease: "expo.out" }, 0.45)
        .fromTo("[data-menu-kicker], [data-menu-aside] > *", { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.7, ease: "power3.out" }, 0.7)
        .fromTo("[data-menu-rocket]", { x: -140, y: innerHeight * 0.9, rotation: -32 }, { x: innerWidth + 140, y: innerHeight * 0.05, duration: 2.4, ease: "power1.inOut" }, 0.35);
    }

    function closeMenu(after) {
      if (!isOpen) return;
      isOpen = false;
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
      setLabel();
      const done = () => {
        menuEl.hidden = true;
        document.body.classList.remove("is-menu-open");
        page.inert = false;
        loops.forEach((l) => l.pause());
        lenis?.start();
        if (after) after(); else burger.focus({ preventScroll: true });
      };
      tl?.kill();
      if (reduce) { done(); return; }
      const o = origin();
      gsap.timeline()
        .to(icon, { rotation: 0, scale: 1, duration: 0.6, ease: "back.out(2)" }, 0)
        .to([lines[0], lines[2]], { y: 0, rotation: 0, duration: 0.4, ease: "back.out(2)" }, 0)
        .to(lines[1], { scaleX: 1, autoAlpha: 1, duration: 0.3 }, 0.15);
      tl = gsap.timeline({ onComplete: done })
        .to(links, {
          x: (i, el) => { const r = el.getBoundingClientRect(); return o.x - (r.left + r.width / 2); },
          y: (i, el) => { const r = el.getBoundingClientRect(); return o.y - (r.top + r.height / 2); },
          scale: 0, rotation: () => rand(90, 260), duration: 0.65, stagger: { each: 0.04, from: "end" }, ease: "power3.in",
        }, 0)
        .to("[data-menu-kicker], [data-menu-aside] > *", { autoAlpha: 0, scale: 0.6, duration: 0.3 }, 0)
        .to(portal, { clipPath: `circle(0px at ${o.x}px ${o.y}px)`, duration: 0.8, ease: "expo.inOut" }, 0.25)
        .set(links, { x: 0, y: 0, scale: 1, rotation: 0 });
    }

    burger.addEventListener("click", () => (isOpen ? closeMenu() : openMenu()));
    links.forEach((a) => a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      closeMenu(() => scrollToTarget(target));
    }));
    addEventListener("keydown", (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") { closeMenu(); return; }
      if (e.key !== "Tab") return;
      const focusables = [burger, ...$$("a, button", menuEl)];
      const i = focusables.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i === focusables.length - 1 ? 0 : i + 1);
      e.preventDefault();
      focusables[next].focus();
    });
    window.EQ.refreshMenuLabel = setLabel;
  }

  /* ---------------- Mission control dock ---------------- */
  const dockToggle = $("[data-dock-toggle]"), dockPanel = $("[data-dock-panel]");
  dockToggle.addEventListener("click", () => {
    const open = dockPanel.hidden;
    dockToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      dockPanel.hidden = false;
      gsap.fromTo(dockPanel, { y: 20, scale: 0.92, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: reduce ? 0 : 0.4, ease: "back.out(1.7)", transformOrigin: "100% 100%" });
      memeToast("Mission control online. Please don't press anything. (Press everything.)", "dock");
    } else {
      gsap.to(dockPanel, { y: 20, scale: 0.92, autoAlpha: 0, duration: reduce ? 0 : 0.25, onComplete: () => { dockPanel.hidden = true; } });
    }
  });
  $("[data-switch='meme']").addEventListener("change", (e) => {
    applyMeme(e.target.checked, true);
    window.EQ.refreshMenuLabel?.();
    toast(e.target.checked ? "Meme mode on. Professionalism has left the chat." : "Serious mode. Tie on. Same developer.");
  });
  $("[data-switch='warp']").addEventListener("change", (e) => {
    state.warp = e.target.checked;
    toast(e.target.checked ? (state.meme ? "Ludicrous speed. Go!" : "Warp speed on.") : "Back to cruising speed.");
  });
  $("[data-switch='gravity']").addEventListener("change", (e) => setGravity(e.target.checked));

  /* ---------------- Gravity mode ---------------- */
  let fallen = [];
  let toolkitEngine = null;
  function setGravity(on) {
    state.gravity = on;
    if (toolkitEngine) toolkitEngine.gravity.y = on ? 1 : 0;
    if (on) {
      toast(state.meme ? "Who turned gravity on? Oh. You did." : "Gravity on.");
      if (reduce) return;
      const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
      fallen = $$(".sticker, .button, .tag, .slider_button, .hero_eyebrow, .services_hint, .toolkit_hint, .work_hint, .nav_burger, .system_node").filter(inView);
      fallen.forEach((el) => {
        const r = el.getBoundingClientRect();
        el._rot = gsap.getProperty(el, "rotation");
        gsap.to(el, { y: `+=${Math.max(0, innerHeight - r.bottom - rand(4, 30))}`, rotation: rand(-28, 28), duration: rand(0.9, 1.6), ease: "bounce.out", delay: rand(0, 0.25), overwrite: "auto" });
      });
    } else {
      toast(state.meme ? "Gravity off. Newton has been notified." : "Gravity off.");
      fallen.forEach((el) => gsap.to(el, { y: 0, rotation: el._rot || 0, duration: 1, ease: "back.out(1.4)", overwrite: "auto" }));
      fallen = [];
    }
  }

  /* ---------------- Nebula colour per section ---------------- */
  const nebulas = $$("[data-nebula]");
  function setNebula(name) {
    nebulas.forEach((n) => gsap.to(n, { autoAlpha: n.dataset.nebula === name ? 1 : 0, duration: reduce ? 0 : 1.4, ease: "power2.out", overwrite: "auto" }));
  }

  /* ---------------- Split headings ---------------- */
  function splitHeadings() {
    $$("[data-split-heading]").forEach((h) => {
      if (reduce) return;
      const split = SplitText.create(h, { type: "lines,words", mask: "lines" });
      headingSplits.set(h, split);
      gsap.from(split.words, {
        yPercent: 120, rotation: 8, duration: 1.1, ease: "expo.out", stagger: 0.06,
        scrollTrigger: { trigger: h, start: "top 88%", once: true },
        onComplete: () => { if (headingSplits.get(h) === split) { split.revert(); headingSplits.delete(h); } },
      });
    });
  }

  /* ---------------- Hero ---------------- */
  function hero() {
    const section = $("[data-hero]");
    const heading = $("[data-hero-heading]");
    const split = SplitText.create(heading, { type: "lines,words,chars", charsClass: "char", linesClass: "hero_line" });
    mm.add("(min-width: 992px)", () => {
      const indents = [0, 0.09, 0.02, 0.16, 0.05];
      gsap.set(split.lines, { x: (i) => innerWidth * (indents[i] || 0) });
    });

    // Orbiting tools
    const orbit = $("[data-orbit]");
    const items = $$("[data-orbit-item]");
    const rings = { 1: { r: 0.35, speed: 0.32, tilt: 0 }, 2: { r: 0.5, speed: -0.2, tilt: -12 * Math.PI / 180 } };
    const perRing = { 1: 0, 2: 0 };
    const counts = { 1: items.filter((i) => i.dataset.ring === "1").length, 2: items.filter((i) => i.dataset.ring === "2").length };
    const orbitItems = items.map((el) => {
      const ring = el.dataset.ring;
      const base = (perRing[ring]++ / counts[ring]) * Math.PI * 2;
      return { el, ring: rings[ring], base };
    });
    let size = orbit.offsetWidth;
    addEventListener("resize", () => { size = orbit.offsetWidth; });
    const squash = Math.cos(72 * Math.PI / 180);
    const placeOrbit = (t) => {
      orbitItems.forEach((o) => {
        const a = o.base + t * o.ring.speed;
        const R = size * o.ring.r;
        let x = Math.cos(a) * R, y = Math.sin(a) * R * squash;
        const cos = Math.cos(o.ring.tilt), sin = Math.sin(o.ring.tilt);
        [x, y] = [x * cos - y * sin, x * sin + y * cos];
        const depth = Math.sin(a);
        gsap.set(o.el, { x, y, scale: 0.72 + (depth + 1) * 0.2, zIndex: depth > 0 ? 10 : 1, autoAlpha: 0.55 + (depth + 1) * 0.225 });
      });
    };
    placeOrbit(0.6);
    if (!reduce) gsap.ticker.add((time) => placeOrbit(time));

    if (reduce) return;

    // Intro
    const eyebrow = $("[data-hero-eyebrow]");
    const eyebrowText = eyebrow.textContent;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(split.chars, { yPercent: 60, rotation: () => gsap.utils.random(-25, 25), scale: 0.6, duration: 1.1, stagger: 0.016, ease: "expo.out" }, 0.1)
      .fromTo(eyebrow, { scrambleText: { text: " " } }, { duration: 1.3, scrambleText: { text: eyebrowText, chars: "lowerCase", revealDelay: 0.3, speed: 0.6 } }, 0)
      .from("[data-hero-sub]", { y: 30, autoAlpha: 0, duration: 0.9 }, 0.5)
      .from("[data-hero-buttons] > *", { y: 30, autoAlpha: 0, stagger: 0.1, duration: 0.8, ease: "back.out(1.7)" }, 0.65)
      .from("[data-hero-meme]", { scale: 0, rotation: -25, duration: 0.7, ease: "back.out(2.2)" }, 1)
      .from(orbit, { scale: 0.5, rotation: -40, autoAlpha: 0, duration: 1.6, ease: "expo.out" }, 0.15)
      .from(".hero_layer", { autoAlpha: 0, duration: 1.6, stagger: 0.2 }, 0)
      .from(".hero_sticker", { scale: 0, rotation: 30, duration: 0.6, ease: "back.out(2)" }, 1.2)
      .from(".hero_scroll", { autoAlpha: 0, y: -10, duration: 0.6 }, 1.3)
      .add(() => memeToast("Houston, we have a portfolio.", "hello"), 1.8);

    // Idle motion
    gsap.to(".hero_planet.is-ringed", { y: -18, rotation: 5, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".hero_planet.is-small", { y: 14, x: 10, duration: 5.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".hero_satellite", { rotation: 12, x: 40, y: 20, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".hero_scroll-line", { scaleY: 0.3, duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });

    // Shooting stars while the hero is on screen
    let heroActive = true;
    ScrollTrigger.create({ trigger: section, start: "top bottom", end: "bottom top", onToggle: (s) => { heroActive = s.isActive; } });
    const scene = $("[data-hero-scene]");
    const shoot = () => {
      if (heroActive && !document.hidden) {
        const star = document.createElement("span");
        star.className = "shooting-star";
        scene.append(star);
        const angle = rand(18, 32);
        gsap.fromTo(star, { left: `${rand(0, 60)}%`, top: `${rand(0, 40)}%`, rotation: angle, x: 0, autoAlpha: 0 }, {
          x: rand(500, 900), y: Math.tan(angle * Math.PI / 180) * 700, autoAlpha: 1, duration: rand(0.9, 1.4), ease: "power1.in",
          onComplete: () => star.remove(),
        });
      }
      gsap.delayedCall(rand(1.8, 4.2), shoot);
    };
    gsap.delayedCall(2.2, shoot);

    // Pointer: 3D depth layers, orbit tilt and headline letters that dodge the cursor
    if (finePointer) {
      const layers = $$("[data-depth]").map((el) => ({ d: +el.dataset.depth, x: gsap.quickTo(el, "x", { duration: 1.2, ease: "power3" }), y: gsap.quickTo(el, "y", { duration: 1.2, ease: "power3" }) }));
      const tilt = $("[data-orbit-tilt]");
      const tiltY = gsap.quickTo(tilt, "rotationY", { duration: 1, ease: "power3" }), tiltX = gsap.quickTo(tilt, "rotationX", { duration: 1, ease: "power3" });
      section.addEventListener("pointermove", (e) => {
        const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
        layers.forEach((l) => { l.x(-nx * 120 * l.d); l.y(-ny * 80 * l.d); });
        tiltY(nx * 30); tiltX(-ny * 22);
      });

      const chars = split.chars.map((c) => ({ el: c, y: gsap.quickTo(c, "y", { duration: 0.4, ease: "power3" }), r: gsap.quickTo(c, "rotation", { duration: 0.4, ease: "power3" }), cx: 0, cy: 0 }));
      let measured = 0;
      heading.addEventListener("pointermove", (e) => {
        const now = performance.now();
        if (now - measured > 250) {
          measured = now;
          chars.forEach((c) => { const r = c.el.getBoundingClientRect(); c.cx = r.left + r.width / 2; c.cy = r.top + r.height / 2; });
        }
        chars.forEach((c) => {
          const d = Math.hypot(e.clientX - c.cx, e.clientY - c.cy);
          const f = Math.max(0, 1 - d / 150);
          c.y(-f * 26); c.r((e.clientX < c.cx ? 1 : -1) * f * 14);
          c.el.style.color = f > 0.45 ? "var(--base-color-brand--mango)" : "";
        });
      });
      heading.addEventListener("pointerleave", () => chars.forEach((c) => { c.y(0); c.r(0); c.el.style.color = ""; }));
    }

    // Scroll out: a flat drift (no 3D tilt, so nothing snaps) while the planets move at their own depth
    mm.add("(min-width: 768px)", () => {
      gsap.timeline({ scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 1 } })
        .to(".hero_component", { yPercent: -14, scale: 0.95, autoAlpha: 0.2, transformOrigin: "50% 0%", ease: "none" }, 0)
        .to(".hero_layer.is-far", { yPercent: 25, ease: "none" }, 0)
        .to(".hero_layer.is-mid", { yPercent: 55, ease: "none" }, 0);
    });
  }

  /* ---------------- Stickers: draggable and wobbly ---------------- */
  function stickers() {
    if (reduce) return;
    $$("[data-float]").forEach((el, i) => {
      const base = gsap.getProperty(el, "rotation");
      gsap.to(el, { rotation: base + (i % 2 ? -5 : 5), duration: 2.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
      Draggable.create(el, {
        type: "x,y", inertia: true, zIndexBoost: true,
        onDragStart: () => memeToast("Yes, you can move the stickers. No, they don't do anything. Like a lot of buttons.", "sticker"),
      });
    });
  }

  /* ---------------- Marquee (direction follows the scroll) ---------------- */
  function marquee() {
    if (reduce) return;
    $$("[data-marquee-row]").forEach((row) => {
      const track = row.querySelector(".marquee_track");
      row.querySelector(".marquee_inner").append(track.cloneNode(true), track.cloneNode(true));
      const tracks = row.querySelectorAll(".marquee_track");
      const dir = +row.dataset.marqueeRow;
      const tween = dir > 0
        ? gsap.to(tracks, { xPercent: -100, duration: 26, repeat: -1, ease: "none" })
        : gsap.fromTo(tracks, { xPercent: -100 }, { xPercent: 0, duration: 26, repeat: -1, ease: "none" });
      let current = 1, lastDir = 1;
      gsap.ticker.add(() => {
        if (state.dy !== 0) lastDir = state.dy > 0 ? 1 : -1;
        const target = lastDir * (1 + Math.min(Math.abs(state.dy), 80) / 7);
        current += (target - current) * 0.08;
        tween.timeScale(current);
      });
    });
    gsap.from("[data-marquee] .marquee_inner", { xPercent: (i) => (i ? 20 : -20), autoAlpha: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: "[data-marquee]", start: "top 90%", once: true } });
  }

  /* ---------------- About ---------------- */
  function about() {
    if (reduce) return;
    const scrub = $("[data-word-scrub]");
    const split = SplitText.create(scrub.querySelectorAll("p"), { type: "words", wordsClass: "word" });
    gsap.fromTo(split.words, { opacity: 0.16 }, { opacity: 1, stagger: 0.02, ease: "none", scrollTrigger: { trigger: scrub, start: "top 78%", end: "bottom 50%", scrub: true } });

    const constellation = $("[data-constellation]");
    gsap.from(constellation.querySelector("path"), { drawSVG: 0, ease: "none", scrollTrigger: { trigger: constellation, start: "top 90%", end: "bottom 50%", scrub: true } });
    gsap.from(constellation.querySelectorAll("circle"), { scale: 0, transformOrigin: "50% 50%", stagger: 0.12, duration: 0.6, ease: "back.out(3)", scrollTrigger: { trigger: constellation, start: "top 85%", once: true } });
    gsap.to(constellation.querySelectorAll("circle"), { opacity: 0.35, duration: 1.2, stagger: { each: 0.3, repeat: -1, yoyo: true } });

    const visual = $("[data-tilt]");
    const porthole = $(".about_porthole");
    gsap.from(porthole, { rotationY: -60, scale: 0.7, autoAlpha: 0, transformPerspective: 900, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: visual, start: "top 80%", once: true } });
    mm.add("(min-width: 768px)", () => {
      gsap.fromTo("[data-parallax-inner]", { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: visual, start: "top bottom", end: "bottom top", scrub: true } });
    });
    if (finePointer) {
      const ry = gsap.quickTo(porthole, "rotationY", { duration: 0.8, ease: "power3" }), rx = gsap.quickTo(porthole, "rotationX", { duration: 0.8, ease: "power3" });
      visual.addEventListener("pointermove", (e) => {
        const r = visual.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 30); rx(-((e.clientY - r.top) / r.height - 0.5) * 30);
      });
      visual.addEventListener("pointerleave", () => { ry(0); rx(0); });
    }
  }

  /* ---------------- Services: Swiper coverflow + looping vector visuals ---------------- */
  function services() {
    const el = $("[data-services-swiper]");
    if (typeof Swiper !== "undefined") {
      new Swiper(el, {
        effect: "creative", speed: 1100, grabCursor: true, loop: false,
        creativeEffect: {
          limitProgress: 2,
          prev: { translate: ["-60%", "-10%", -900], rotate: [20, -35, -25], opacity: 0 },
          next: { translate: ["70%", "12%", -700], rotate: [-15, 40, 20], opacity: 0 },
        },
        keyboard: { enabled: true, onlyInViewport: true },
        pagination: { el: "[data-services-pagination]", clickable: true },
        navigation: { nextEl: "[data-services-next]", prevEl: "[data-services-prev]" },
        a11y: { enabled: true },
        on: {
          slideChange: (s) => { if (s.activeIndex === s.slides.length - 1) memeToast("You reached the end of the carousel. Nobody does that. Respect.", "carousel"); },
          slideChangeTransitionStart: (s) => {
            if (reduce) return;
            const slide = s.slides[s.activeIndex];
            gsap.fromTo(slide.querySelector(".services_planet"), { scale: 0.55, rotation: -60 }, { scale: 1, rotation: 0, duration: 1.3, ease: "expo.out", overwrite: "auto" });
            gsap.fromTo(slide.querySelectorAll(".services_copy > *"), { x: 90, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08, delay: 0.15, ease: "expo.out", overwrite: "auto" });
          },
        },
      });
    }
    if (reduce) return;
    gsap.from(el, { rotationX: 35, y: 140, autoAlpha: 0, transformPerspective: 1400, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });

    const loops = [];
    const ufo = $(".viz-f2w_ufo"), beam = $(".viz-f2w_path");
    loops.push(gsap.to(ufo, { motionPath: { path: beam, align: beam, alignOrigin: [0.5, 0.5] }, rotation: 360, duration: 1.8, repeat: -1, ease: "power1.inOut" }));
    loops.push(gsap.to(beam, { strokeDashoffset: -24, duration: 0.8, repeat: -1, ease: "none" }));
    const curve = $("[data-ease-curve]");
    loops.push(gsap.to("[data-ease-dot]", { motionPath: { path: curve, align: curve, alignOrigin: [0.5, 0.5] }, duration: 1.6, repeat: -1, yoyo: true, ease: "power3.inOut" }));
    const swatches = $("[data-swatches]");
    loops.push(gsap.timeline({ repeat: -1, repeatDelay: 0.5 })
      .to(swatches, { rotation: "+=90", duration: 0.9, ease: "back.inOut(1.6)" })
      .to(swatches.children, { rotation: "-=90", duration: 0.9, ease: "back.inOut(1.6)" }, "<"));
    loops.push(gsap.timeline({ repeat: -1, repeatDelay: 0.8, yoyo: true })
      .to("[data-fix-wrench]", { rotation: -40, duration: 0.25, repeat: 3, yoyo: true, transformOrigin: "80% 20%" })
      .to("[data-fix-block]", { rotation: 0, x: 0, duration: 0.6, ease: "back.out(2)" }));
    const rings = $$("[data-rings] .ring_fg");
    gsap.set(rings, { drawSVG: 0 });
    loops.push(gsap.timeline({ repeat: -1, repeatDelay: 1.4 })
      .to(rings, { drawSVG: "100%", duration: 1.1, stagger: 0.18, ease: "power2.out" })
      .to(rings, { drawSVG: "100% 100%", duration: 0.6, stagger: 0.1, ease: "power2.in" }, "+=1.2"));
    loops.forEach((l) => l.pause());
    ScrollTrigger.create({ trigger: ".section_services", start: "top bottom", end: "bottom top", onToggle: (s) => loops.forEach((l) => (s.isActive ? l.play() : l.pause())) });
  }

  /* ---------------- Work: pinned horizontal track with 3D cards ---------------- */
  const vizPlayed = new WeakSet();
  function playViz(card) {
    if (vizPlayed.has(card)) return;
    vizPlayed.add(card);
    const d = reduce ? 0 : 1;
    const gauges = card.querySelectorAll("[data-gauge]");
    gauges.forEach((g) => {
      gsap.fromTo(g, { drawSVG: 0 }, { drawSVG: `${+g.dataset.gauge * 100}%`, duration: 1.6 * d, ease: "power3.out" });
      const value = g.closest(".viz-gauge_item").querySelector(".viz-gauge_value");
      if (d) gsap.to(value, { duration: 1.2, scrambleText: { text: value.textContent, chars: "0123456789", speed: 0.5 } });
    });
    const rows = card.querySelectorAll(".viz-rounds_row");
    if (rows.length) {
      const tl = gsap.timeline();
      tl.from(rows, { x: 60, autoAlpha: 0, stagger: 0.12, duration: 0.6 * d, ease: "back.out(1.6)" });
      rows.forEach((r, i) => tl.add(() => r.querySelector(".viz-rounds_check").classList.add("is-done"), 0.6 + i * 0.35 * d)
        .from(r.querySelector(".viz-rounds_check"), { scale: 0.4, duration: 0.4 * d, ease: "back.out(3)" }, 0.6 + i * 0.35 * d));
    }
    const hills = card.querySelector("[data-hills]");
    if (hills && !reduce) {
      gsap.to(hills.querySelector("[data-hills-pill]"), { keyframes: [{ x: 80 }, { x: 160 }, { x: 80 }, { x: 0 }], duration: 5, repeat: -1, ease: "power2.inOut" });
      [1, 2, 3].forEach((n) => gsap.to(hills.querySelector(`[data-hill='${n}']`), { x: n * 14, duration: 3 + n, repeat: -1, yoyo: true, ease: "sine.inOut" }));
    }
    const grid = card.querySelector("[data-listings-grid]");
    if (grid) {
      const tiles = gsap.utils.shuffle(Array.from(grid.children));
      const counter = card.querySelector("[data-listings-count]");
      const n = { v: 56 };
      gsap.timeline({ delay: 0.3 * d })
        .to(tiles.slice(0, 35), { y: () => rand(120, 220), rotation: () => rand(-90, 90), autoAlpha: 0, duration: 0.9 * d, stagger: 0.03 * d, ease: "power2.in" })
        .to(n, { v: 21, duration: 1.4 * d, ease: "power2.out", onUpdate: () => { counter.textContent = Math.round(n.v); } }, 0);
    }
    const url = card.querySelector("[data-type-url]");
    if (url) {
      gsap.to(url, { duration: 1.2 * d, text: url.dataset.text, ease: "none", delay: 0.3 * d });
      if (!reduce) {
        gsap.to(card.querySelector(".viz-browser_caret"), { autoAlpha: 0, duration: 0.5, repeat: -1, yoyo: true, ease: "steps(1)" });
        gsap.to(card.querySelectorAll(".viz-browser_icon"), { motionPath: { path: [{ x: 0, y: 0 }, { x: 40, y: -30 }, { x: 0, y: -50 }, { x: -40, y: -20 }, { x: 0, y: 0 }], curviness: 1.5 }, duration: 4, repeat: -1, ease: "none", stagger: 2 });
      }
    }
  }
  function work() {
    const grid = $("[data-listings-grid]");
    for (let i = 0; i < 56; i++) grid.append(document.createElement("i"));

    const track = $("[data-work-track]");
    const pin = $("[data-work-pin]");
    const cards = $$("[data-work-card]");
    const bar = $("[data-work-progress]");

    mm.add("(min-width: 992px) and (prefers-reduced-motion: no-preference)", () => {
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = gsap.to(track, {
        x: () => -distance(), ease: "none",
        scrollTrigger: {
          trigger: pin, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 1, invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
        },
      });
      // Depth without distortion: ghost titles and planets drift at their own speed, screens stay flat
      cards.forEach((card) => {
        const ghost = card.querySelector(".work_ghost"), orb = card.querySelector(".work_orb"), chip = card.querySelector(".work_chip");
        const st = { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true };
        if (ghost) gsap.fromTo(ghost, { xPercent: 18 }, { xPercent: -18, ease: "none", scrollTrigger: st });
        if (orb) gsap.fromTo(orb, { x: 140 }, { x: -140, ease: "none", scrollTrigger: { ...st } });
        if (chip) gsap.fromTo(chip, { y: 60 }, { y: -60, ease: "none", scrollTrigger: { ...st } });
      });
      cards.forEach((card) => ScrollTrigger.create({ trigger: card, containerAnimation: tween, start: "left 85%", once: true, onEnter: () => playViz(card) }));

    });
    mm.add("(max-width: 991px), (prefers-reduced-motion: reduce)", () => {
      cards.forEach((card) => ScrollTrigger.create({ trigger: card, start: "top 75%", once: true, onEnter: () => playViz(card) }));
      if (!reduce) gsap.utils.toArray(cards).forEach((card) => gsap.from(card, { y: 80, rotationX: -18, transformPerspective: 1000, autoAlpha: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: card, start: "top 88%", once: true } }));
    });

    if (!reduce) gsap.to(".work_orb", { y: -16, rotation: 4, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.6 });

    // Full-page screenshots: hover (or scroll into view on touch) runs down the whole page
    $$("[data-shot]").forEach((shot) => {
      const img = shot.querySelector("[data-shot-image]");
      const viewport = shot.querySelector(".shot_viewport");
      let tween;
      const travel = () => Math.max(0, img.offsetHeight - viewport.offsetHeight);
      const down = () => { tween?.kill(); const t = travel(); tween = gsap.to(img, { y: -t, duration: Math.max(2.5, t / 500), ease: "power1.inOut" }); memeToast("Real sites. Real browser. Not a Dribbble shot.", "shot"); };
      const up = () => { tween?.kill(); tween = gsap.to(img, { y: 0, duration: 1.1, ease: "power3.out" }); };
      if (finePointer) {
        shot.addEventListener("pointerenter", down);
        shot.addEventListener("pointerleave", up);
      } else if (!reduce) {
        ScrollTrigger.create({ trigger: shot, start: "top 70%", end: "bottom 20%", onEnter: down, onEnterBack: down, onLeave: up, onLeaveBack: up });
      }
      shot.addEventListener("focus", down);
      shot.addEventListener("blur", up);
    });
  }

  /* ---------------- How I work: 3D cylinder turned by scroll ---------------- */
  function how() {
    const pin = $("[data-how-pin]");
    const ring = $("[data-how-ring]");
    const cards = $$("[data-how-card]");
    const n = cards.length, step = 360 / n;

    mm.add("(min-width: 992px) and (prefers-reduced-motion: no-preference)", () => {
      const radius = Math.round(cards[0].offsetWidth / 2 / Math.tan(Math.PI / n)) + 60;
      gsap.set(ring, { transformOrigin: `50% 50% ${-radius}px`, z: 0 });
      cards.forEach((c, i) => gsap.set(c, { rotationY: i * step, transformOrigin: `50% 50% ${-radius}px` }));
      const faces = () => {
        const rot = gsap.getProperty(ring, "rotationY");
        cards.forEach((c, i) => {
          let a = ((i * step + rot) % 360 + 540) % 360 - 180;
          const t = Math.min(Math.abs(a), 50) / 50;
          gsap.set(c, { autoAlpha: 1 - t * t * 0.96 });
        });
      };
      gsap.to(ring, {
        rotationY: -step * (n - 1), ease: "none",
        scrollTrigger: {
          trigger: pin, start: "top top", end: () => `+=${innerHeight * 3.2}`, pin: true, scrub: 1,
          snap: { snapTo: 1 / (n - 1), duration: { min: 0.3, max: 0.7 }, ease: "power2.inOut" },
          onUpdate: (self) => { faces(); if (self.progress > 0.5) memeToast("Six rules. Zero exceptions. Okay, one exception. See card one.", "rules"); },
        },
      });
      faces();
      gsap.to(".how_orbit", { scale: 1.04, duration: 2.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
      const drake = $(".drake_component");
      gsap.from(drake, { scale: 0, rotation: -25, duration: 0.8, ease: "back.out(2)", scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${innerHeight}`, toggleActions: "play none none reverse" } });
      return () => gsap.set([ring, ...cards], { clearProps: "all" });
    });
    mm.add("(max-width: 991px) and (prefers-reduced-motion: no-preference)", () => {
      gsap.from(cards, { y: 60, rotationY: -25, transformPerspective: 900, autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: ring, start: "top 85%", once: true } });
    });
  }

  /* ---------------- Toolkit: zero-gravity physics with Matter.js ---------------- */
  function toolkit() {
    const box = $("[data-toolkit-box]");
    if (reduce || typeof Matter === "undefined") return;
    mm.add("(min-width: 768px)", () => {
      let engine, runner, bodies = [], walls = [], cleanup = () => {};
      const start = () => {
        const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;
        box.classList.add("is-physics");
        const pills = $$("[data-pill]", box);
        const W = box.clientWidth, H = box.clientHeight, T = 400;
        engine = Engine.create();
        toolkitEngine = engine;
        engine.gravity.y = state.gravity ? 1 : 0;
        const wallOpts = { isStatic: true, restitution: 1 };
        walls = [
          Bodies.rectangle(W / 2, H + T / 2, W * 3, T, wallOpts),
          Bodies.rectangle(W / 2, -T / 2, W * 3, T, wallOpts),
          Bodies.rectangle(-T / 2, H / 2, T, H * 3, wallOpts),
          Bodies.rectangle(W + T / 2, H / 2, T, H * 3, wallOpts),
        ];
        bodies = pills.map((el) => {
          const w = el.offsetWidth, h = el.offsetHeight;
          const b = Bodies.rectangle(W / 2 + rand(-80, 80), H / 2 + rand(-50, 50), w, h, { chamfer: { radius: h / 2 - 1 }, restitution: 0.85, frictionAir: 0.008, friction: 0.02, density: 0.002 });
          b.el = el; b.w = w; b.h = h;
          Body.setVelocity(b, { x: rand(-14, 14), y: rand(-14, 14) });
          Body.setAngularVelocity(b, rand(-0.06, 0.06));
          return b;
        });
        const mouse = Mouse.create(box);
        box.removeEventListener("wheel", mouse.mousewheel);
        if (!finePointer) {
          box.removeEventListener("touchmove", mouse.mousemove);
          box.removeEventListener("touchstart", mouse.mousedown);
          box.removeEventListener("touchend", mouse.mouseup);
        }
        const release = () => { mouse.button = -1; };
        addEventListener("mouseup", release);
        const grab = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, render: { visible: false } } });
        let throws = 0;
        Events.on(grab, "enddrag", (e) => {
          throws++;
          const name = e.body?.el?.textContent.trim();
          if (throws === 2 && name) memeToast(`You yeeted ${name} into orbit. Bold.`, "yeet");
          if (throws === 6) memeToast("Okay, the tools have unionised. Please be gentle.", "union");
        });
        Composite.add(engine.world, [...walls, ...bodies, grab]);
        Events.on(engine, "afterUpdate", () => {
          for (const b of bodies) b.el.style.transform = `translate(${b.position.x - b.w / 2}px, ${b.position.y - b.h / 2}px) rotate(${b.angle}rad)`;
        });
        // A gentle nudge now and then keeps everything floating in zero gravity
        const nudge = gsap.delayedCall(3, function again() {
          if (!state.gravity) bodies.forEach((b) => Body.applyForce(b, b.position, { x: rand(-0.0015, 0.0015) * b.mass, y: rand(-0.0015, 0.0015) * b.mass }));
          nudge.restart(true);
        });
        runner = Runner.create();
        Runner.run(runner, engine);
        const inView = ScrollTrigger.create({ trigger: box, start: "top bottom", end: "bottom top", onToggle: (s) => { runner.enabled = s.isActive; } });
        cleanup = () => {
          Runner.stop(runner); Engine.clear(engine); nudge.kill(); inView.kill();
          removeEventListener("mouseup", release);
          box.classList.remove("is-physics");
          pills.forEach((p) => { p.style.transform = ""; });
          toolkitEngine = null;
        };
      };
      const trigger = ScrollTrigger.create({ trigger: box, start: "top 75%", once: true, onEnter: start });
      return () => { trigger.kill(); cleanup(); };
    });
  }

  /* ---------------- System: wires drawn by scroll, signals along them ---------------- */
  function system() {
    const diagram = $("[data-diagram]");
    const svg = $("[data-wires]");
    const NS = "http://www.w3.org/2000/svg";
    let ctx;
    const build = () => {
      ctx?.revert();
      svg.innerHTML = "";
      const base = diagram.getBoundingClientRect();
      const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, cx: r.left - base.left + r.width / 2, cy: r.top - base.top + r.height / 2 }; };
      const core = box($("[data-node-core]")), out = box($("[data-node-out]"));
      const vertical = getComputedStyle(diagram).gridTemplateColumns.split(" ").length < 2;
      const d = [];
      $$("[data-node-in]").forEach((n, i) => {
        const a = box(n);
        if (vertical) d.push(`M${a.l} ${a.cy} C${a.l - 30 - i * 10} ${a.cy}, ${core.l - 60} ${core.cy}, ${core.cx} ${core.cy}`);
        else d.push(`M${a.r} ${a.cy} C${(a.r + core.cx) / 2} ${a.cy}, ${(a.r + core.cx) / 2} ${core.cy}, ${core.cx} ${core.cy}`);
      });
      if (vertical) d.push(`M${core.cx} ${core.cy} C${core.cx} ${(core.cy + out.t) / 2}, ${out.cx} ${(core.cy + out.t) / 2}, ${out.cx} ${out.t}`);
      else d.push(`M${core.cx} ${core.cy} C${(core.cx + out.l) / 2} ${core.cy}, ${(core.cx + out.l) / 2} ${out.cy}, ${out.l} ${out.cy}`);
      ctx = gsap.context(() => {
        d.forEach((path, i) => {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", path);
          svg.append(p);
          if (reduce) return;
          gsap.from(p, { drawSVG: 0, ease: "none", scrollTrigger: { trigger: diagram, start: "top 80%", end: "center 55%", scrub: true } });
          for (let k = 0; k < 2; k++) {
            const dot = document.createElementNS(NS, "circle");
            dot.setAttribute("r", "5");
            svg.append(dot);
            gsap.fromTo(dot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, repeat: -1, repeatDelay: 1.9, delay: i * 0.35 + k * 1.1 });
            gsap.to(dot, { motionPath: { path: p }, duration: 2.2, repeat: -1, ease: "power1.inOut", delay: i * 0.35 + k * 1.1 });
          }
        });
      }, diagram);
    };
    build();
    let resizeTimer;
    addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 250); });
    document.fonts?.ready.then(build);
    if (reduce) return;
    gsap.from("[data-node-in], [data-node-out]", { scale: 0.6, autoAlpha: 0, stagger: 0.12, duration: 0.8, ease: "back.out(2)", scrollTrigger: { trigger: diagram, start: "top 80%", once: true } });
    gsap.to("[data-node-core]", { scale: 1.06, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    $$("[data-brain]").forEach((row, i) => {
      gsap.from(row, { x: i % 2 ? 80 : -80, autoAlpha: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: row, start: "top 88%", once: true } });
      gsap.from(row.querySelector(".brain_icon path"), { scale: 0.6 + i * 0.1, transformOrigin: "50% 50%", duration: 1.2, ease: "elastic.out(1, 0.5)", scrollTrigger: { trigger: row, start: "top 85%", once: true } });
    });
  }

  /* ---------------- Generic reveals ---------------- */
  function reveals() {
    if (reduce) return;
    gsap.set("[data-reveal]", { y: 50, rotationX: -14, transformPerspective: 900, autoAlpha: 0 });
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%", once: true,
      onEnter: (els) => gsap.to(els, { y: 0, rotationX: 0, autoAlpha: 1, stagger: 0.1, duration: 0.9, ease: "expo.out" }),
    });
  }

  /* ---------------- Off the clock: photo deck + mini game ---------------- */
  function offTheClock() {
    if (typeof Swiper !== "undefined") {
      new Swiper("[data-photos-swiper]", {
        effect: "cards", grabCursor: true, speed: 500,
        cardsEffect: { perSlideOffset: 9, perSlideRotate: 3, rotate: true, slideShadows: false },
        keyboard: { enabled: true, onlyInViewport: true },
        a11y: { enabled: true },
        on: { slideChange: (s) => { if (s.activeIndex === 1) memeToast("Yes, a 1993 Corolla. Big Body gang.", "corolla"); } },
      });
    }
    game();
  }

  function game() {
    const canvas = $("[data-game-canvas]");
    const ctx = canvas.getContext("2d");
    const startBtn = $("[data-game-start]");
    const scoreEl = $("[data-game-score]"), bestEl = $("[data-game-best]");
    const W = 640, H = 260;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let best = 0;
    try { best = +localStorage.getItem("eq-game-best") || 0; } catch (e) { best = 0; }
    bestEl.textContent = best;
    const dots = Array.from({ length: 50 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.4, 1.4), v: rand(10, 40) }));
    const ship = { x: W / 2, y: H - 36, tx: W / 2 };
    let rocks = [], running = false, score = 0, spawn = 0, keys = { left: false, right: false };

    const drawShip = () => {
      ctx.save(); ctx.translate(ship.x, ship.y);
      ctx.fillStyle = "#ffb547"; ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(0, 24 + Math.random() * 8); ctx.lineTo(6, 14); ctx.fill();
      ctx.fillStyle = "#f4f2ff"; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(12, -4, 9, 14); ctx.lineTo(-9, 14); ctx.quadraticCurveTo(-12, -4, 0, -18); ctx.fill();
      ctx.fillStyle = "#ff5fa2"; ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(-16, 16); ctx.lineTo(-8, 14); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, 6); ctx.lineTo(16, 16); ctx.lineTo(8, 14); ctx.fill();
      ctx.fillStyle = "#3fa9ff"; ctx.beginPath(); ctx.arc(0, -2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const drawRock = (r) => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
      ctx.fillStyle = "#6d5bd0"; ctx.beginPath();
      r.shape.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(7,10,31,0.35)"; ctx.beginPath(); ctx.arc(r.size * 0.25, -r.size * 0.2, r.size * 0.22, 0, Math.PI * 2); ctx.fill();
      if (state.meme) { ctx.rotate(-r.a); ctx.fillStyle = "#f4f2ff"; ctx.font = "700 11px 'General Sans', sans-serif"; ctx.textAlign = "center"; ctx.fillText("bug", 0, 4); }
      ctx.restore();
    };
    const render = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#f4f2ff";
      dots.forEach((d) => { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
      rocks.forEach(drawRock);
      drawShip();
    };
    const end = () => {
      running = false;
      gsap.ticker.remove(tick);
      const final = Math.floor(score);
      if (final > best) {
        best = final; bestEl.textContent = best;
        try { localStorage.setItem("eq-game-best", String(best)); } catch (e) { /* storage blocked */ }
        if (final > 20) memeToast(`New best: ${final}. Put it on the CV.`);
      }
      startBtn.querySelector("span").textContent = state.meme ? "You shipped a bug. Again?" : "Play again";
      startBtn.hidden = false;
      if (!reduce) gsap.fromTo(canvas, { x: -8 }, { x: 8, duration: 0.05, repeat: 7, yoyo: true, clearProps: "x" });
    };
    const tick = (time, deltaMs) => {
      const dt = Math.min(deltaMs, 50) / 1000;
      score += dt * 10; scoreEl.textContent = Math.floor(score);
      if (keys.left) ship.tx -= 420 * dt;
      if (keys.right) ship.tx += 420 * dt;
      ship.tx = gsap.utils.clamp(16, W - 16, ship.tx);
      ship.x += (ship.tx - ship.x) * Math.min(1, dt * 12);
      dots.forEach((d) => { d.y += d.v * dt * 3; if (d.y > H) { d.y = 0; d.x = rand(0, W); } });
      spawn -= dt;
      if (spawn <= 0) {
        const size = rand(12, 24);
        rocks.push({ x: rand(20, W - 20), y: -30, vy: rand(110, 180) + score * 2.2, size, a: 0, va: rand(-2, 2), shape: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2, rr = size * rand(0.75, 1.1); return [Math.cos(a) * rr, Math.sin(a) * rr]; }) });
        spawn = Math.max(0.22, 0.75 - score * 0.006);
      }
      rocks.forEach((r) => { r.y += r.vy * dt; r.a += r.va * dt; });
      rocks = rocks.filter((r) => r.y < H + 40);
      for (const r of rocks) if (Math.hypot(r.x - ship.x, r.y - ship.y) < r.size * 0.85 + 11) { render(); end(); return; }
      render();
    };
    const toCanvasX = (clientX) => { const rect = canvas.getBoundingClientRect(); return ((clientX - rect.left) / rect.width) * W; };
    canvas.addEventListener("pointermove", (e) => { if (running) ship.tx = toCanvasX(e.clientX); });
    canvas.addEventListener("pointerdown", (e) => { if (running) ship.tx = toCanvasX(e.clientX); });
    addEventListener("keydown", (e) => {
      if (!running) return;
      if (e.key === "ArrowLeft") { keys.left = true; e.preventDefault(); }
      if (e.key === "ArrowRight") { keys.right = true; e.preventDefault(); }
    });
    addEventListener("keyup", (e) => { if (e.key === "ArrowLeft") keys.left = false; if (e.key === "ArrowRight") keys.right = false; });
    startBtn.addEventListener("click", () => {
      rocks = []; score = 0; spawn = 0.6; ship.x = ship.tx = W / 2;
      startBtn.hidden = true; running = true;
      memeToast("Dodge the bugs. Production is watching.", "game");
      gsap.ticker.add(tick);
    });
    render();
  }

  /* ---------------- Contact: hold to publish, the rocket launches ---------------- */
  function contact() {
    const btn = $("[data-launch-button]");
    const ring = $("[data-launch-ring]");
    const rocket = $("[data-rocket]");
    const fire = $("[data-fire]");
    const hint = $("[data-launch-hint]");
    const smoke = $("[data-smoke]");
    const NS = "http://www.w3.org/2000/svg";
    const hintText = hint.textContent;
    let launched = false;
    gsap.set(fire, { scaleY: 0.3, transformOrigin: "50% 0%" });
    gsap.set(ring, { drawSVG: 0 });
    if (!reduce) gsap.to(fire, { scaleX: 0.8, duration: 0.07, repeat: -1, yoyo: true, transformOrigin: "50% 0%" });

    const charge = gsap.timeline({ paused: true, onComplete: () => launch() })
      .to(ring, { drawSVG: "100%", duration: 1.4, ease: "none" }, 0)
      .to(fire, { scaleY: 0.85, duration: 1.4, ease: "power1.in" }, 0)
      .to(rocket, { x: 2.5, duration: 0.05, repeat: 27, yoyo: true, ease: "none" }, 0);

    const press = () => {
      if (launched) return;
      charge.timeScale(1).play();
      hint.textContent = state.meme ? "Hold... hold... (this is the yes)" : "Hold...";
    };
    const releaseHold = () => {
      if (launched || charge.progress() === 0) return;
      charge.timeScale(3).reverse();
      hint.textContent = state.meme ? "Commitment issues? Relatable." : hintText;
    };
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, releaseHold));
    btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); press(); } });
    btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") releaseHold(); });
    btn.addEventListener("contextmenu", (e) => e.preventDefault());

    function launch() {
      launched = true;
      hint.textContent = state.meme ? "Published. Client replied: can we make the logo bigger?" : "Published.";
      const d = reduce ? 0.01 : 1;
      const puffs = Array.from({ length: 16 }, () => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", "120"); c.setAttribute("cy", "285"); c.setAttribute("r", String(rand(8, 18)));
        smoke.append(c);
        return c;
      });
      const tl = gsap.timeline({ onComplete: () => land() });
      tl.to(fire, { scaleY: 1.6, duration: 0.25 * d }, 0)
        .fromTo(puffs, { scale: 0, autoAlpha: 1, transformOrigin: "50% 50%" }, { scale: () => rand(1.5, 3), x: () => rand(-120, 120), y: () => rand(-30, 15), autoAlpha: 0, duration: 1.6 * d, stagger: 0.02, ease: "power2.out", onComplete: () => puffs.forEach((p) => p.remove()) }, 0)
        .to(rocket, { x: 0, y: -1100, duration: 1.7 * d, ease: "power2.in" }, 0.15)
        .to(state, { boost: 0.022, duration: 0.6 * d, ease: "power2.in" }, 0.3)
        .to(state, { boost: 0, duration: 1.4 * d, ease: "power2.out" }, 1.4);
      if (!reduce) gsap.fromTo(".section_contact", { x: -5 }, { x: 5, duration: 0.04, repeat: 11, yoyo: true, clearProps: "x" });
      memeToast("Houston, it's live. (On localhost. Pushing needs Eugene's yes.)", "launch");
    }
    function land() {
      gsap.timeline({ delay: reduce ? 0 : 1.2, onComplete: () => { launched = false; hint.textContent = hintText; } })
        .set(rocket, { y: -700 })
        .to(rocket, { y: 0, duration: reduce ? 0 : 1.6, ease: "power3.out" })
        .to(fire, { scaleY: 0.3, duration: 0.5 }, "-=0.5")
        .to(ring, { drawSVG: 0, duration: 0.4 }, "<");
      charge.pause(0);
    }
  }

  /* ---------------- Footer wordmark ---------------- */
  function footer() {
    if (reduce) return;
    const mark = $("[data-wordmark]");
    const split = SplitText.create(mark, { type: "chars", charsClass: "char" });
    gsap.from(split.chars, { yPercent: 100, rotationX: -90, transformPerspective: 700, stagger: 0.04, ease: "back.out(1.6)", scrollTrigger: { trigger: mark, start: "top 95%", end: "bottom 85%", scrub: 1 } });
    if (finePointer) split.chars.forEach((c) => c.addEventListener("pointerenter", () => {
      gsap.fromTo(c, { y: 0 }, { y: -30, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.out" });
      gsap.fromTo(c, { color: "#ffb547" }, { color: "transparent", duration: 1.2 });
    }));
  }

  /* ---------------- Easter eggs ---------------- */
  function easterEggs() {
    const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let pos = 0;
    addEventListener("keydown", (e) => {
      pos = e.key === code[pos] ? pos + 1 : (e.key === code[0] ? 1 : 0);
      if (pos < code.length) return;
      pos = 0;
      toast("Cheat code accepted: unlimited revisions. (Not really.)");
      document.body.classList.add("is-comic");
      gsap.delayedCall(4, () => document.body.classList.remove("is-comic"));
      if (reduce) return;
      const colours = ["#ffb547", "#ff5fa2", "#7b5cff", "#3fa9ff", "#3ddc97"];
      for (let i = 0; i < 60; i++) {
        const s = document.createElement("span");
        s.className = "konami-star";
        s.style.background = colours[i % colours.length];
        document.body.append(s);
        gsap.fromTo(s, { left: innerWidth / 2, top: innerHeight / 2, scale: 0 }, {
          x: rand(-innerWidth / 2, innerWidth / 2), y: rand(-innerHeight / 2, innerHeight / 2), scale: rand(0.6, 2), rotation: rand(-360, 360),
          duration: rand(1, 2), ease: "expo.out", onComplete: () => gsap.to(s, { autoAlpha: 0, duration: 0.5, onComplete: () => s.remove() }),
        });
      }
    });

    const title = document.title;
    document.addEventListener("visibilitychange", () => {
      document.title = document.hidden && state.meme ? "Come back, the divs miss you" : title;
    });
    document.addEventListener("copy", () => memeToast("Copying my homework? At least credit the source.", "copy"));

    let idle;
    const resetIdle = () => { clearTimeout(idle); idle = setTimeout(() => memeToast("Still there? Houston is getting worried.", "idle"), 30000); };
    ["pointermove", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, resetIdle, { passive: true }));
    resetIdle();

    console.log("%c🚀 Inspecting the code? Respect.", "font: 800 20px sans-serif; color: #ffb547");
    console.log("%cBuilt with GSAP, Lenis, Swiper and Matter.js. Client-First classes all the way down. Try the Konami code.", "color: #c9c4ec");
  }

  /* ---------------- Run, in page order ---------------- */
  menu();
  hero();
  splitHeadings();
  stickers();
  marquee();
  about();
  services();
  work();
  how();
  toolkit();
  system();
  offTheClock();
  contact();
  footer();
  reveals();
  easterEggs();

  // Nebula triggers are made last, then everything is sorted so pins are accounted for
  $$("[data-section]").forEach((section) => ScrollTrigger.create({
    trigger: section, start: "top 55%", end: "bottom 55%",
    onToggle: (s) => { if (s.isActive) setNebula(section.dataset.section); },
  }));
  ScrollTrigger.sort();
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  addEventListener("load", refresh);
})();
