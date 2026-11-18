/**
 * Painted scenes shown behind the bike in the builder (2D and 3D). Everything is drawn with the
 * Canvas 2D API from simple shapes, so there are no image files to load.
 * The road sits along the bottom of the scene; the bike stands on it.
 */

export interface Backdrop {
  id: string;
  name: string;
  /** Colour of the floor under the bike in the 3D view. */
  ground: string;
  /** Small swatch for the picker. */
  swatch: [string, string];
}

export const BACKDROPS: Backdrop[] = [
  { id: 'studio', name: 'Studio', ground: '#e2e8f0', swatch: ['#ffffff', '#cbd5e1'] },
  { id: 'mountain-dusk', name: 'Mountain road at dusk', ground: '#35323a', swatch: ['#f28c5b', '#4a2c4a'] },
  { id: 'desert', name: 'Desert highway', ground: '#3d3835', swatch: ['#8ec5ea', '#e0a35f'] },
  { id: 'city-night', name: 'City at night', ground: '#22242c', swatch: ['#0b1026', '#f2c94c'] },
  { id: 'alpine', name: 'Alpine pass', ground: '#4b4f55', swatch: ['#5aa9e6', '#5f8f52'] },
];

/** Small seeded random generator so scenes look the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sky(ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A jagged mountain ridge from left to right, filled down to the bottom. */
function ridge(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, color: string, seed: number, jag = 14) {
  const r = rng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  let y = base - r() * amp;
  const step = w / jag;
  for (let x = 0; x <= w + step; x += step) {
    y = base - amp * (0.25 + 0.75 * r());
    ctx.lineTo(x, y);
    ctx.lineTo(x + step * 0.5, y + amp * 0.35 * r());
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/** Smooth rolling hills or dunes. */
function hills(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, color: string, phase: number, period: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x / w) * Math.PI * period + phase)) - amp * 0.3 * Math.sin((x / w) * Math.PI * period * 2.3 + phase * 1.7));
  ctx.lineTo(w, h);
  ctx.fill();
}

function road(ctx: CanvasRenderingContext2D, w: number, h: number, top: number, asphalt: string, line: string, edge?: string) {
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, asphalt);
  g.addColorStop(1, shade(asphalt, -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h - top);
  if (edge) {
    ctx.fillStyle = edge;
    ctx.fillRect(0, top, w, Math.max(2, (h - top) * 0.06));
  }
  // Centre-line dashes, slightly behind the bike.
  ctx.fillStyle = line;
  const y = top + (h - top) * 0.32;
  const dh = Math.max(2, (h - top) * 0.05);
  const dw = w * 0.06;
  for (let x = -dw * 0.3; x < w; x += dw * 2) ctx.fillRect(x, y, dw, dh);
}

function shade(hex: string, amt: number): string {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  return '#' + n.map((v) => Math.round(v + (t - v) * k).toString(16).padStart(2, '0')).join('');
}

function sun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, core: string, glow: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, glow);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Paint a scene into a w × h area. `roadTop` is where the road starts as a fraction of the height
 * (the bike's tyres touch down a little below that).
 */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, id: string, roadTop = 0.84) {
  const rt = h * roadTop;
  switch (id) {
    case 'mountain-dusk': {
      sky(ctx, w, rt, [
        [0, '#1d2b5a'],
        [0.45, '#7d4a7e'],
        [0.75, '#e86f51'],
        [1, '#f7b267'],
      ]);
      sun(ctx, w * 0.72, rt * 0.7, h * 0.05, '#ffe2a8', 'rgba(255,190,120,0.55)');
      ridge(ctx, w, rt, rt * 0.62, rt * 0.3, '#8a4f6a', 7, 9);
      ridge(ctx, w, rt, rt * 0.8, rt * 0.32, '#5c3554', 11, 12);
      ridge(ctx, w, rt, rt * 0.97, rt * 0.28, '#35213a', 23, 16);
      ctx.fillStyle = '#35213a';
      ctx.fillRect(0, rt - 1, w, h - rt + 1);
      road(ctx, w, h, rt, '#35323a', 'rgba(255,255,255,0.55)', '#b9a28c');
      break;
    }
    case 'desert': {
      sky(ctx, w, rt, [
        [0, '#6fb2e3'],
        [0.7, '#cfe6f2'],
        [1, '#fbe3b9'],
      ]);
      sun(ctx, w * 0.82, rt * 0.22, h * 0.045, '#fffbe8', 'rgba(255,240,200,0.6)');
      hills(ctx, w, rt, rt * 0.86, rt * 0.16, '#efc58e', 0.4, 2.2);
      hills(ctx, w, rt, rt * 0.94, rt * 0.14, '#e2a865', 2.1, 3.1);
      hills(ctx, w, rt, rt * 1.02, rt * 0.12, '#d18f4c', 4.2, 4.3);
      ctx.fillStyle = '#d18f4c';
      ctx.fillRect(0, rt - 1, w, 2);
      road(ctx, w, h, rt, '#3d3835', 'rgba(255,255,255,0.75)', '#e2c08f');
      break;
    }
    case 'city-night': {
      sky(ctx, w, rt, [
        [0, '#070b1d'],
        [0.7, '#1b2250'],
        [1, '#3a2f5e'],
      ]);
      const r = rng(5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 70; i++) ctx.fillRect(r() * w, r() * rt * 0.55, 1.2, 1.2);
      // Skyline: two layers of buildings, one slender tall tower
      for (const [layer, color, maxH, seed] of [
        [0, '#161a36', 0.55, 3],
        [1, '#0d1026', 0.42, 9],
      ] as const) {
        const rr = rng(seed);
        let x = -10;
        while (x < w) {
          const bw = w * (0.03 + rr() * 0.05);
          const bh = rt * (0.15 + rr() * maxH);
          ctx.fillStyle = color;
          ctx.fillRect(x, rt - bh, bw, bh);
          // lit windows
          ctx.fillStyle = layer ? 'rgba(242,201,76,0.85)' : 'rgba(242,201,76,0.45)';
          for (let wy = rt - bh + 6; wy < rt - 6; wy += 9)
            for (let wx = x + 4; wx < x + bw - 4; wx += 7) if (rr() > 0.62) ctx.fillRect(wx, wy, 2.5, 3.5);
          x += bw + w * 0.004;
        }
      }
      ctx.fillStyle = '#0d1026';
      const tx = w * 0.63;
      ctx.beginPath();
      ctx.moveTo(tx - w * 0.02, rt);
      ctx.lineTo(tx - w * 0.012, rt * 0.35);
      ctx.lineTo(tx - w * 0.004, rt * 0.2);
      ctx.lineTo(tx, rt * 0.04);
      ctx.lineTo(tx + w * 0.004, rt * 0.2);
      ctx.lineTo(tx + w * 0.012, rt * 0.35);
      ctx.lineTo(tx + w * 0.02, rt);
      ctx.fill();
      ctx.fillStyle = 'rgba(242,201,76,0.7)';
      for (let y = rt * 0.25; y < rt; y += rt * 0.05) ctx.fillRect(tx - 1, y, 2, 2);
      road(ctx, w, h, rt, '#22242c', 'rgba(255,255,255,0.7)', '#4a4f66');
      // light reflections on the road
      const g = ctx.createLinearGradient(0, rt, 0, h);
      g.addColorStop(0, 'rgba(242,201,76,0.12)');
      g.addColorStop(1, 'rgba(242,201,76,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, rt, w, h - rt);
      break;
    }
    case 'alpine': {
      sky(ctx, w, rt, [
        [0, '#3f8fd6'],
        [1, '#d8eefc'],
      ]);
      // Snowy peaks
      const r = rng(17);
      const peaks = 6;
      for (let i = 0; i < peaks; i++) {
        const px = (i + 0.3 + r() * 0.4) * (w / (peaks - 1)) - w * 0.1;
        const ph = rt * (0.35 + r() * 0.3);
        const bw = w * (0.16 + r() * 0.1);
        ctx.fillStyle = '#7f8fa1';
        ctx.beginPath();
        ctx.moveTo(px - bw, rt * 0.82);
        ctx.lineTo(px, rt * 0.82 - ph);
        ctx.lineTo(px + bw, rt * 0.82);
        ctx.fill();
        ctx.fillStyle = '#f5f8fb';
        ctx.beginPath();
        ctx.moveTo(px - bw * 0.3, rt * 0.82 - ph * 0.7);
        ctx.lineTo(px, rt * 0.82 - ph);
        ctx.lineTo(px + bw * 0.3, rt * 0.82 - ph * 0.7);
        ctx.lineTo(px + bw * 0.12, rt * 0.82 - ph * 0.62);
        ctx.lineTo(px, rt * 0.82 - ph * 0.72);
        ctx.lineTo(px - bw * 0.14, rt * 0.82 - ph * 0.6);
        ctx.fill();
      }
      hills(ctx, w, rt, rt * 0.86, rt * 0.12, '#6a9a5b', 1.2, 2.5);
      hills(ctx, w, rt, rt * 0.96, rt * 0.1, '#4f7f46', 3.4, 3.7);
      // Pine trees
      const rr = rng(29);
      for (let i = 0; i < 26; i++) {
        const x = rr() * w;
        const th = rt * (0.06 + rr() * 0.06);
        const y = rt * (0.9 + rr() * 0.08);
        ctx.fillStyle = '#2f5a33';
        ctx.beginPath();
        ctx.moveTo(x, y - th);
        ctx.lineTo(x + th * 0.32, y);
        ctx.lineTo(x - th * 0.32, y);
        ctx.fill();
      }
      ctx.fillStyle = '#4f7f46';
      ctx.fillRect(0, rt - 1, w, 2);
      road(ctx, w, h, rt, '#4b4f55', 'rgba(255,255,255,0.8)', '#8a9a7a');
      break;
    }
    case 'studio':
    default: {
      const g = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, Math.max(w, h) * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.6, '#f1f5f9');
      g.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

/** Scenery for the ride animation: matches the route where we can, otherwise the builder's scene. */
export function sceneForRoute(routeId: string, fallback: string): string {
  const byRoute: Record<string, string> = {
    'flat-tt': 'desert',
    rolling: 'alpine',
    'jebel-jais': 'mountain-dusk',
    alpine: 'alpine',
    descent: 'mountain-dusk',
  };
  return byRoute[routeId] ?? (fallback === 'studio' ? 'mountain-dusk' : fallback);
}
