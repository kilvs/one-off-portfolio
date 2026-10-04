/* ==========================================================================
   One-Off Portfolio: the cosmos (Three.js 0.186).
   Three particle systems on one fixed canvas behind the page:
   1. Travel stars that fly at the camera; speed follows the scroll, the
      Warp switch and the rocket launch.
   2. A spiral galaxy that the hero sits in front of.
   3. A cloud of particles that morphs into a new shape per section
      (data-shape on each section): planet, torus knot, helix, cube, EQ.
   Clicking empty space sets off a supernova. If WebGL or the module fails,
   the 2D starfield in landing.js takes over.

   Performance (4 Oct 2026): quality tiers by device, 60fps cap on touch,
   paused while hidden or under the menu, morphs run on the GPU, the
   buffer ignores the mobile toolbar resizing, and quality drops further
   if frames run slow.
   ========================================================================== */
const EQ = window.EQ || {};
const canvas = document.querySelector("[data-cosmos]");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

import("https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.min.js")
  .then((THREE) => init(THREE))
  .catch((err) => {
    console.warn("Cosmos: falling back to the 2D starfield.", err);
    EQ.starfield?.();
  });

function init(THREE) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  } catch (e) {
    EQ.starfield?.();
    return;
  }
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  // Quality tier: 0 phones and low-end, 1 tablets, 2 desktop (unchanged look)
  const coarse = matchMedia("(pointer: coarse)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const shortSide = Math.min(screen.width, screen.height);
  const tier = !coarse ? 2 : (shortSide < 768 || cores <= 4 || memory <= 3) ? 0 : 1;
  const Q = [
    { dpr: 1, stars: 1600, galaxy: 9000, cloud: 3500, opacity: 0.6 },
    { dpr: 1.25, stars: 2600, galaxy: 16000, cloud: 5000, opacity: 0.7 },
    { dpr: 1.75, stars: 6500, galaxy: 42000, cloud: 12000, opacity: 0.85 },
  ][tier];
  const small = innerWidth < 768; // layout only

  let pixelRatio = Math.min(window.devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(pixelRatio);
  let bufW = innerWidth, bufH = innerHeight;
  renderer.setSize(bufW, bufH, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, bufW / bufH, 0.1, 400);
  camera.position.set(0, 0, 10);

  const rand = (a, b) => a + Math.random() * (b - a);
  const colour = (hex) => new THREE.Color(hex);
  const cloudPalette = ["#ffffff", "#7b5cff", "#a995ff", "#ff5fa2", "#ffb547", "#3fa9ff"].map(colour);
  const starPalette = ["#ffffff", "#ffffff", "#ffffff", "#d4ccff", "#a8dbff", "#ffd59a", "#ffb0d0"].map(colour);

  /* ---------- One point shader for all three systems ---------- */
  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    attribute vec3 aColor;
    uniform float uTime;
    uniform float uPixel;
    uniform float uTravel;
    uniform float uDepth;
    uniform float uPulse;
    #ifdef MORPH
      attribute vec3 aTarget;
      attribute float aDelay;
      uniform float uMorph;
    #endif
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec3 p = position;
      #ifdef MORPH
        float k = clamp((uMorph - aDelay) / 0.65, 0.0, 1.0);
        p = mix(position, aTarget, k * k * (3.0 - 2.0 * k));
      #endif
      #ifdef TRAVEL
        p.z = mod(p.z + uTravel, uDepth) - uDepth + 12.0;
      #endif
      #ifdef PULSE
        float len = max(length(p), 0.001);
        p += (p / len) * uPulse * (2.5 + sin(aPhase) * 1.5);
      #endif
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float twinkle = 0.6 + 0.4 * sin(uTime * 1.8 + aPhase);
      float fade = 1.0 - smoothstep(-3.0, -0.4, mv.z);
      gl_PointSize = max(aSize * uPixel * twinkle * (55.0 / -mv.z), 0.0) * fade;
      vColor = aColor;
      vAlpha = twinkle * fade;
    }
  `;
  const fragmentShader = /* glsl */ `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = 1.0 - d * 2.0;
      a *= a;
      gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
    }
  `;
  const makeMaterial = (defines = {}, opacity = 1) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, defines,
    uniforms: {
      uTime: { value: 0 }, uPixel: { value: pixelRatio }, uTravel: { value: 0 },
      uDepth: { value: 150 }, uPulse: { value: 0 }, uOpacity: { value: opacity }, uMorph: { value: 1 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const makePoints = (positions, colours, sizes, material) => {
    const geo = new THREE.BufferGeometry();
    const n = positions.length / 3;
    const phases = new Float32Array(n);
    for (let i = 0; i < n; i++) phases[i] = Math.random() * Math.PI * 2;
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colours, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    const pts = new THREE.Points(geo, material);
    pts.frustumCulled = false;
    return pts;
  };

  /* ---------- 1. Travel stars ---------- */
  const starCount = Q.stars;
  const starMat = makeMaterial({ TRAVEL: "" }, 1);
  const stars = (() => {
    const pos = new Float32Array(starCount * 3), col = new Float32Array(starCount * 3), size = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = rand(-70, 70); pos[i * 3 + 1] = rand(-45, 45); pos[i * 3 + 2] = rand(0, 150);
      const c = starPalette[(Math.random() * starPalette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = rand(0.5, 2.2);
    }
    const pts = makePoints(pos, col, size, starMat);
    scene.add(pts);
    return pts;
  })();

  /* ---------- 2. Spiral galaxy ---------- */
  const galaxyCount = Q.galaxy;
  const galaxyMat = makeMaterial({}, 0.9);
  const galaxy = (() => {
    const R = 11, branches = 4, spin = 1.15, randomness = 0.42;
    const inside = colour("#ffcf86"), mid = colour("#ff5fa2"), outside = colour("#5b6dff");
    const pos = new Float32Array(galaxyCount * 3), col = new Float32Array(galaxyCount * 3), size = new Float32Array(galaxyCount);
    const tmp = new THREE.Color();
    for (let i = 0; i < galaxyCount; i++) {
      const r = Math.pow(Math.random(), 1.4) * R;
      const branch = ((i % branches) / branches) * Math.PI * 2;
      const angle = branch + r * spin;
      const scatter = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * randomness * (r + 0.6);
      pos[i * 3] = Math.cos(angle) * r + scatter();
      pos[i * 3 + 1] = scatter() * 0.35;
      pos[i * 3 + 2] = Math.sin(angle) * r + scatter();
      const t = r / R;
      if (t < 0.35) tmp.copy(inside).lerp(mid, t / 0.35); else tmp.copy(mid).lerp(outside, (t - 0.35) / 0.65);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      size[i] = t < 0.08 ? rand(1.2, 2.6) : rand(0.35, 1.3);
    }
    const pts = makePoints(pos, col, size, galaxyMat);
    const group = new THREE.Group();
    group.add(pts);
    group.rotation.set(1.05, 0, 0.35);
    group.position.set(small ? 0 : 3.5, small ? 1.5 : -0.2, -5);
    scene.add(group);
    return { group, pts };
  })();

  /* ---------- 3. Morphing cloud (the morph runs in the vertex shader) ---------- */
  const N = Q.cloud;
  const shapes = {};
  const fill = (fn) => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const [x, y, z] = fn(i); a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; } return a; };
  const randomInSphere = (r) => { const u = Math.random(), v = Math.random(), th = u * Math.PI * 2, ph = Math.acos(2 * v - 1), rr = r * Math.cbrt(Math.random()); return [rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph)]; };
  shapes.galaxy = fill(() => randomInSphere(16));
  shapes.scatter = fill(() => randomInSphere(7.5));
  shapes.planet = fill((i) => {
    if (i < N * 0.68) {
      const k = i + 0.5, n = N * 0.68, phi = Math.acos(1 - (2 * k) / n), th = Math.PI * (1 + Math.sqrt(5)) * k;
      const r = 2.6 + rand(-0.04, 0.04);
      return [r * Math.cos(th) * Math.sin(phi), r * Math.sin(th) * Math.sin(phi), r * Math.cos(phi)];
    }
    const a = Math.random() * Math.PI * 2, r = rand(3.5, 5.2), tilt = 0.42;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = rand(-0.05, 0.05);
    return [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
  });
  shapes.torus = fill(() => {
    const t = Math.random() * Math.PI * 2, p = 2, q = 3, R = 2.6, tube = 0.55;
    const r = R + Math.cos(q * t) * 1.1;
    const cx = r * Math.cos(p * t), cy = r * Math.sin(p * t), cz = Math.sin(q * t) * 1.1;
    const a = Math.random() * Math.PI * 2, rr = tube * Math.sqrt(Math.random());
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cz + rand(-rr, rr)];
  });
  shapes.helix = fill((i) => {
    const strand = i % 3, t = rand(-1, 1) * Math.PI * 3, y = t * 0.62, r = 1.9;
    if (strand === 2) { const s = rand(-1, 1); const a = Math.round(t / 0.6) * 0.6; return [Math.cos(a) * r * s, Math.round(t / 0.6) * 0.6 * 0.62, Math.sin(a) * r * s]; }
    const a = t + strand * Math.PI;
    return [Math.cos(a) * r + rand(-0.12, 0.12), y + rand(-0.12, 0.12), Math.sin(a) * r + rand(-0.12, 0.12)];
  });
  shapes.cube = fill((i) => {
    const s = 2.7;
    if (i % 4 === 0) { const g = () => Math.round(rand(-2, 2)) / 2 * s; return [g(), g(), g()].map((v) => v + rand(-0.05, 0.05)); }
    const axis = (Math.random() * 3) | 0, pick = () => (Math.random() < 0.5 ? -s : s), along = rand(-s, s);
    const p = [pick(), pick(), pick()]; p[axis] = along;
    return p;
  });
  const makeText = () => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 300;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "800 250px 'Bricolage Grotesque', 'Arial Black', sans-serif";
    x.fillText("EQ", 300, 160);
    const data = x.getImageData(0, 0, 600, 300).data, pts = [];
    for (let py = 0; py < 300; py += 2) for (let px = 0; px < 600; px += 2) if (data[(py * 600 + px) * 4 + 3] > 128) pts.push([(px - 300) / 60, -(py - 150) / 60]);
    return fill(() => { const p = pts[(Math.random() * pts.length) | 0] || [0, 0]; return [p[0] + rand(-0.04, 0.04), p[1] + rand(-0.04, 0.04), rand(-0.35, 0.35)]; });
  };
  // Build the EQ shape once fonts are in, in idle time, never mid-scroll
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => idle(() => { shapes.text = makeText(); }));

  const cloudMat = makeMaterial({ PULSE: "", MORPH: "" }, Q.opacity);
  const delays = new Float32Array(N);
  for (let i = 0; i < N; i++) delays[i] = Math.random() * 0.35;
  const cloud = (() => {
    const col = new Float32Array(N * 3), size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const c = cloudPalette[(Math.random() * cloudPalette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = rand(0.45, 1.35);
    }
    const pts = makePoints(new Float32Array(shapes.galaxy), col, size, cloudMat);
    const target = new THREE.BufferAttribute(new Float32Array(shapes.galaxy), 3);
    pts.geometry.setAttribute("aTarget", target);
    pts.geometry.setAttribute("aDelay", new THREE.BufferAttribute(delays, 1));
    const group = new THREE.Group();
    group.add(pts);
    scene.add(group);
    return { group, pts, from: pts.geometry.getAttribute("position"), target };
  })();

  const uMorph = cloudMat.uniforms.uMorph;
  const smooth = (x) => x * x * (3 - 2 * x);
  let activeShape = "galaxy";
  const sideTarget = { x: 0, y: 0, scale: 1 };
  function setShape(name, side) {
    if (name === "text" && !shapes.text) shapes.text = makeText();
    const target = shapes[name];
    if (!target) return;
    sideTarget.x = small ? 0 : side * 4.2;
    sideTarget.y = small ? 2 : 0;
    sideTarget.scale = name === "galaxy" ? 1 : (small ? 0.75 : 1);
    if (name === activeShape) return;
    activeShape = name;
    // Snapshot where the points are now (one CPU pass per change), then morph on the GPU
    const from = cloud.from.array, tgt = cloud.target.array, t = uMorph.value;
    for (let i = 0; i < N; i++) {
      const k = smooth(Math.min(1, Math.max(0, (t - delays[i]) / 0.65)));
      const j = i * 3;
      from[j] += (tgt[j] - from[j]) * k;
      from[j + 1] += (tgt[j + 1] - from[j + 1]) * k;
      from[j + 2] += (tgt[j + 2] - from[j + 2]) * k;
    }
    tgt.set(target);
    cloud.from.needsUpdate = true;
    cloud.target.needsUpdate = true;
    if (reduce || !gsap) { uMorph.value = 1; requestRender(); return; }
    gsap.fromTo(uMorph, { value: 0 }, { value: 1, duration: 2.2, ease: "power2.inOut", overwrite: true });
  }

  // Each section names its shape; the cloud drifts to alternating sides
  document.querySelectorAll("[data-shape]").forEach((section, i) => {
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1);
    if (ScrollTrigger) {
      ScrollTrigger.create({
        trigger: section, start: "top 60%", end: "bottom 40%",
        onToggle: (self) => { if (self.isActive) setShape(section.dataset.shape, side); },
      });
    }
  });

  /* ---------- Pointer, scroll and supernova ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) addEventListener("pointermove", (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; });
  const pulse = cloudMat.uniforms.uPulse;
  const kick = { v: 0 };
  addEventListener("click", (e) => {
    if (reduce || !gsap) return;
    if (e.target.closest("a, button, input, label, summary, details, canvas, [data-pill], [data-toolkit-box], .swiper, [data-shot], [data-menu], .dock_component, .sticker")) return;
    gsap.fromTo(pulse, { value: 0 }, { value: 1, duration: 0.35, ease: "power2.out", yoyo: true, repeat: 1, overwrite: true });
    gsap.fromTo(kick, { v: 3 }, { v: 0, duration: 1.6, ease: "power2.out", overwrite: true });
    EQ.memeToast?.("Supernova. You did that. Insurance won't cover it.", "nova");
  });

  // Page height is read on refresh, not every frame
  let scrollMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const measure = () => { scrollMax = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  if (ScrollTrigger) ScrollTrigger.addEventListener("refresh", measure);

  // Only reallocate the buffer when the width changes or the height grows; the
  // mobile toolbar showing and hiding fires resize on every scroll reversal.
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    measure();
    if (w === bufW && h <= bufH) return;
    bufH = w === bufW ? Math.max(h, bufH) : h;
    bufW = w;
    renderer.setSize(bufW, bufH, false);
    camera.aspect = bufW / bufH;
    camera.updateProjectionMatrix();
    requestRender();
  };
  addEventListener("resize", resize);

  /* ---------- Render loop: paced, pausable, adaptive ---------- */
  let paused = false;
  document.addEventListener("visibilitychange", () => { paused = document.hidden; });
  EQ.pauseCosmos = (v) => { paused = v; };

  let lastY = window.scrollY, travel = 0, speed = 0, last = performance.now(), lastDraw = 0;
  const minFrame = coarse ? 1000 / 60 - 1.5 : 0;
  const ease = (k, dt) => 1 - Math.pow(1 - k, dt * 60);
  const frameTimes = [];
  let degraded = false;

  function degrade() {
    // Frames are slow: drop resolution and thin the stars and galaxy (index-free, so drawRange is safe)
    degraded = true;
    pixelRatio = Math.max(0.75, pixelRatio * 0.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(bufW, bufH, false);
    [starMat, galaxyMat, cloudMat].forEach((m) => { m.uniforms.uPixel.value = pixelRatio; });
    stars.geometry.setDrawRange(0, Math.floor(starCount * 0.6));
    galaxy.pts.geometry.setDrawRange(0, Math.floor(galaxyCount * 0.5));
  }

  function render(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    const state = EQ.state || {};

    // Star travel speed: idle drift, scroll, warp switch, rocket boost, supernova kick
    const targetSpeed = reduce ? 0 : 2.2 + Math.min(Math.abs(dy), 160) * 0.55 + (state.warp ? 70 : 0) + (state.boost || 0) * 3200 + kick.v * 25;
    speed += (targetSpeed - speed) * ease(0.06, dt);
    travel += speed * dt;

    starMat.uniforms.uTravel.value = travel;
    starMat.uniforms.uTime.value = galaxyMat.uniforms.uTime.value = cloudMat.uniforms.uTime.value = time;

    // Galaxy: spins, and recedes as the hero scrolls away (hidden past the hero on touch)
    const heroProgress = Math.min(lastY / innerHeight, 1.5);
    galaxy.group.visible = !(coarse && heroProgress > 1.2);
    galaxy.pts.rotation.y += dt * 0.05;
    galaxy.group.position.z = -5 - heroProgress * 14;
    galaxy.group.position.y = (small ? 1.5 : -0.2) + heroProgress * 3;
    galaxyMat.uniforms.uOpacity.value = 0.9 - Math.min(heroProgress, 1) * 0.55;

    // Cloud: drifts to its side, spins, leans with the pointer
    const k3 = ease(0.03, dt);
    cloud.group.position.x += (sideTarget.x - cloud.group.position.x) * k3;
    cloud.group.position.y += (sideTarget.y - cloud.group.position.y) * k3;
    cloud.group.scale.setScalar(cloud.group.scale.x + (sideTarget.scale - cloud.group.scale.x) * k3);
    cloud.pts.rotation.y += dt * (0.18 + Math.min(Math.abs(dy), 100) * 0.004);
    cloud.pts.rotation.x = Math.sin(time * 0.2) * 0.25;
    cloudMat.uniforms.uOpacity.value = activeShape === "galaxy" ? 0.35 : Q.opacity;

    // Camera: pointer parallax and a slow roll down the page
    const k4 = ease(0.04, dt);
    pointer.x += (pointer.tx - pointer.x) * k4;
    pointer.y += (pointer.ty - pointer.y) * k4;
    camera.position.x = pointer.x * 1.6;
    camera.position.y = -pointer.y * 1.1;
    camera.lookAt(0, 0, -4);
    camera.rotateZ(Math.sin((lastY / scrollMax) * Math.PI * 2) * 0.08);

    renderer.render(scene, camera);
  }

  function tick() {
    if (paused) return;
    const now = performance.now();
    if (now - lastDraw < minFrame) return;
    // Adaptive quality: watch the first ~2s of real frames, degrade once if they run slow
    if (!degraded && lastDraw) {
      frameTimes.push(now - lastDraw);
      if (frameTimes.length === 120) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        if (avg > 24) degrade(); else degraded = true;
      }
    }
    lastDraw = now;
    render(now);
  }
  function requestRender() { if (reduce || !gsap) render(performance.now()); }

  // If the GPU drops the context (memory pressure on phones), fall back to the 2D starfield
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (gsap) gsap.ticker.remove(tick);
    canvas.classList.remove("is-ready");
    canvas.style.display = "none";
    const fallback = document.createElement("canvas");
    fallback.className = "space_stars";
    fallback.setAttribute("data-starfield", "");
    canvas.parentNode.insertBefore(fallback, canvas);
    EQ.starfield?.();
  });

  canvas.classList.add("is-ready");
  document.querySelector("[data-starfield]")?.remove();
  if (reduce || !gsap) {
    setShape("planet", 1);
    render(performance.now());
  } else {
    gsap.ticker.add(tick);
  }
  if (ScrollTrigger) ScrollTrigger.refresh();
}
