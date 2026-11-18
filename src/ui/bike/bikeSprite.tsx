import { renderToStaticMarkup } from 'react-dom/server';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Position } from '../../physics/types';
import type { Colourway, WheelLook } from '../../types/components';
import { BikeIllustration } from '../builder/BikeIllustration';
import { cockpitGeometry, frameDrawing, S, WHEEL_Y, type Pt } from './frameShape';
import { RIM_COLORS, TAN_WALL } from './paint';

/** Key points of the side-view drawing (in its 920 × 520 coordinate space), for placing wheels and a rider. */
export interface BikeLayout {
  rear: Pt;
  front: Pt;
  bb: Pt;
  saddle: Pt;
  hoods: Pt;
  pads: Pt;
  extensions: Pt;
  groundY: number;
  R: number;
  tyreH: number;
  rimOuter: number;
  rimH: number;
  look: WheelLook;
  tanWall: boolean;
  rearDisc: boolean;
  discBrakes: boolean;
}

export function bikeLayout(parts: ResolvedBuild): BikeLayout {
  const fd = frameDrawing(parts.frame);
  const g = fd.g;
  const ck = cockpitGeometry(fd, parts.handlebars);
  const R = (311 + parts.tyres.widthMm) * S;
  const groundY = WHEEL_Y + (311 + 45) * S + 2;
  const lift = groundY - 2 - (WHEEL_Y + R);
  const up = (p: Pt): Pt => ({ x: p.x, y: p.y + lift });
  const tyreH = parts.tyres.widthMm * S * 0.95;
  const rimOuter = R - tyreH;
  const look = parts.wheels.look;
  return {
    rear: up(g.rear),
    front: up(g.front),
    bb: up(g.bb),
    saddle: up({ x: fd.post.b.x - 4, y: fd.post.b.y - 12 }),
    hoods: up(ck.hoods),
    pads: up(ck.pads),
    extensions: up(ck.extensions),
    groundY,
    R,
    tyreH,
    rimOuter,
    rimH: Math.max(((look.depthFront ?? parts.wheels.rimDepthMm) + (look.depthRear ?? parts.wheels.rimDepthMm)) * 0.5 * S, 6),
    look,
    tanWall: parts.tyres.sidewall === 'tan',
    rearDisc: parts.wheels.profile === 'disc',
    discBrakes: parts.frame.compat.brakeType === 'disc',
  };
}

const cache = new Map<string, Promise<HTMLImageElement>>();

/** The bike without wheels, as an image the ride animation can draw on a canvas (realistic render if possible). */
export function bikeSprite(parts: ResolvedBuild, colourway: Colourway): Promise<HTMLImageElement> {
  const key = JSON.stringify([Object.values(parts).map((p) => p.id), colourway]);
  let p = cache.get(key);
  if (!p) {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    const svgFallback = () => {
      const svg = renderToStaticMarkup(<BikeIllustration build={parts} colourway={colourway} wheels={false} floorLine={false} shadow={false} />);
      return load(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
    };
    p = import('./three/snapshot')
      .then((m) => m.bikeSnapshot(parts, colourway, { wheels: false, shadow: false, width: 1400 }))
      .then((url) => (url ? load(url) : svgFallback()))
      .catch(svgFallback);
    cache.set(key, p);
  }
  return p;
}

const wheelCache = new Map<string, Promise<HTMLImageElement | null>>();

/** Realistic image of both wheels (same coordinates as the bike sprite), for spinning in the animation. */
export function wheelSprite(parts: ResolvedBuild, colourway: Colourway): Promise<HTMLImageElement | null> {
  const key = JSON.stringify([parts.wheels.id, parts.tyres.id, parts.frame.compat.brakeType, parts.frame.frameType]);
  let p = wheelCache.get(key);
  if (!p) {
    p = import('./three/snapshot')
      .then((m) => m.bikeSnapshot(parts, colourway, { only: 'wheels', shadow: false, width: 1400 }))
      .then(
        (url) =>
          url
            ? new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = url;
              })
            : null,
      )
      .catch(() => null);
    wheelCache.set(key, p);
  }
  return p;
}

/** Draw one wheel from the wheel image, rotated by the wheel's spin. */
function wheelFromImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, c: Pt, R: number, phase: number) {
  const k = img.naturalWidth / 920;
  const r = R * 1.04;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(phase);
  ctx.drawImage(img, (c.x - r - 40) * k, (c.y - r - 60) * k, 2 * r * k, 2 * r * k, -r, -r, 2 * r, 2 * r);
  ctx.restore();
}

function wheel(ctx: CanvasRenderingContext2D, c: Pt, L: BikeLayout, phase: number, solidDisc: boolean) {
  const { R, tyreH, rimOuter, rimH, look } = L;
  ctx.lineWidth = tyreH;
  ctx.strokeStyle = '#1d232b';
  ctx.beginPath();
  ctx.arc(c.x, c.y, R - tyreH / 2, 0, Math.PI * 2);
  ctx.stroke();
  if (L.tanWall) {
    ctx.lineWidth = tyreH * 0.5;
    ctx.strokeStyle = TAN_WALL;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R - tyreH * 0.68, 0, Math.PI * 2);
    ctx.stroke();
  }
  const rimInner = rimOuter - rimH;
  if (solidDisc) {
    ctx.fillStyle = '#1f252c';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rimOuter, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = look.spokes ?? (look.rim === 'alloy-silver' ? '#9aa5b1' : '#4a515a');
    ctx.lineWidth = look.spokes ? 2.4 : 1.6;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = phase + (i / 20) * Math.PI * 2;
      ctx.moveTo(c.x + Math.cos(a) * 12, c.y + Math.sin(a) * 12);
      ctx.lineTo(c.x + Math.cos(a + (i % 2 ? 0.12 : -0.12)) * rimInner, c.y + Math.sin(a + (i % 2 ? 0.12 : -0.12)) * rimInner);
    }
    ctx.stroke();
    ctx.lineWidth = rimH;
    ctx.strokeStyle = RIM_COLORS[look.rim];
    ctx.beginPath();
    ctx.arc(c.x, c.y, rimOuter - rimH / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Decal marks rotate with the wheel, so you can see it spin.
  ctx.strokeStyle = look.decalColor;
  ctx.globalAlpha = look.decalStyle === 'bold' ? 0.95 : 0.6;
  ctx.lineWidth = Math.max(3, rimH * (look.decalStyle === 'bold' ? 0.45 : 0.25));
  for (const off of [0, Math.PI]) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, rimOuter - rimH / 2, phase + off, phase + off + 0.55);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (L.discBrakes) {
    ctx.strokeStyle = '#a7b1bd';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#2f3741';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
  ctx.fill();
}

/** Two-segment limb from a to b with a joint bending towards `bend` (+1 forward, −1 back). */
function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, l1: number, l2: number, bend: 1 | -1, width: number, color: string) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5);
  const base = Math.atan2(dy, dx);
  const ang = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const j = { x: a.x + Math.cos(base - bend * ang) * l1, y: a.y + Math.sin(base - bend * ang) * l1 };
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(j.x, j.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/**
 * Draw the configured bike with spinning wheels and a pedalling rider, standing on the road at (x, y)
 * and tilted by `angle`. `pxPerUnit` scales the 920-wide drawing to the canvas.
 */
export function drawBikeAndRider(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  L: BikeLayout,
  opts: { x: number; y: number; angle: number; pxPerUnit: number; wheelPhase: number; crank: number; kit: string; position: Position; wheels?: HTMLImageElement | null },
) {
  ctx.save();
  ctx.translate(opts.x, opts.y);
  ctx.rotate(opts.angle);
  ctx.scale(opts.pxPerUnit, opts.pxPerUnit);
  ctx.translate(-(L.rear.x + L.front.x) / 2, -L.groundY);

  const crankLen = 172.5 * S;
  const pedal = (a: number) => ({ x: L.bb.x + Math.cos(a) * crankLen, y: L.bb.y + Math.sin(a) * crankLen });
  const hip = { x: L.saddle.x + 6, y: L.saddle.y - 14 };
  // Hands (or elbows on aero pads), then tilt the torso until the arms reach them.
  const hands = opts.position === 'aero' ? L.pads : opts.position === 'drops' ? { x: L.hoods.x - 14, y: L.hoods.y + 58 } : L.hoods;
  const reach = opts.position === 'aero' ? 150 : 250;
  const torso = 280;
  let torsoAngle = 0.5;
  let best = Infinity;
  for (let a = 0.05; a <= 1.3; a += 0.01) {
    const sx = hip.x + Math.cos(a) * torso;
    const sy = hip.y - Math.sin(a) * torso;
    const err = Math.abs(Math.hypot(hands.x - sx, hands.y - sy) - reach);
    if (err < best) {
      best = err;
      torsoAngle = a;
    }
  }
  const shoulder = { x: hip.x + Math.cos(torsoAngle) * torso, y: hip.y - Math.sin(torsoAngle) * torso };
  const shorts = '#15171a';
  const skin = '#c98f68';

  // Far leg behind the bike
  limb(ctx, hip, pedal(opts.crank + Math.PI), 218, 218, 1, 34, '#0e1012');
  if (opts.wheels) {
    wheelFromImage(ctx, opts.wheels, L.rear, L.R, opts.wheelPhase);
    wheelFromImage(ctx, opts.wheels, L.front, L.R, opts.wheelPhase);
  } else {
    wheel(ctx, L.rear, L, opts.wheelPhase, L.rearDisc);
    wheel(ctx, L.front, L, opts.wheelPhase, false);
  }
  ctx.drawImage(img, 40, 60, 920, 520);

  // Near leg
  limb(ctx, hip, pedal(opts.crank), 218, 218, 1, 40, shorts);
  ctx.fillStyle = '#20252b';
  const p = pedal(opts.crank);
  ctx.fillRect(p.x - 18, p.y - 8, 40, 14);
  // Torso
  ctx.strokeStyle = opts.kit;
  ctx.lineWidth = 64;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.stroke();
  // Arm
  if (opts.position === 'aero') {
    limb(ctx, { x: shoulder.x, y: shoulder.y + 8 }, L.pads, 150, 1, -1, 26, opts.kit);
    ctx.strokeStyle = skin;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(L.pads.x, L.pads.y);
    ctx.lineTo(L.extensions.x, L.extensions.y);
    ctx.stroke();
  } else {
    limb(ctx, { x: shoulder.x, y: shoulder.y + 8 }, hands, 140, 140, -1, 24, skin);
  }
  // Head and helmet
  const head = { x: shoulder.x + 62, y: shoulder.y - 44 };
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(head.x, head.y + 8, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = opts.kit;
  ctx.beginPath();
  ctx.ellipse(head.x - 6, head.y - 6, 50, 34, -0.25, Math.PI, Math.PI * 2.05);
  ctx.fill();
  ctx.restore();
}
