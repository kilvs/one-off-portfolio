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
  const small = innerWidth < 768;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
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
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec3 p = position;
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
      float a = 1.0 - smoothstep(0.0, 0.5, d);
      a = pow(a, 1.7);
      gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
    }
  `;
  const makeMaterial = (defines = {}, opacity = 1) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, defines,
    uniforms: {
      uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uTravel: { value: 0 },
      uDepth: { value: 150 }, uPulse: { value: 0 }, uOpacity: { value: opacity },
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
  const starCount = small ? 2600 : 6500;
  const starMat = makeMaterial({ TRAVEL: "" }, 1);
  {
    const pos = new Float32Array(starCount * 3), col = new Float32Array(starCount * 3), size = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = rand(-70, 70); pos[i * 3 + 1] = rand(-45, 45); pos[i * 3 + 2] = rand(0, 150);
      const c = starPalette[(Math.random() * starPalette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = rand(0.5, 2.2);
    }
    scene.add(makePoints(pos, col, size, starMat));
  }

  /* ---------- 2. Spiral galaxy ---------- */
  const galaxyCount = small ? 16000 : 42000;
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

  /* ---------- 3. Morphing cloud ---------- */
  const N = small ? 5000 : 12000;
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
  let textShape = null;
  const makeText = () => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 300;
    const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "800 250px 'Bricolage Grotesque', 'Arial Black', sans-serif";
    x.fillText("EQ", 300, 160);
    const data = x.getImageData(0, 0, 600, 300).data, pts = [];
    for (let py = 0; py < 300; py += 2) for (let px = 0; px < 600; px += 2) if (data[(py * 600 + px) * 4 + 3] > 128) pts.push([(px - 300) / 60, -(py - 150) / 60]);
    return fill(() => { const p = pts[(Math.random() * pts.length) | 0] || [0, 0]; return [p[0] + rand(-0.04, 0.04), p[1] + rand(-0.04, 0.04), rand(-0.35, 0.35)]; });
  };

  const cloudMat = makeMaterial({ PULSE: "" }, small ? 0.6 : 0.85);
  const current = new Float32Array(shapes.galaxy);
  const from = new Float32Array(N * 3);
  let to = shapes.galaxy;
  const delays = new Float32Array(N);
  for (let i = 0; i < N; i++) delays[i] = Math.random() * 0.35;
  const cloud = (() => {
    const col = new Float32Array(N * 3), size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const c = cloudPalette[(Math.random() * cloudPalette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = rand(0.45, 1.35);
    }
    const pts = makePoints(current, col, size, cloudMat);
    const group = new THREE.Group();
    group.add(pts);
    scene.add(group);
    return { group, pts, attr: pts.geometry.getAttribute("position") };
  })();

  const morph = { t: 1 };
  const smooth = (x) => x * x * (3 - 2 * x);
  const applyMorph = () => {
    const t = morph.t;
    for (let i = 0; i < N; i++) {
      const k = smooth(Math.min(1, Math.max(0, (t - delays[i]) / 0.65)));
      const j = i * 3;
      current[j] = from[j] + (to[j] - from[j]) * k;
      current[j + 1] = from[j + 1] + (to[j + 1] - from[j + 1]) * k;
      current[j + 2] = from[j + 2] + (to[j + 2] - from[j + 2]) * k;
    }
    cloud.attr.needsUpdate = true;
  };
  let activeShape = "galaxy";
  const sideTarget = { x: 0, y: 0, scale: 1 };
  function setShape(name, side) {
    if (name === "text" && !textShape) textShape = makeText();
    const target = name === "text" ? textShape : shapes[name];
    if (!target) return;
    sideTarget.x = small ? 0 : side * 4.2;
    sideTarget.y = small ? 2 : 0;
    sideTarget.scale = name === "galaxy" ? 1 : (small ? 0.75 : 1);
    if (name === activeShape) return;
    activeShape = name;
    from.set(current);
    to = target;
    if (reduce || !gsap) { morph.t = 1; applyMorph(); return; }
    gsap.fromTo(morph, { t: 0 }, { t: 1, duration: 2.2, ease: "power2.inOut", onUpdate: applyMorph, overwrite: true });
  }

  // Each section names its shape; the cloud drifts to alternating sides
  const ScrollTrigger = window.ScrollTrigger;
  document.querySelectorAll("[data-shape]").forEach((section, i) => {
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1);
    if (ScrollTrigger) {
      ScrollTrigger.create({
        trigger: section, start: "top 60%", end: "bottom 40%",
        onToggle: (self) => { if (self.isActive) setShape(section.dataset.shape, side); },
      });
    }
  });
  if (document.fonts) document.fonts.ready.then(() => { textShape = null; });

  /* ---------- Pointer, scroll and supernova ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; });
  const pulse = cloudMat.uniforms.uPulse;
  const kick = { v: 0 };
  addEventListener("click", (e) => {
    if (reduce || !gsap) return;
    if (e.target.closest("a, button, input, label, summary, details, canvas, [data-pill], [data-toolkit-box], .swiper, [data-shot], [data-menu], .dock_component, .sticker")) return;
    gsap.fromTo(pulse, { value: 0 }, { value: 1, duration: 0.35, ease: "power2.out", yoyo: true, repeat: 1, overwrite: true });
    gsap.fromTo(kick, { v: 3 }, { v: 0, duration: 1.6, ease: "power2.out", overwrite: true });
    EQ.memeToast?.("Supernova. You did that. Insurance won't cover it.", "nova");
  });

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    [starMat, galaxyMat, cloudMat].forEach((m) => { m.uniforms.uPixel.value = renderer.getPixelRatio(); });
    if (reduce) render(0, 0);
  };
  addEventListener("resize", resize);

  let lastY = window.scrollY, travel = 0, speed = 0, last = performance.now();
  function render() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    const state = EQ.state || {};

    // Star travel speed: idle drift, scroll, warp switch, rocket boost, supernova kick
    const targetSpeed = reduce ? 0 : 2.2 + Math.min(Math.abs(dy), 160) * 0.55 + (state.warp ? 70 : 0) + (state.boost || 0) * 3200 + kick.v * 25;
    speed += (targetSpeed - speed) * 0.06;
    travel += speed * dt;

    starMat.uniforms.uTravel.value = travel;
    [starMat, galaxyMat, cloudMat].forEach((m) => { m.uniforms.uTime.value = time; });

    // Galaxy: spins, and recedes as the hero scrolls away
    const heroProgress = Math.min(window.scrollY / innerHeight, 1.5);
    galaxy.pts.rotation.y += dt * 0.05;
    galaxy.group.position.z = -5 - heroProgress * 14;
    galaxy.group.position.y = (small ? 1.5 : -0.2) + heroProgress * 3;
    galaxyMat.uniforms.uOpacity.value = 0.9 - Math.min(heroProgress, 1) * 0.55;

    // Cloud: drifts to its side, spins, leans with the pointer
    cloud.group.position.x += (sideTarget.x - cloud.group.position.x) * 0.03;
    cloud.group.position.y += (sideTarget.y - cloud.group.position.y) * 0.03;
    const s = cloud.group.scale.x + (sideTarget.scale - cloud.group.scale.x) * 0.03;
    cloud.group.scale.setScalar(s);
    cloud.pts.rotation.y += dt * (0.18 + Math.min(Math.abs(dy), 100) * 0.004);
    cloud.pts.rotation.x = Math.sin(time * 0.2) * 0.25;
    cloudMat.uniforms.uOpacity.value = activeShape === "galaxy" ? 0.35 : (small ? 0.6 : 0.85);

    // Camera: pointer parallax and a slow roll down the page
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    camera.position.x = pointer.x * 1.6;
    camera.position.y = -pointer.y * 1.1;
    camera.lookAt(0, 0, -4);
    const pageProgress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    camera.rotateZ(Math.sin(pageProgress * Math.PI * 2) * 0.08);

    renderer.render(scene, camera);
  }

  canvas.classList.add("is-ready");
  document.querySelector("[data-starfield]")?.remove();
  if (reduce || !gsap) {
    setShape("planet", 1);
    render();
  } else {
    gsap.ticker.add(render);
  }
  if (ScrollTrigger) ScrollTrigger.refresh();
}
