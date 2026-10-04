/* One-Off Portfolio: console dashboard behaviour.
   Webflow-style: hooks are data attributes, state is shown with is-* classes.
   Needs Swiper (sliders) and optionally GSAP (motion). Fails visible: without
   this script every panel renders as a plain page (see console.css). */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap && !reduceMotion ? window.gsap : null;
  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };

  /* ---------- Storage (per-viewer conveniences only) ---------- */
  var store = {
    get: function (key, fallback) {
      try { var value = window.localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
      catch (error) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* private mode */ }
    }
  };

  /* ---------- Sound: tiny synth blips, no audio files ---------- */
  var sound = {
    on: store.get("eq-sound", true),
    context: null,
    unlock: function () {
      if (this.context) return;
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.context = new AudioContext();
    },
    tone: function (frequency, duration, delay, volume, type) {
      if (!this.on || !this.context) return;
      var context = this.context;
      var start = context.currentTime + (delay || 0);
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.05, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    },
    play: function (name) {
      if (name === "move") this.tone(740, 0.06, 0, 0.03);
      if (name === "open") { this.tone(523, 0.08, 0, 0.05); this.tone(784, 0.12, 0.06, 0.05); }
      if (name === "back") { this.tone(659, 0.06, 0, 0.04); this.tone(440, 0.1, 0.05, 0.04); }
      if (name === "tab") this.tone(988, 0.05, 0, 0.03, "triangle");
      if (name === "start") { this.tone(262, 0.9, 0, 0.05, "triangle"); this.tone(392, 0.9, 0.08, 0.04, "triangle"); this.tone(523, 1.1, 0.16, 0.04, "triangle"); }
      if (name === "trophy") { this.tone(784, 0.12, 0, 0.05); this.tone(988, 0.12, 0.1, 0.05); this.tone(1319, 0.3, 0.2, 0.05); }
    }
  };
  var soundToggle = $("[data-sound-toggle]");
  if (soundToggle) {
    soundToggle.setAttribute("aria-pressed", String(sound.on));
    soundToggle.addEventListener("click", function () {
      sound.on = !sound.on;
      store.set("eq-sound", sound.on);
      soundToggle.setAttribute("aria-pressed", String(sound.on));
      sound.unlock();
      sound.play("tab");
    });
  }

  /* ---------- Trophies ---------- */
  var TROPHIES = [
    { id: "start", grade: "bronze", name: "Press start", description: "Started the portfolio." },
    { id: "profile", grade: "bronze", name: "Nice to meet you", description: "Opened the profile." },
    { id: "first-case", grade: "bronze", name: "First case", description: "Opened a case study." },
    { id: "all-cases", grade: "gold", name: "Case closed", description: "Opened all five case studies." },
    { id: "rules", grade: "bronze", name: "Rule book", description: "Opened How I work." },
    { id: "width", grade: "silver", name: "Pixel peeper", description: "Picked a width in the width tester." },
    { id: "hometown", grade: "bronze", name: "Hometown", description: "Opened the Balanga, Bataan album." },
    { id: "big-body", grade: "silver", name: "Big Body", description: "Opened the Corolla album." },
    { id: "controller", grade: "silver", name: "Plugged in", description: "Browsed with a controller." },
    { id: "contact", grade: "bronze", name: "Say hello", description: "Opened Contact." },
    { id: "platinum", grade: "platinum", name: "Full playthrough", description: "Earned every other trophy." }
  ];
  var earned = store.get("eq-trophies", []);
  var casesSeen = store.get("eq-cases", []);
  var toast = $("[data-toast]");
  var toastQueue = [];
  var toastBusy = false;

  function badge(grade) {
    return '<span class="trophy_badge is-' + grade + '"><img src="../images/icons/ui/icon-trophy-white.svg" alt="" width="24" height="24"></span>';
  }
  function renderTrophies() {
    var count = earned.length;
    $$("[data-trophy-count]").forEach(function (el) { el.textContent = String(count); });
    var percent = Math.round((count / TROPHIES.length) * 100);
    var percentEl = $("[data-trophy-percent]");
    if (percentEl) percentEl.textContent = percent + "%";
    var bar = $("[data-trophy-bar]");
    if (bar) bar.style.width = percent + "%";
    var list = $("[data-trophy-list]");
    if (!list) return;
    list.innerHTML = TROPHIES.map(function (trophy) {
      var has = earned.indexOf(trophy.id) !== -1;
      return '<li class="trophies_item' + (has ? "" : " is-locked") + '">' + badge(trophy.grade) +
        '<div><p class="trophies_item-name">' + trophy.name + '</p><p class="trophies_item-description">' + trophy.description + '</p></div>' +
        '<span class="trophies_item-status">' + (has ? "Earned" : "Locked") + '</span></li>';
    }).join("");
  }
  function showNextToast() {
    if (toastBusy || !toastQueue.length || !toast) return;
    toastBusy = true;
    var trophy = toastQueue.shift();
    $("[data-toast-grade]", toast).innerHTML = badge(trophy.grade);
    $("[data-toast-name]", toast).textContent = trophy.name;
    toast.classList.add("is-visible");
    sound.play("trophy");
    window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () { toastBusy = false; showNextToast(); }, 500);
    }, 3200);
  }
  function award(id) {
    if (earned.indexOf(id) !== -1) return;
    var trophy = TROPHIES.filter(function (t) { return t.id === id; })[0];
    if (!trophy) return;
    earned.push(id);
    store.set("eq-trophies", earned);
    toastQueue.push(trophy);
    showNextToast();
    renderTrophies();
    var others = TROPHIES.filter(function (t) { return t.id !== "platinum"; });
    if (others.every(function (t) { return earned.indexOf(t.id) !== -1; })) award("platinum");
  }
  renderTrophies();

  /* ---------- Overlays (hub, viewer, trophies) ---------- */
  var overlay = null;
  var lastFocus = null;
  function openOverlay(element, name) {
    lastFocus = document.activeElement;
    overlay = name;
    element.classList.add("is-open");
    element.setAttribute("aria-hidden", "false");
    sound.play("open");
  }
  function closeOverlay() {
    var element = overlay === "hub" ? hub : overlay === "viewer" ? viewer : overlay === "trophies" ? trophiesPanel : null;
    if (!element) return;
    element.classList.remove("is-open");
    element.setAttribute("aria-hidden", "true");
    overlay = null;
    sound.play("back");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* Hub */
  var hub = $("[data-hub]");
  var hubScroll = $("[data-hub-scroll]");
  var hubTitle = $("[data-hub-title]");
  var CASES = ["gsh", "omble", "btc", "ember", "dain"];
  function openHub(id, target) {
    if (!hub) return;
    var panel = $('[data-hub-panel="' + id + '"]');
    if (!panel) return;
    $$("[data-hub-panel]").forEach(function (p) { p.classList.toggle("is-active", p === panel); });
    var tile = $('[data-tile="' + id + '"]');
    hubTitle.textContent = tile ? tile.getAttribute("aria-label") : "";
    openOverlay(hub, "hub");
    hubScroll.scrollTop = 0;
    $(".hub_back", hub).focus({ preventScroll: true });
    if (gsap) gsap.from(panel.children, { autoAlpha: 0, y: 16, duration: 0.45, stagger: 0.05, ease: "power2.out", clearProps: "all" });
    if (target) {
      window.setTimeout(function () {
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        if (target.tagName === "DETAILS") target.open = true;
      }, 120);
    }
    if (id === "profile") award("profile");
    if (id === "how") award("rules");
    if (id === "contact") award("contact");
    if (CASES.indexOf(id) !== -1) {
      award("first-case");
      if (casesSeen.indexOf(id) === -1) { casesSeen.push(id); store.set("eq-cases", casesSeen); }
      if (CASES.every(function (c) { return casesSeen.indexOf(c) !== -1; })) award("all-cases");
    }
  }
  $$("[data-hub-close]").forEach(function (button) { button.addEventListener("click", closeOverlay); });
  $$("[data-open-hub]").forEach(function (button) {
    button.addEventListener("click", function () { openHub(button.getAttribute("data-open-hub")); });
  });

  /* Viewer */
  var viewer = $("[data-viewer]");
  var viewerTitle = $("[data-viewer-title]");
  var viewerCounter = $("[data-viewer-counter]");
  var viewerSliders = {};
  var currentAlbum = null;
  var ALBUM_NAMES = { bataan: "Balanga, Bataan", garage: "Corolla Big Body", eugene: "Eugene" };
  function updateCounter(swiper) {
    if (viewerCounter) viewerCounter.textContent = (swiper.activeIndex + 1) + " / " + swiper.slides.length;
  }
  function openViewer(album, index) {
    if (!viewer || !window.Swiper) return;
    if (overlay === "hub") { hub.classList.remove("is-open"); hub.setAttribute("aria-hidden", "true"); overlay = null; }
    currentAlbum = album;
    $$("[data-viewer-album]").forEach(function (el) { el.hidden = el.getAttribute("data-viewer-album") !== album; });
    viewerTitle.textContent = ALBUM_NAMES[album] || "";
    openOverlay(viewer, "viewer");
    var element = $('[data-swiper="viewer-' + album + '"]');
    if (!viewerSliders[album]) {
      viewerSliders[album] = new window.Swiper(element, {
        speed: reduceMotion ? 0 : 450,
        grabCursor: true,
        a11y: { enabled: true },
        on: { slideChange: updateCounter }
      });
    }
    viewerSliders[album].update();
    viewerSliders[album].slideTo(index || 0, 0);
    updateCounter(viewerSliders[album]);
    $("[data-viewer-close]").focus({ preventScroll: true });
    if (album === "bataan") award("hometown");
    if (album === "garage") award("big-body");
  }
  function viewerStep(direction) {
    var swiper = viewerSliders[currentAlbum];
    if (!swiper) return;
    if (direction > 0) swiper.slideNext(); else swiper.slidePrev();
    sound.play("move");
  }
  $$("[data-viewer-close]").forEach(function (button) { button.addEventListener("click", closeOverlay); });
  var prevButton = $("[data-viewer-prev]");
  var nextButton = $("[data-viewer-next]");
  if (prevButton) prevButton.addEventListener("click", function () { viewerStep(-1); });
  if (nextButton) nextButton.addEventListener("click", function () { viewerStep(1); });
  $$("[data-open-album]").forEach(function (button) {
    button.addEventListener("click", function () { openViewer(button.getAttribute("data-open-album"), 0); });
  });

  /* Trophies panel */
  var trophiesPanel = $("[data-trophies]");
  $$("[data-trophies-open]").forEach(function (button) {
    button.addEventListener("click", function () {
      renderTrophies();
      openOverlay(trophiesPanel, "trophies");
      $("[data-trophies-close].button", trophiesPanel).focus({ preventScroll: true });
    });
  });
  $$("[data-trophies-close]").forEach(function (button) { button.addEventListener("click", closeOverlay); });
  var resetButton = $("[data-trophies-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", function () {
      earned = []; casesSeen = [];
      store.set("eq-trophies", earned); store.set("eq-cases", casesSeen);
      renderTrophies();
    });
  }

  /* ---------- Shelves and tile selection ---------- */
  var shelves = {};
  var currentTab = "portfolio";
  var selected = { portfolio: 0, media: 0 };
  var info = {
    meta: $("[data-info-meta]"),
    title: $("[data-info-title]"),
    description: $("[data-info-description]"),
    openLabel: $("[data-open-label]"),
    activities: $("[data-activities]"),
    root: $("[data-info]")
  };

  $$("[data-shelf]").forEach(function (shelf) {
    var name = shelf.getAttribute("data-shelf");
    var tiles = $$("[data-tile]", shelf);
    var swiper = window.Swiper ? new window.Swiper($("[data-swiper]", shelf), {
      slidesPerView: "auto",
      spaceBetween: 20,
      speed: reduceMotion ? 0 : 450,
      grabCursor: true,
      watchOverflow: true,
      breakpoints: { 0: { spaceBetween: 14 }, 768: { spaceBetween: 20 } }
    }) : null;
    shelves[name] = { element: shelf, tiles: tiles, swiper: swiper };
    tiles.forEach(function (tile, index) {
      tile.addEventListener("click", function () {
        if (selected[name] === index && tile.classList.contains("is-selected")) openSelected();
        else select(index, true);
      });
      tile.addEventListener("focus", function () {
        if (selected[name] !== index) select(index, false);
      });
    });
  });

  function lazyBackdrop(element) {
    var image = $("img[data-src]", element);
    if (image) { image.src = image.getAttribute("data-src"); image.removeAttribute("data-src"); }
  }

  function buildActivities(tile) {
    var cards = [];
    var album = tile.getAttribute("data-album");
    if (album) {
      $$('[data-viewer-album="' + album + '"] figcaption > span:first-child').slice(0, 4).forEach(function (caption, index) {
        cards.push({ label: "Photo " + (index + 1), text: caption.textContent, action: function () { openViewer(album, index); } });
      });
    } else {
      var id = tile.getAttribute("data-tile");
      $$('[data-hub-panel="' + id + '"] [data-activity]').slice(0, 4).forEach(function (target) {
        var list = target.tagName === "UL" ? target : $("ul", target);
        var paragraphs = target.tagName === "P" ? [] : $$("p", target);
        var text = list
          ? $$("li", list).map(function (li) { return li.textContent.trim(); }).join(", ")
          : paragraphs.length
            ? paragraphs[paragraphs.length - 1].textContent.trim()
            : target.textContent.trim().replace(/\s+/g, " ");
        var label = target.tagName === "UL" ? "Tags" : target.getAttribute("data-activity");
        cards.push({ label: label, text: text, action: function () { openHub(id, target); } });
      });
    }
    info.activities.innerHTML = "";
    cards.forEach(function (card) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "console_activity";
      button.innerHTML = '<span class="console_activity-label"></span><span class="console_activity-text"></span>';
      button.firstChild.textContent = card.label;
      button.lastChild.textContent = card.text;
      button.addEventListener("click", card.action);
      info.activities.appendChild(button);
    });
  }

  function select(index, playSound) {
    var shelf = shelves[currentTab];
    if (!shelf) return;
    var count = shelf.tiles.length;
    index = Math.max(0, Math.min(count - 1, index));
    var changed = index !== selected[currentTab] || !shelf.tiles[index].classList.contains("is-selected");
    selected[currentTab] = index;
    var tile = shelf.tiles[index];
    shelf.tiles.forEach(function (t, i) { t.classList.toggle("is-selected", i === index); });

    info.meta.textContent = tile.getAttribute("data-meta") || "";
    info.title.textContent = tile.getAttribute("data-title") || "";
    info.description.textContent = tile.getAttribute("data-description") || "";
    info.openLabel.textContent = tile.hasAttribute("data-album") ? "View" : "Open";
    buildActivities(tile);

    var id = tile.getAttribute("data-tile");
    $$("[data-backdrop]").forEach(function (layer) {
      var active = layer.getAttribute("data-backdrop") === id;
      if (active) lazyBackdrop(layer);
      layer.classList.toggle("is-active", active);
    });

    if (shelf.swiper) {
      window.setTimeout(function () { shelf.swiper.update(); shelf.swiper.slideTo(index); }, reduceMotion ? 0 : 340);
    }
    if (changed) {
      if (playSound) sound.play("move");
      if (gsap) gsap.fromTo([info.meta, info.title, info.description], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power2.out" });
    }
  }

  function openSelected() {
    var shelf = shelves[currentTab];
    if (!shelf) return;
    var tile = shelf.tiles[selected[currentTab]];
    if (tile.hasAttribute("data-album")) openViewer(tile.getAttribute("data-album"), 0);
    else openHub(tile.getAttribute("data-tile"));
  }
  var openButton = $("[data-open]");
  if (openButton) openButton.addEventListener("click", openSelected);

  /* ---------- Tabs ---------- */
  var tabs = $$("[data-tab]");
  function switchTab(name) {
    if (!shelves[name] || name === currentTab) return;
    currentTab = name;
    tabs.forEach(function (tab) {
      var active = tab.getAttribute("data-tab") === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    Object.keys(shelves).forEach(function (key) { shelves[key].element.hidden = key !== name; });
    if (shelves[name].swiper) shelves[name].swiper.update();
    sound.play("tab");
    select(selected[name], false);
  }
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () { switchTab(tab.getAttribute("data-tab")); });
  });
  function cycleTab(step) {
    var names = tabs.map(function (tab) { return tab.getAttribute("data-tab"); });
    var next = names[(names.indexOf(currentTab) + step + names.length) % names.length];
    switchTab(next);
  }

  /* ---------- Start screen ---------- */
  var start = $("[data-start]");
  var started = false;
  function begin() {
    if (started) return;
    started = true;
    sound.unlock();
    sound.play("start");
    if (start) start.classList.add("is-done");
    award("start");
    var tile = shelves[currentTab] && shelves[currentTab].tiles[selected[currentTab]];
    if (tile) tile.focus({ preventScroll: true });
    if (gsap) {
      gsap.from(".topbar_component", { autoAlpha: 0, y: -16, duration: 0.6, ease: "power2.out", clearProps: "all" });
      gsap.from(".console_shelf-slide", { autoAlpha: 0, x: 40, duration: 0.6, stagger: 0.035, ease: "power3.out", delay: 0.15, clearProps: "all" });
      gsap.from(".console_info > *", { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.06, ease: "power2.out", delay: 0.3, clearProps: "all" });
    }
  }
  var startButton = $("[data-start-button]");
  if (startButton) {
    startButton.addEventListener("click", begin);
    window.setTimeout(function () { if (!started) startButton.focus({ preventScroll: true }); }, 50);
  }
  if (start && gsap) {
    gsap.from(".start_avatar-wrapper", { scale: 0.6, autoAlpha: 0, duration: 0.9, ease: "back.out(1.6)" });
    gsap.from(".start_content > :not(.start_avatar-wrapper)", { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.08, delay: 0.35, ease: "power2.out" });
  }

  /* ---------- Width tester ---------- */
  var tester = $("[data-width-tester]");
  if (tester) {
    var widths = [1440, 1100, 992, 768, 390];
    var browser = $("[data-width-browser]", tester);
    var readout = $("[data-width-readout]", tester);
    var widthButtons = $$("[data-width]", tester);
    var widthIndex = 0;
    var widthTimer = null;
    var widthPicked = false;
    var showWidth = function (width) {
      browser.style.width = Math.round((width / 1440) * 100) + "%";
      readout.textContent = String(width);
      widthButtons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(Number(button.getAttribute("data-width")) === width));
      });
    };
    var startWidths = function () {
      if (reduceMotion || widthPicked || widthTimer) return;
      widthTimer = window.setInterval(function () {
        widthIndex = (widthIndex + 1) % widths.length;
        showWidth(widths[widthIndex]);
      }, 2400);
    };
    widthButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        widthPicked = true;
        window.clearInterval(widthTimer); widthTimer = null;
        widthIndex = widths.indexOf(Number(button.getAttribute("data-width")));
        showWidth(widths[widthIndex]);
        sound.play("move");
        award("width");
      });
    });
    showWidth(widths[0]);
    startWidths();
  }

  /* ---------- Clock: time in Balanga ---------- */
  var clock = $("[data-clock]");
  if (clock) {
    var formatter = new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
    var tick = function () { clock.textContent = formatter.format(new Date()); };
    tick();
    window.setInterval(tick, 15000);
  }

  /* ---------- Keyboard ---------- */
  function isTyping(target) {
    return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  }
  document.addEventListener("keydown", function (event) {
    if (isTyping(event.target)) return;
    var key = event.key;
    if (!started) {
      if (key === "Enter" || key === " ") { event.preventDefault(); begin(); }
      return;
    }
    if (key === "Escape") {
      if (overlay) { event.preventDefault(); closeOverlay(); }
      return;
    }
    if (overlay === "viewer") {
      if (key === "ArrowRight") { event.preventDefault(); viewerStep(1); }
      if (key === "ArrowLeft") { event.preventDefault(); viewerStep(-1); }
      return;
    }
    if (overlay) return;
    var onTile = event.target.hasAttribute && event.target.hasAttribute("data-tile");
    var onBody = event.target === document.body;
    if (key === "ArrowRight" || key === "ArrowLeft") {
      if (!onTile && !onBody) return;
      event.preventDefault();
      select(selected[currentTab] + (key === "ArrowRight" ? 1 : -1), true);
      shelves[currentTab].tiles[selected[currentTab]].focus({ preventScroll: true });
    }
    if (key === "ArrowDown" && (onTile || onBody)) { event.preventDefault(); openButton.focus(); }
    if (key === "ArrowUp" && !onTile && event.target.closest && event.target.closest("[data-info]")) {
      event.preventDefault();
      shelves[currentTab].tiles[selected[currentTab]].focus({ preventScroll: true });
    }
    if (key === "Enter" && onBody) { event.preventDefault(); openSelected(); }
    if (key === "q" || key === "Q" || key === "[") cycleTab(-1);
    if (key === "e" || key === "E" || key === "]") cycleTab(1);
  });

  /* ---------- Gamepad (standard mapping) ---------- */
  var pad = { polling: false, held: {}, repeatAt: 0 };
  function pressed(gamepad, index) { var b = gamepad.buttons[index]; return !!b && (b.pressed || b.value > 0.5); }
  function edge(gamepad, index) {
    var down = pressed(gamepad, index);
    var was = pad.held[index];
    pad.held[index] = down;
    return down && !was;
  }
  function pollPad() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gamepad = null;
    for (var i = 0; i < gamepads.length; i += 1) { if (gamepads[i]) { gamepad = gamepads[i]; break; } }
    if (!gamepad) { pad.polling = false; return; }
    var now = performance.now();
    var axisX = gamepad.axes[0] || 0;
    var axisY = gamepad.axes[1] || 0;
    var right = pressed(gamepad, 15) || axisX > 0.6;
    var left = pressed(gamepad, 14) || axisX < -0.6;
    var used = false;

    if (edge(gamepad, 0)) {
      used = true;
      if (!started) begin();
      else if (!overlay) {
        var focused = document.activeElement;
        if (focused && focused !== document.body && !focused.hasAttribute("data-tile")) focused.click();
        else openSelected();
      }
    }
    if (edge(gamepad, 1) && overlay) { used = true; closeOverlay(); }
    if (edge(gamepad, 4)) { used = true; if (!overlay) cycleTab(-1); }
    if (edge(gamepad, 5)) { used = true; if (!overlay) cycleTab(1); }
    if (edge(gamepad, 9)) { used = true; if (!started) begin(); }

    if ((left || right) && now > pad.repeatAt) {
      used = true;
      pad.repeatAt = now + (pad.repeating ? 140 : 320);
      pad.repeating = true;
      if (overlay === "viewer") viewerStep(right ? 1 : -1);
      else if (!overlay && started) {
        select(selected[currentTab] + (right ? 1 : -1), true);
        shelves[currentTab].tiles[selected[currentTab]].focus({ preventScroll: true });
      }
    }
    if (!left && !right) pad.repeating = false;

    var scrollAmount = Math.abs(axisY) > 0.3 ? axisY : (pressed(gamepad, 13) ? 0.8 : pressed(gamepad, 12) ? -0.8 : 0);
    if (scrollAmount) {
      used = true;
      if (overlay === "hub") hubScroll.scrollTop += scrollAmount * 18;
      else if (!overlay && started && scrollAmount > 0 && edge(gamepad, 13)) openButton.focus();
    }
    if (used) award("controller");
    window.requestAnimationFrame(pollPad);
  }
  window.addEventListener("gamepadconnected", function () {
    if (!pad.polling) { pad.polling = true; window.requestAnimationFrame(pollPad); }
  });

  /* ---------- Go ---------- */
  select(0, false);
})();
