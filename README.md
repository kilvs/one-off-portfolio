# One-Off Portfolio

Eugene Quilban's personal portfolio. Two builds, both static HTML, CSS and JS made the way a
Webflow site is built: Finsweet Client-First classes, variables on `:root`, Swiper for every
slider and GSAP for motion.

- **`/` (root): the cosmic one-pager.** Three.js particles, Lenis smooth scroll, Swiper 3D
  sliders, a pinned horizontal work track with full-page site screenshots that scroll on hover,
  a Matter.js zero-gravity toolkit, and a Meme mode that is on by default.
- **`/console/`: the console-style dashboard** (3 Oct 2026), kept as the earlier build.

## Run it

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 (cosmic page) or http://localhost:8000/console/.

## Cosmic page

| Path | What |
|---|---|
| `index.html` | All sections. Copy of record verbatim; meme lines live in `data-meme-swap` and `data-meme-only` |
| `css/landing.css` | Variables, type, sections, components, breakpoints 991 / 767 / 479 |
| `js/landing.js` | GSAP, Lenis, Swiper, Matter.js: menu, hero, marquee, sliders, pinned work track, 3D rules ring, toolkit physics, rocket, game, easter eggs |
| `js/cosmos.js` | Three.js layer: warp stars, galaxy, a particle cloud that morphs per section (`data-shape`). Falls back to a 2D starfield |
| `images/sites/` | Full-page screenshots (900px wide WebP) that scroll on hover |
| `fonts/` | Bricolage Grotesque and General Sans variable files |

Toys: Mission control (bottom right) has Meme mode, Gravity and Warp speed. Click empty space for
a supernova. Click the logo a few times. Konami code. Hold Publish in Contact.

Reduced motion: no smooth scroll, loops, physics or particle motion; every element ends visible.

## Console build

| Path | What |
|---|---|
| `console/index.html` | Start screen, top bar, tile shelves, content panels, media viewer, trophies |
| `console/css/` | Variables, utilities and console components |
| `console/js/console.js` | Selection, panels, Swiper, trophies, sound, keyboard and gamepad |

### Console controls

| Action | Mouse / touch | Keyboard | Controller |
|---|---|---|---|
| Browse tiles | Click, swipe | Left / Right | D-pad, left stick |
| Open | Click the selected tile, Open | Enter | Bottom face button |
| Back | Back button | Esc | Right face button |
| Switch tab | Portfolio / Media | Q / E | Bumpers |

## Shared

| Path | What |
|---|---|
| `images/photos/` | WebP photos at 1200 and up to 2400 wide |
| `images/icons/` | Lucide (ISC) and Simple Icons (CC0) SVGs, white and dark |
| `CREDITS.md` | Photo, font, library and screenshot credits |

CSS and JS links carry a `?v=` number; bump it on every change. Edited images get a new filename.
