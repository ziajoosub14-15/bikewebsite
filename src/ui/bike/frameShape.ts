import type { Frame, FrameShapeData, FrameType, Handlebars } from '../../types/components';
import type { TubeId } from './paint';

/** Drawing units per millimetre (the side view is drawn at half scale). */
export const S = 0.5;
export const WHEEL_Y = 390;

export type Pt = { x: number; y: number };
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const unit = (a: Pt): Pt => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
/** Perpendicular pointing towards the front of the bike (+x). */
const forwardNormal = (d: Pt): Pt => {
  const n = { x: -d.y, y: d.x };
  return n.x >= 0 ? n : { x: -n.x, y: -n.y };
};
/** Perpendicular pointing up the screen (−y). */
const upNormal = (d: Pt): Pt => {
  const n = { x: -d.y, y: d.x };
  return n.y <= 0 ? n : { x: -n.x, y: -n.y };
};

export interface FrameGeo {
  rear: Pt;
  front: Pt;
  bb: Pt;
  seatTop: Pt;
  headTop: Pt;
  headBottom: Pt;
  /** Base tube size (drawing units) for this frame type. */
  tube: number;
}

/** Key points of the side view per frame type: endurance/gravel sit taller, TT is long, low and steep. */
export function geometry(type: FrameType): FrameGeo {
  const rear = { x: 255, y: WHEEL_Y };
  switch (type) {
    case 'endurance':
      return { rear, front: { x: 758, y: WHEEL_Y }, bb: { x: 457, y: 426 }, seatTop: { x: 378, y: 160 }, headTop: { x: 642, y: 118 }, headBottom: { x: 672, y: 222 }, tube: 14 };
    case 'gravel':
      return { rear, front: { x: 768, y: WHEEL_Y }, bb: { x: 460, y: 422 }, seatTop: { x: 380, y: 168 }, headTop: { x: 646, y: 122 }, headBottom: { x: 678, y: 226 }, tube: 14 };
    case 'tt':
      return { rear, front: { x: 760, y: WHEEL_Y }, bb: { x: 462, y: 428 }, seatTop: { x: 418, y: 170 }, headTop: { x: 664, y: 176 }, headBottom: { x: 680, y: 230 }, tube: 19 };
    case 'aero':
      return { rear, front: { x: 752, y: WHEEL_Y }, bb: { x: 457, y: 428 }, seatTop: { x: 374, y: 150 }, headTop: { x: 652, y: 142 }, headBottom: { x: 674, y: 218 }, tube: 16 };
    case 'climbing':
    default:
      return { rear, front: { x: 752, y: WHEEL_Y }, bb: { x: 457, y: 428 }, seatTop: { x: 374, y: 150 }, headTop: { x: 650, y: 140 }, headBottom: { x: 672, y: 216 }, tube: 13 };
  }
}

const DEFAULT_SHAPES: Record<FrameType, FrameShapeData> = {
  aero: {
    stCurve: 12, ttJoin: 0.9, ttBend: 0, dtBend: 0, stayJoin: 0.66, stays: 'straight',
    depth: { dt: [1.85, 1.55], tt: [1.0, 1.25], st: [1.6, 1.2], ht: 1.75, cs: [0.6, 1.1], ss: [0.42, 0.55], fork: 1.45 },
    nose: 0, headUp: 0, fork: 'curved', lugs: false, isoFlow: false, futureShock: false, bento: false, seatMast: false, offAxisPost: false,
  },
  climbing: {
    stCurve: 3, ttJoin: 0.93, ttBend: 0, dtBend: 0, stayJoin: 0.86, stays: 'straight',
    depth: { dt: [1.75, 1.45], tt: [1.15, 1.25], st: [1.35, 1.15], ht: 1.85, cs: [0.7, 1.2], ss: [0.5, 0.62], fork: 1.5 },
    nose: 0, headUp: 0, fork: 'curved', lugs: false, isoFlow: false, futureShock: false, bento: false, seatMast: false, offAxisPost: false,
  },
  endurance: {
    stCurve: 5, ttJoin: 0.9, ttBend: 0, dtBend: 0, stayJoin: 0.72, stays: 'straight',
    depth: { dt: [1.75, 1.45], tt: [1.1, 1.2], st: [1.35, 1.1], ht: 1.8, cs: [0.7, 1.15], ss: [0.48, 0.6], fork: 1.45 },
    nose: 0, headUp: 6, fork: 'curved', lugs: false, isoFlow: false, futureShock: false, bento: false, seatMast: false, offAxisPost: false,
  },
  gravel: {
    stCurve: 5, ttJoin: 0.88, ttBend: 0, dtBend: 0, stayJoin: 0.72, stays: 'straight',
    depth: { dt: [1.8, 1.5], tt: [1.1, 1.2], st: [1.35, 1.1], ht: 1.8, cs: [0.75, 1.2], ss: [0.5, 0.62], fork: 1.5 },
    nose: 0, headUp: 4, fork: 'curved', lugs: false, isoFlow: false, futureShock: false, bento: false, seatMast: false, offAxisPost: false,
  },
  tt: {
    stCurve: 26, ttJoin: 0.9, ttBend: 0, dtBend: 0, stayJoin: 0.55, stays: 'straight',
    depth: { dt: [1.7, 1.5], tt: [0.95, 1.2], st: [1.7, 1.3], ht: 1.6, cs: [0.55, 0.9], ss: [0.35, 0.45], fork: 1.25 },
    nose: 10, headUp: 0, fork: 'bayonet', lugs: false, isoFlow: false, futureShock: false, bento: true, seatMast: true, offAxisPost: false,
  },
};

export function resolveShape(frame: Frame): FrameShapeData {
  const base = DEFAULT_SHAPES[frame.frameType];
  const o = frame.shape ?? {};
  return { ...base, ...o, depth: { ...base.depth, ...(o.depth ?? {}) } };
}

/** Quadratic Bézier from a to b with control c. */
export interface Bez {
  a: Pt;
  c: Pt;
  b: Pt;
}
export const bezAt = (z: Bez, t: number): Pt => {
  const u = 1 - t;
  return { x: u * u * z.a.x + 2 * u * t * z.c.x + t * t * z.b.x, y: u * u * z.a.y + 2 * u * t * z.c.y + t * t * z.b.y };
};
export const bezTangent = (z: Bez, t: number): Pt =>
  unit({ x: 2 * (1 - t) * (z.c.x - z.a.x) + 2 * t * (z.b.x - z.c.x), y: 2 * (1 - t) * (z.c.y - z.a.y) + 2 * t * (z.b.y - z.c.y) });
const straight = (a: Pt, b: Pt): Bez => ({ a, b, c: lerp(a, b, 0.5) });
const bowed = (a: Pt, b: Pt, offset: number, normal: (d: Pt) => Pt, at = 0.5): Bez => ({ a, b, c: add(lerp(a, b, at), mul(normal(unit(sub(b, a))), offset)) });

/** One logical tube, possibly made of several curved pieces. Widths run from `wa` (t = 0) to `wb` (t = 1). */
export interface TubeDef {
  id: TubeId;
  /** Lateral offset for 3D (stays and fork legs are on both sides). */
  pieces: { bez: Bez; r0: number; r1: number }[];
  wa: number;
  wb: number;
}

export interface FrameDrawing {
  g: FrameGeo;
  shape: FrameShapeData;
  headTop: Pt;
  seatCluster: Pt;
  stayJoin: Pt;
  tubes: { seatstay: TubeDef; chainstay: TubeDef; seat: TubeDef; top: TubeDef; down: TubeDef; fork: TubeDef; head: TubeDef };
  /** Seatpost from the top of the seat tube to the saddle clamp. */
  post: { a: Pt; b: Pt; dir: Pt };
  nose?: Pt[];
  isoFlow?: { c: Pt; rx: number; ry: number; angleDeg: number };
  bento?: { a: Pt; b: Pt; h: number };
  /** Unit vector up the head tube. */
  headUp: Pt;
}

export function tubeWidthAt(t: TubeDef, x: number): number {
  return t.wa + (t.wb - t.wa) * x;
}

export function frameDrawing(frame: Frame): FrameDrawing {
  const g = geometry(frame.frameType);
  const sh = resolveShape(frame);
  const T = g.tube;
  const d = sh.depth;

  const headUpDir = unit(sub(g.headTop, g.headBottom));
  const headTop = add(g.headTop, mul(headUpDir, sh.headUp));

  // Seat tube bows forward around the rear wheel (control point in its lower half).
  const seatBez = bowed(g.bb, g.seatTop, sh.stCurve, forwardNormal, 0.42);
  const seat: TubeDef = { id: 'seat', pieces: [{ bez: seatBez, r0: 0, r1: 1 }], wa: T * d.st[0], wb: T * d.st[1] };
  const seatCluster = bezAt(seatBez, sh.ttJoin);
  const stayJoin = bezAt(seatBez, sh.stayJoin);

  const topEnd = { x: headTop.x + 2, y: headTop.y + 8 };
  const top: TubeDef = { id: 'top', pieces: [{ bez: bowed(seatCluster, topEnd, sh.ttBend, upNormal), r0: 0, r1: 1 }], wa: T * d.tt[0], wb: T * d.tt[1] };
  const down: TubeDef = { id: 'down', pieces: [{ bez: bowed(g.bb, g.headBottom, -sh.dtBend, upNormal), r0: 0, r1: 1 }], wa: T * d.dt[0], wb: T * d.dt[1] };
  const head: TubeDef = { id: 'head', pieces: [{ bez: straight(headTop, g.headBottom), r0: 0, r1: 1 }], wa: T * d.ht, wb: T * d.ht * 1.22 };
  const chainstay: TubeDef = { id: 'chainstay', pieces: [{ bez: bowed(g.rear, g.bb, -3, upNormal), r0: 0, r1: 1 }], wa: T * d.cs[0], wb: T * d.cs[1] };

  // Seat stays: straight, wavy (Pinarello "Onda") or bowed (Pinarello Dogma X "X-stays").
  let ssPieces: TubeDef['pieces'];
  if (sh.stays === 'wavy') {
    const m = lerp(g.rear, stayJoin, 0.5);
    ssPieces = [
      { bez: bowed(g.rear, m, 6, upNormal), r0: 0, r1: 0.5 },
      { bez: bowed(m, stayJoin, -6, upNormal), r0: 0.5, r1: 1 },
    ];
  } else if (sh.stays === 'bowed') {
    ssPieces = [{ bez: bowed(g.rear, stayJoin, -11, upNormal), r0: 0, r1: 1 }];
  } else ssPieces = [{ bez: straight(g.rear, stayJoin), r0: 0, r1: 1 }];
  const seatstay: TubeDef = { id: 'seatstay', pieces: ssPieces, wa: T * d.ss[0], wb: T * d.ss[1] };

  // Fork: crown at the bottom of the head tube, down to the front axle.
  const crown = g.headBottom;
  let forkPieces: TubeDef['pieces'];
  if (sh.fork === 'wavy') {
    const m = lerp(crown, g.front, 0.5);
    forkPieces = [
      { bez: bowed(crown, m, 7, forwardNormal), r0: 0, r1: 0.5 },
      { bez: bowed(m, g.front, -7, forwardNormal), r0: 0.5, r1: 1 },
    ];
  } else if (sh.fork === 'straight' || sh.fork === 'bayonet') {
    forkPieces = [{ bez: straight(crown, g.front), r0: 0, r1: 1 }];
  } else {
    forkPieces = [{ bez: { a: crown, b: g.front, c: { x: g.front.x - 10, y: crown.y + (g.front.y - crown.y) * 0.55 } }, r0: 0, r1: 1 }];
  }
  const forkCrown = sh.fork === 'bayonet' ? T * d.fork * 1.35 : T * d.fork;
  const fork: TubeDef = { id: 'fork', pieces: forkPieces, wa: forkCrown, wb: T * 0.5 };

  // Seatpost: follows the seat tube, or (Y1Rs) leaves at a fixed 73.5° making a Y junction.
  const seatEndTangent = bezTangent(seatBez, 1);
  const postDir = sh.offAxisPost ? unit({ x: -Math.cos((73.5 * Math.PI) / 180), y: -Math.sin((73.5 * Math.PI) / 180) }) : seatEndTangent;
  const postStart = sh.offAxisPost ? add(g.seatTop, mul(postDir, -14)) : g.seatTop;
  const post = { a: postStart, b: add(g.seatTop, mul(postDir, 46)), dir: postDir };

  const out: FrameDrawing = {
    g,
    shape: sh,
    headTop,
    seatCluster,
    stayJoin,
    tubes: { seatstay, chainstay, seat, top, down, fork, head },
    post,
    headUp: headUpDir,
  };

  if (sh.nose > 0) {
    // Aero nose cone in front of the lower head tube, flowing into the fork crown.
    const fwd = forwardNormal(headUpDir);
    const hw = head.wb / 2;
    const hb = g.headBottom;
    out.nose = [
      add(add(hb, mul(headUpDir, (Math.hypot(headTop.x - hb.x, headTop.y - hb.y)) * 0.55)), mul(fwd, hw * 0.9)),
      add(add(hb, mul(headUpDir, 6)), mul(fwd, hw + sh.nose)),
      add(add(hb, mul(headUpDir, -12)), mul(fwd, hw + sh.nose * 0.45)),
      add(add(hb, mul(headUpDir, -18)), mul(fwd, hw * 0.7)),
    ];
  }
  if (sh.isoFlow) {
    const t = Math.min(0.95, sh.stayJoin + 0.09);
    const c = add(bezAt(seatBez, t), mul(forwardNormal(bezTangent(seatBez, t)), 1));
    const tan = bezTangent(seatBez, t);
    out.isoFlow = { c, rx: 15, ry: Math.max(3, seat.wb * 0.22), angleDeg: (Math.atan2(tan.y, tan.x) * 180) / Math.PI };
  }
  if (sh.bento) {
    const tb = top.pieces[0].bez;
    out.bento = { a: bezAt(tb, 0.6), b: bezAt(tb, 0.93), h: 9 };
  }
  return out;
}

/** Where the cockpit sits, for each style. Shared by the 2D drawing, the 3D model and the rider in the animation. */
export interface CockpitGeometry {
  /** Top of the steerer / spacer stack. */
  stemStart: Pt;
  /** Bar clamp (centre of the bar tops). */
  stemEnd: Pt;
  /** Where the drop curve begins (after any wing section). */
  dropsStart: Pt;
  hoods: Pt;
  pads: Pt;
  extensions: Pt;
  spacers: number;
}

export function cockpitGeometry(fd: FrameDrawing, bars: Handlebars): CockpitGeometry {
  const stemLen = (bars.integratedStemMm ?? 100) * S;
  const h = fd.headTop;
  const fwd = forwardNormal(fd.headUp);
  let stemStart: Pt;
  let stemEnd: Pt;
  let spacers = 9;
  if (bars.style === 'y-cockpit') {
    // Fixed into a recess in the head tube: no spacers, no visible stem.
    spacers = 0;
    stemStart = add(h, mul(fwd, 4));
    stemEnd = { x: h.x + stemLen * 0.92, y: h.y - 4 };
  } else {
    stemStart = add(h, mul(fd.headUp, spacers));
    stemEnd = { x: stemStart.x + stemLen, y: stemStart.y - stemLen * 0.12 + 4 };
  }
  let dropsStart = stemEnd;
  if (bars.style === 'wing-kink') dropsStart = { x: stemEnd.x + 22, y: stemEnd.y + 5 };
  if (bars.style === 'rise') dropsStart = { x: stemEnd.x + 16, y: stemEnd.y - 7 };
  return {
    stemStart,
    stemEnd,
    dropsStart,
    hoods: { x: dropsStart.x + 40, y: dropsStart.y + 2 },
    pads: { x: stemEnd.x + 2, y: stemEnd.y - 20 },
    extensions: { x: stemEnd.x + 88, y: stemEnd.y - 22 },
    spacers,
  };
}

/**
 * Spoke angles (hub, rim) for spoke i of n. Fronts are radial; rears are two-cross, Campagnolo G3
 * (groups of three) or Fulcrum 2:1 (drive-side pairs with single non-drive spokes).
 */
export function spokeAngles(i: number, n: number, lacing: 'radial' | '2x' | 'g3' | '2to1'): [number, number] {
  if (lacing === 'g3') {
    const group = Math.floor(i / 3);
    const k = i % 3;
    const base = (group / Math.ceil(n / 3)) * Math.PI * 2;
    const a = base + (k - 1) * 0.12;
    return [a, a + (k === 1 ? 0.25 : k === 0 ? -0.18 : 0.42)];
  }
  const a = (i / n) * Math.PI * 2;
  if (lacing === '2to1') return [a, a + (i % 3 === 2 ? 0 : i % 3 === 0 ? 0.36 : -0.36)];
  return [a, a + (lacing === 'radial' ? 0 : i % 2 ? 0.42 : -0.42)];
}
