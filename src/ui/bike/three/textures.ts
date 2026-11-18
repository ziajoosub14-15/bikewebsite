import * as THREE from 'three';
import type { Tyres, WheelLook } from '../../../types/components';
import { drawBackdrop } from '../backdrops';

/**
 * Procedural textures (drawn on canvases, no image files). Cached by key, so many meshes share one texture.
 */
const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(t: THREE.CanvasTexture, srgb = true, repeat = true) {
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** 3K twill carbon weave: one tile = 2×2 tows. Used as colour map (raw carbon) and bump map. */
export function carbonWeave(kind: 'color' | 'bump'): THREE.Texture {
  const key = `weave-${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const N = 256;
  const [c, ctx] = canvas(N, N);
  const tow = N / 4;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      // 2/2 twill: alternating over/under shifted by one each row
      const over = ((i + j) >> 1) % 2 === 0;
      const x = i * tow;
      const y = j * tow;
      const g = over ? ctx.createLinearGradient(x, y, x + tow, y) : ctx.createLinearGradient(x, y, x, y + tow);
      if (kind === 'color') {
        g.addColorStop(0, '#0d0e10');
        g.addColorStop(0.5, over ? '#2c3036' : '#24282d');
        g.addColorStop(1, '#0d0e10');
      } else {
        g.addColorStop(0, '#202020');
        g.addColorStop(0.5, '#e0e0e0');
        g.addColorStop(1, '#202020');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, tow, tow);
      // fibre lines
      ctx.strokeStyle = kind === 'color' ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      for (let k = 2; k < tow; k += 4) {
        ctx.beginPath();
        if (over) {
          ctx.moveTo(x, y + k);
          ctx.lineTo(x + tow, y + k);
        } else {
          ctx.moveTo(x + k, y);
          ctx.lineTo(x + k, y + tow);
        }
        ctx.stroke();
      }
    }
  const t = finish(new THREE.CanvasTexture(c), kind === 'color');
  cache.set(key, t);
  return t;
}

/** Fine metallic flake for metallic paints (used as a subtle bump/roughness map). */
export function flakeNoise(): THREE.Texture {
  const hit = cache.get('flake');
  if (hit) return hit;
  const N = 256;
  const [c, ctx] = canvas(N, N);
  const img = ctx.createImageData(N, N);
  let seed = 7;
  for (let i = 0; i < N * N; i++) {
    seed = (seed * 16807) % 2147483647;
    const v = 120 + ((seed % 1000) / 1000) * 120;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(new THREE.CanvasTexture(c), false);
  cache.set('flake', t);
  return t;
}

/**
 * Rim texture for a lathe-built rim. u runs around the wheel, v across the rim profile:
 * [0, 0.5) = drive side (outer → inner), [0.5, 1] = other side (inner → outer).
 * Logos are printed on both sidewalls; the far side is mirrored so it reads correctly from that side.
 */
export function rimTexture(look: WheelLook, carbon: boolean, depthMm: number): THREE.Texture {
  const key = `rim-${look.decalText}-${look.decalSub}-${look.decalColor}-${look.decalStyle}-${look.rim}-${depthMm}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 4096;
  const H = 512;
  const [c, ctx] = canvas(W, H);
  const base = look.rim === 'alloy-silver' ? '#b8c0c9' : look.rim.startsWith('alloy') ? '#24272b' : '#15171a';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  if (carbon) {
    // faint weave showing through the lacquer
    const weave = (carbonWeave('color') as THREE.CanvasTexture).image as HTMLCanvasElement;
    ctx.globalAlpha = look.rim === 'carbon-gloss' ? 0.55 : 0.35;
    for (let x = 0; x < W; x += 64) for (let y = 0; y < H; y += 64) ctx.drawImage(weave, x, y, 64, 64);
    ctx.globalAlpha = 1;
  }
  const band = (v0: number, v1: number, mirror: boolean) => {
    const y0 = v0 * H;
    const h = (v1 - v0) * H;
    const bold = look.decalStyle === 'bold';
    const fs = h * (bold ? 0.62 : 0.5);
    ctx.save();
    ctx.translate(0, y0 + h / 2);
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = look.decalColor;
    ctx.globalAlpha = bold ? 1 : 0.85;
    ctx.textBaseline = 'middle';
    for (const start of [0.06, 0.56]) {
      ctx.font = `${bold ? 900 : 800} ${fs}px Inter, Arial, sans-serif`;
      const x = start * W;
      // Text runs along u; glyphs scaled vertically to fit the sidewall band.
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(1, -1);
      ctx.fillText(look.decalText.split('').join(String.fromCharCode(8202)), 0, 0);
      const mw = ctx.measureText(look.decalText).width;
      if (look.decalSub) {
        ctx.font = `700 ${fs * 0.42}px Inter, Arial, sans-serif`;
        ctx.fillText(look.decalSub, mw + fs * 0.5, fs * 0.08);
      }
      ctx.restore();
    }
    ctx.restore();
  };
  // Sidewall bands (both sides), leaving the brake track and spoke bed clear.
  band(0.07, 0.38, false);
  band(0.62, 0.93, true);
  const t = finish(new THREE.CanvasTexture(c));
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

/**
 * Tyre texture for a lathe-built tyre. u around the wheel, v across the profile from one bead to the other.
 * Tan or black sidewalls, tread band in the middle, brand printed on both sidewalls.
 */
export function tyreTexture(t: Tyres): THREE.Texture {
  const key = `tyre-${t.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 4096;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  const wall = t.sidewall === 'tan' ? '#b98c55' : '#1b1c1e';
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // Tread band
  const t0 = 0.3 * H;
  const t1 = 0.7 * H;
  ctx.fillStyle = '#141516';
  ctx.fillRect(0, t0, W, t1 - t0);
  if (t.tread !== 'slick') {
    ctx.fillStyle = '#0a0a0b';
    const step = t.tread === 'knob' ? 34 : 12;
    for (let x = 0; x < W; x += step)
      for (let y = t0 + 4; y < t1 - 4; y += step * 0.8) {
        const s = t.tread === 'knob' ? 14 : 3;
        ctx.fillRect(x + ((y / step) % 2) * step * 0.5, y, s, s * 0.8);
      }
  }
  // Brand on both sidewalls (second one mirrored)
  const label = `${t.brand.toUpperCase()}   ${t.name.toUpperCase()}`;
  const draw = (yMid: number, mirror: boolean) => {
    ctx.save();
    ctx.translate(0, yMid);
    // The tyre profile runs bead → crown (outwards), the opposite way to the rim, so unlike the rim
    // decals the print is not flipped vertically; the drive-side band is mirrored horizontally.
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = t.sidewall === 'tan' ? '#2a1e10' : t.brand === 'Pirelli' ? '#e7c51d' : '#c9ccd0';
    ctx.font = `800 ${H * 0.11}px Inter, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    for (const x of [0.12, 0.62]) ctx.fillText(label, x * W, 0);
    ctx.restore();
  };
  draw(0.17 * H, false);
  draw(0.83 * H, true);
  const tex = finish(new THREE.CanvasTexture(c));
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, tex);
  return tex;
}

/** Brake rotor: alpha map with cooling holes and a 6-arm carrier. */
export function rotorAlpha(): THREE.Texture {
  const hit = cache.get('rotor');
  if (hit) return hit;
  const N = 512;
  const [c, ctx] = canvas(N, N);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, N, N);
  const cx = N / 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cx, N * 0.5, 0, Math.PI * 2);
  ctx.arc(cx, cx, N * 0.38, 0, Math.PI * 2, true);
  ctx.fill();
  // holes in the braking track
  ctx.fillStyle = '#000';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = N * (0.43 + (i % 2) * 0.03);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, N * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  // carrier arms and centre
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(N * 0.09, -N * 0.025);
    ctx.quadraticCurveTo(N * 0.25, -N * 0.07, N * 0.4, -N * 0.03);
    ctx.lineTo(N * 0.4, N * 0.03);
    ctx.quadraticCurveTo(N * 0.25, N * 0.01, N * 0.09, N * 0.025);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cx, N * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx, cx, N * 0.045, 0, Math.PI * 2);
  ctx.fill();
  const t = finish(new THREE.CanvasTexture(c), false, false);
  cache.set('rotor', t);
  return t;
}

/** Diagonal bar-tape wrap, used as a bump map. */
export function barTapeBump(): THREE.Texture {
  const hit = cache.get('tape');
  if (hit) return hit;
  const N = 128;
  const [c, ctx] = canvas(N, N);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, N, N);
  ctx.strokeStyle = '#202020';
  ctx.lineWidth = 3;
  for (let k = -N; k < N * 2; k += 22) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + N * 0.6, N);
    ctx.stroke();
  }
  const t = finish(new THREE.CanvasTexture(c), false);
  cache.set('tape', t);
  return t;
}

/** Text label on a transparent canvas, for frame decals. */
export function labelTexture(text: string, color: string, opts: { italic?: boolean; weight?: number } = {}): THREE.Texture {
  const key = `label-${text}-${color}-${opts.italic}-${opts.weight}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 2048;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = color;
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 900} ${H * 0.7}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Fit to width
  const w = ctx.measureText(text).width;
  const k = Math.min(1, (W * 0.94) / w);
  ctx.save();
  ctx.translate(W / 2, H / 2 + H * 0.04);
  ctx.scale(k, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  const t = finish(new THREE.CanvasTexture(c), true, false);
  cache.set(key, t);
  return t;
}

/** Studio sweep background (soft grey gradient) or a scene painted out of focus, like a photo background. */
export function backgroundTexture(scene: string): THREE.Texture {
  const key = `bg-${scene}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 1600;
  const H = 900;
  const [c, ctx] = canvas(W, H);
  if (scene === 'studio') {
    const g = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.75);
    g.addColorStop(0, '#f7f8fa');
    g.addColorStop(0.6, '#e6e9ed');
    g.addColorStop(1, '#cfd4da');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Draw sharp, then blur heavily: reads as a real background out of focus behind the bike.
    const [c2, ctx2] = canvas(W, H);
    drawBackdrop(ctx2, W, H, scene, 0.72);
    ctx.filter = 'blur(14px) saturate(0.85)';
    ctx.drawImage(c2, -20, -20, W + 40, H + 40);
    ctx.filter = 'none';
    // gentle vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  const t = finish(new THREE.CanvasTexture(c), true, false);
  cache.set(key, t);
  return t;
}
