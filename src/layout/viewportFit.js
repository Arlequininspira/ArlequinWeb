/*
 * VIEWPORT FIT — single source of truth for every size that depends on the screen.
 *
 * Why JS instead of stepped @media rules: the old breakpoints jumped in
 * discrete steps tuned for a handful of resolutions, so any screen between
 * two steps (notebooks with browser toolbars, iPhones with Safari bars) got a
 * size meant for a different screen — sometimes even a BIGGER card on a
 * SHORTER screen. Here every value is derived continuously from the real
 * visible area (innerWidth × innerHeight, which on iOS already excludes the
 * Safari bars), and published as CSS custom properties on <html>.
 *
 * Layout model (CSS px):
 *   ┌ escudo (top, centered) ┐
 *   │        band            │  ← cards / grid / question live here,
 *   └ footer (bottom)        ┘    centered vertically in the band
 *
 * Reference = 1920×953 desktop: produces the exact values the design was
 * tuned at (escudo 94px, grid 490px, card scale 1.12, logo 500px).
 */

const ESCUDO_RATIO = 2247 / 1531;   // escudo image h/w

// Card canvas is 450×680; the visible card body inside it (measured from the
// artwork) is ~298×452 and centered, so it's the box we fit into the band.
const CARD_BODY_W = 298;
const CARD_BODY_H = 452;
const CARD_MAX_SCALE = 1.12;

const GRID_MAX_W = 490;
const GRID_REF_CARD_W = (GRID_MAX_W - 16) / 2;   // 237: card size the exit anim was tuned at
const CARD_EXIT_REF = 0.49;

const LOGO_SIZE = 500;

const clamp = (min, v, max) => Math.min(max, Math.max(min, v));

export function computeLayout(W, H) {
  const mobile = W <= 500;

  // ── Escudo ────────────────────────────────────────────────────────────
  const escudoW = clamp(46, Math.min(H * 0.105, W * 0.19), 94);
  const escudoH = escudoW * ESCUDO_RATIO;
  const escudoTop = clamp(6, H * 0.021, 20);
  const gap = clamp(8, H * 0.02, 20);

  // ── Footer: visible strip top (mobile banner is scaled 1.4 from bottom) ─
  const footerTop = mobile ? H - 108 : H - 63;

  const bandTop = escudoTop + escudoH + gap;
  const bandBottom = footerTop - gap;
  const bandH = Math.max(120, bandBottom - bandTop);
  const offsetY = (bandTop + bandBottom) / 2 - H / 2;

  // ── Card detail ───────────────────────────────────────────────────────
  const cardScale = clamp(0.4, Math.min(
    (bandH * 0.97) / CARD_BODY_H,
    (W - 24) / CARD_BODY_W,
  ), CARD_MAX_SCALE);

  // ── Grid 2×2 (cards 3:4) ───────────────────────────────────────────────
  const gridGap = mobile ? 8 : 16;
  const gridW = clamp(200, Math.min(
    GRID_MAX_W,
    W - 16,
    (bandH - gridGap) * 0.75 + gridGap,
  ), GRID_MAX_W);
  const gridCardW = (gridW - gridGap) / 2;

  // ── Mask (desktop/tablet follows the card; mobile keeps its own look) ──
  let maskScale = 1;
  let openDist;
  if (W > 600) {
    maskScale = clamp(0.5, Math.min(cardScale / CARD_MAX_SCALE, W / 900), 1);
    openDist = 224 * maskScale;
  } else {
    openDist = W <= 360 ? 126 : W <= 390 ? 140 : W <= 430 ? 153 : 162;
  }

  // ── Logo ──────────────────────────────────────────────────────────────
  const logoScale = clamp(0.4, Math.min(H * 0.6, W * 0.99) / LOGO_SIZE, 1);

  return {
    '--escudo-height': escudoW,          // CSS width of the image (legacy name)
    '--escudo-img-height': escudoH,
    '--escudo-top': escudoTop,
    '--escudo-clearance': bandTop,
    '--footer-clearance': H - bandBottom,
    '--stage-offset-y': offsetY,
    '--card-scale': cardScale,
    '--card-exit-scale': CARD_EXIT_REF * (gridCardW / GRID_REF_CARD_W) / (cardScale / CARD_MAX_SCALE),
    '--grid-max-width': gridW,
    '--grid-gap': gridGap,
    '--grid-card-width': gridCardW,
    '--grid-font-size': clamp(12, gridW * 0.045, 22),
    '--grid-text-stroke': gridW >= 450 ? 1.5 : 0,
    '--mask-scale': maskScale,
    '--mask-open-distance': openDist,
    '--logo-scale': logoScale,
  };
}

const UNITLESS = new Set(['--card-scale', '--card-exit-scale', '--mask-scale', '--logo-scale']);

let last = { W: 0, H: 0 };

function apply() {
  const W = window.innerWidth;
  let H = window.innerHeight;

  // Android shrinks the layout viewport when the keyboard opens (contact
  // form). Keep the previous height so the card doesn't shrink while typing.
  const el = document.activeElement;
  const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  if (typing && W === last.W && H < last.H) H = last.H;
  if (W === last.W && H === last.H) return;
  last = { W, H };

  const style = document.documentElement.style;
  const vars = computeLayout(W, H);
  for (const k in vars) {
    const v = Math.round(vars[k] * 1000) / 1000;
    style.setProperty(k, UNITLESS.has(k) ? String(v) : `${v}px`);
  }
}

export function readLayoutVar(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

export function initViewportFit() {
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 150));
  // iOS fires visualViewport resize when Safari bars show/hide.
  window.visualViewport?.addEventListener('resize', apply);
}
