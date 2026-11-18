import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Colourway, Finish } from '../../types/components';
import { geometry, lerp, S, WHEEL_Y, type Pt } from '../builder/BikeIllustration';
import { RIM_COLORS, TAN_WALL, tubeSegments, tubeStripes, type TubeId } from './paint';

type V3 = THREE.Vector3;
const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

const VIEWS = {
  'three-quarter': { label: '3/4', pos: [1.65, 0.95, 1.85] },
  side: { label: 'Side', pos: [0.05, 0.58, 2.65] },
  'non-drive': { label: 'Other side', pos: [0.05, 0.58, -2.65] },
  front: { label: 'Front', pos: [2.4, 0.8, 0.02] },
  rear: { label: 'Rear', pos: [-2.4, 0.8, 0.02] },
  top: { label: 'Top', pos: [0.02, 2.8, 0.25] },
} as const;
type ViewId = keyof typeof VIEWS;

// ───────────────────────── Materials ─────────────────────────

class Materials {
  private cache = new Map<string, THREE.Material>();
  paint(color: string, finish: Finish): THREE.Material {
    const key = `p|${color}|${finish}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({
        color,
        roughness: finish === 'matte' ? 0.72 : finish === 'metallic' ? 0.35 : 0.25,
        metalness: finish === 'metallic' ? 0.55 : 0.05,
        clearcoat: finish === 'matte' ? 0 : 1,
        clearcoatRoughness: 0.08,
        iridescence: finish === 'pearl' ? 0.7 : 0,
        iridescenceIOR: 1.6,
      });
      this.cache.set(key, m);
    }
    return m;
  }
  plain(color: string, roughness = 0.5, metalness = 0.1): THREE.Material {
    const key = `s|${color}|${roughness}|${metalness}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      this.cache.set(key, m);
    }
    return m;
  }
  dispose() {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
  }
}

// ───────────────────────── Geometry helpers ─────────────────────────

const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 24, 16);

/** A tube from a to b with an elliptical cross-section: rPlane in the bike's plane, rLat sideways. */
function tube(a: V3, b: V3, rPlane: number, rLat: number, mat: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const y = dir.normalize();
  let z = v3(0, 0, 1);
  if (Math.abs(y.dot(z)) > 0.95) z = v3(1, 0, 0);
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const z2 = new THREE.Vector3().crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z2);
  m.scale(v3(rPlane, len, rLat));
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  const mesh = new THREE.Mesh(UNIT_CYL, mat);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(m);
  mesh.castShadow = true;
  return mesh;
}

function blob(at: V3, rx: number, ry: number, rz: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_SPHERE, mat);
  m.position.copy(at);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function textTexture(text: string, color: string, opts: { italic?: boolean; weight?: number; w?: number; h?: number } = {}) {
  const w = opts.w ?? 1024;
  const h = opts.h ?? 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 900} ${Math.round(h * 0.72)}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + h * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Circular text for rim decals, drawn on a square canvas that maps onto a RingGeometry. */
function rimDecalTexture(text: string, color: string, radiusFrac: number, sizeFrac: number, bold: boolean) {
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.globalAlpha = bold ? 1 : 0.85;
  const fontPx = Math.max(10, sizeFrac * N * 0.5);
  ctx.font = `${bold ? 900 : 700} ${fontPx}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const r = radiusFrac * N * 0.5;
  for (const start of [0, Math.PI]) {
    const chars = text.split('');
    const spacing = fontPx * (bold ? 0.78 : 0.72);
    const total = chars.length * spacing;
    // Clockwise, so the letters read left to right with their tops facing outwards.
    let ang = start + total / r / 2;
    for (const ch of chars) {
      const a = ang - spacing / r / 2;
      ctx.save();
      ctx.translate(N / 2 + Math.cos(a) * r, N / 2 - Math.sin(a) * r);
      ctx.rotate(-a + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      ang -= spacing / r;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ───────────────────────── Bike builder ─────────────────────────

function buildBike(parts: ResolvedBuild, cw: Colourway, mats: Materials, textures: THREE.Texture[]): THREE.Group {
  const { frame, wheels, groupset, rearDerailleur: rd, handlebars: bars, saddle, tyres } = parts;
  const root = new THREE.Group();
  const g = geometry(frame.frameType);
  const Rm = (311 + tyres.widthMm) / 1000;
  // 2D drawing coordinates (px, y down, 0.5 px/mm) → metres (y up), axles at tyre-radius height.
  const P = (p: Pt, z = 0) => v3((p.x - 506) / S / 1000, Rm + (WHEEL_Y - p.y) / S / 1000, z);
  const mmR = (px: number) => px / S / 1000 / 2; // tube width in px → radius in m
  const xAt = (p: Pt) => (p.x - g.rear.x) / (g.front.x - g.rear.x);
  const aeroRatio = frame.frameType === 'tt' ? 0.42 : frame.frameType === 'aero' ? 0.55 : frame.frameType === 'climbing' ? 0.9 : 0.8;
  const comp = groupset.tier === 'pro' || groupset.tier === 'performance' ? '#1b2027' : '#4a525d';
  const compMat = mats.plain(comp, 0.35, 0.5);
  const black = mats.plain('#16191d', 0.6, 0.1);
  const silver = mats.plain('#c4ccd6', 0.25, 0.85);

  /** A frame tube painted per colourway, between two 2D points at given lateral offsets. */
  const painted = (a: Pt, b: Pt, za: number, zb: number, wPx: number, tubeId: TubeId, ratio = aeroRatio) => {
    const rP = mmR(wPx);
    const rL = rP * ratio;
    for (const seg of tubeSegments(cw, tubeId, (t) => xAt(lerp(a, b, t)))) {
      const p0 = lerp(a, b, seg.t0);
      const p1 = lerp(a, b, seg.t1);
      root.add(tube(P(p0, za + (zb - za) * seg.t0), P(p1, za + (zb - za) * seg.t1), rP, rL, mats.paint(seg.color, seg.finish)));
    }
    for (const st of tubeStripes(cw, tubeId)) {
      const p0 = lerp(a, b, st.t - st.width / 2);
      const p1 = lerp(a, b, st.t + st.width / 2);
      root.add(tube(P(p0, za), P(p1, za), rP * 1.04, rL * 1.04, mats.paint(st.color, 'gloss')));
    }
  };

  // ── Frame
  const seatCluster = lerp(g.bb, g.seatTop, 0.93);
  const stayJoin = lerp(g.bb, g.seatTop, g.stayJoin);
  const headTopJoin = { x: g.headTop.x + 2, y: g.headTop.y + 8 };
  painted(g.bb, g.seatTop, 0, 0, g.tube, 'seat');
  painted(seatCluster, headTopJoin, 0, 0, g.tube * 0.9, 'top');
  painted(g.bb, g.headBottom, 0, 0, g.tube * 1.3, 'down');
  painted(g.headTop, g.headBottom, 0, 0, g.tube * 1.15 + 2, 'head', 0.75);
  for (const side of [1, -1]) {
    painted(g.rear, g.bb, 0.066 * side, 0.035 * side, g.tube * 0.6, 'chainstay', 0.8);
    painted(g.rear, stayJoin, 0.064 * side, 0.016 * side, g.tube * 0.45, 'seatstay', 0.75);
    painted(g.headBottom, g.front, 0.032 * side, 0.052 * side, g.tube * 0.7, 'fork', 0.6);
  }
  // Joints and BB shell
  const forkCol = tubeSegments(cw, 'fork', () => 1)[0];
  root.add(blob(P(g.headBottom), mmR(g.tube * 1.2), mmR(g.tube * 1.2), 0.045, mats.paint(forkCol.color, forkCol.finish)));
  const bbCol = tubeSegments(cw, 'seat', () => 0.4)[0];
  root.add(tube(P(g.bb, -0.045), P(g.bb, 0.045), 0.022, 0.022, mats.paint(bbCol.color, bbCol.finish)));
  const topCol = tubeSegments(cw, 'seat', () => 0.4)[0];
  root.add(blob(P(seatCluster), mmR(g.tube), mmR(g.tube), mmR(g.tube) * aeroRatio, mats.paint(topCol.color, topCol.finish)));
  if (cw.detail) root.add(blob(P({ x: g.headTop.x + 1, y: g.headTop.y + 18 }), 0.008, 0.008, mmR(g.tube) * 0.8, mats.paint(cw.detail, 'gloss')));

  // Down-tube logos on both sides
  {
    const a = P(g.bb);
    const b = P(g.headBottom);
    const mid = a.clone().lerp(b, 0.36);
    const len = a.distanceTo(b) * 0.4;
    const tex = textTexture(frame.brand.toUpperCase(), cw.decal, { italic: true });
    textures.push(tex);
    const h = mmR(g.tube * 1.3) * 1.25;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const rL = mmR(g.tube * 1.3) * aeroRatio;
    for (const side of [1, -1]) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(len, h),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      plane.position.set(mid.x, mid.y, side * (rL + 0.0012));
      plane.rotation.set(0, side === 1 ? 0 : Math.PI, side === 1 ? ang : -ang);
      root.add(plane);
    }
  }

  // ── Wheels
  const look = wheels.look;
  const rimOuter = 0.311;
  const rimDepth = Math.max(wheels.rimDepthMm, 12) / 1000;
  const rimInner = rimOuter - rimDepth;
  const rimHalfOut = (Math.max(wheels.internalWidthMm || 19, 17) + 6) / 2000;
  const rimHalfIn = rimHalfOut * (wheels.profile === 'shallow' ? 0.85 : 0.62);
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: RIM_COLORS[look.rim],
    roughness: look.rim === 'carbon-matte' ? 0.6 : look.rim === 'carbon-gloss' ? 0.2 : 0.35,
    metalness: look.rim.startsWith('alloy') ? 0.6 : 0.1,
    clearcoat: look.rim === 'carbon-gloss' ? 1 : 0,
    side: THREE.DoubleSide,
  });
  const tyreMat = mats.plain('#1a1c1f', 0.85, 0);
  const tanMat = mats.plain(TAN_WALL, 0.8, 0);
  const spokeMat = mats.plain(look.spokes ?? (look.rim === 'alloy-silver' ? '#a7b1bd' : '#2c3036'), 0.4, 0.6);
  const decalTex = rimDecalTexture(look.decalText, look.decalColor, (rimOuter - rimDepth / 2) / rimOuter, rimDepth / rimOuter * (look.decalStyle === 'bold' ? 0.8 : 0.5), look.decalStyle === 'bold');
  textures.push(decalTex);
  const disc = frame.compat.brakeType === 'disc';

  const makeWheel = (center: V3, solidDisc: boolean, rear: boolean) => {
    const w = new THREE.Group();
    w.position.copy(center);
    const tyreR = tyres.widthMm / 2000;
    const tyreMesh = new THREE.Mesh(new THREE.TorusGeometry(Rm - tyreR, tyreR, 18, 120), tyreMat);
    tyreMesh.castShadow = true;
    w.add(tyreMesh);
    if (tyres.tread !== 'slick') {
      const knobs = new THREE.Mesh(new THREE.TorusGeometry(Rm - tyreR * 0.15, tyreR * (tyres.tread === 'knob' ? 0.35 : 0.2), 6, 160), tyreMat);
      w.add(knobs);
    }
    if (tyres.sidewall === 'tan')
      for (const side of [1, -1]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(rimOuter + 0.002, Rm - tyreR * 0.75, 96), tanMat);
        ring.position.z = side * tyreR * 0.92;
        (ring.material as THREE.Material).side = THREE.DoubleSide;
        w.add(ring);
      }
    // Rim as a surface of revolution (profile in r, z)
    const prof = [
      new THREE.Vector2(rimOuter, -rimHalfOut),
      new THREE.Vector2(rimOuter - rimDepth * 0.15, -rimHalfOut * 1.05),
      new THREE.Vector2(rimInner + rimDepth * 0.2, -rimHalfIn),
      new THREE.Vector2(rimInner, -rimHalfIn * 0.4),
      new THREE.Vector2(rimInner, rimHalfIn * 0.4),
      new THREE.Vector2(rimInner + rimDepth * 0.2, rimHalfIn),
      new THREE.Vector2(rimOuter - rimDepth * 0.15, rimHalfOut * 1.05),
      new THREE.Vector2(rimOuter, rimHalfOut),
    ];
    const lathe = new THREE.LatheGeometry(prof, 120);
    lathe.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(lathe, rimMat);
    rim.castShadow = true;
    w.add(rim);
    if (solidDisc) {
      const dprof = [new THREE.Vector2(0.02, -0.014), new THREE.Vector2(rimInner, -rimHalfIn * 0.5), new THREE.Vector2(rimInner, rimHalfIn * 0.5), new THREE.Vector2(0.02, 0.014)];
      const dg = new THREE.LatheGeometry(dprof, 96);
      dg.rotateX(Math.PI / 2);
      w.add(new THREE.Mesh(dg, rimMat));
    } else {
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const side = i % 2 ? 1 : -1;
        const hubPt = v3(Math.cos(a) * 0.022, Math.sin(a) * 0.022, side * (rear && side === 1 ? 0.02 : 0.03));
        const rimA = a + (i % 2 ? 0.12 : -0.12);
        const rimPt = v3(Math.cos(rimA) * rimInner, Math.sin(rimA) * rimInner, 0);
        w.add(tube(hubPt, rimPt, 0.0011, 0.0011, spokeMat));
      }
    }
    // Rim decals on both sides (mirrored on the far side so the text reads correctly)
    for (const side of [1, -1]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(rimInner + 0.001, rimOuter - 0.001, 120),
        new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      );
      // Just outside the rim's widest point so the decal is never hidden inside the rim.
      const zAt = rimHalfOut * 1.06 + 0.0012;
      ring.position.z = side * zAt;
      if (side === -1) ring.scale.x = -1; // mirror on the far side so the text reads correctly from there too
      w.add(ring);
    }
    // Hub, rotor
    w.add(tube(v3(0, 0, -0.05), v3(0, 0, 0.05), 0.017, 0.017, silver));
    if (disc) {
      const rotor = new THREE.Mesh(new THREE.RingGeometry(0.062, 0.08, 64), mats.plain('#b9c1ca', 0.3, 0.9));
      (rotor.material as THREE.Material).side = THREE.DoubleSide;
      rotor.position.z = -0.058;
      w.add(rotor);
    }
    return w;
  };
  const rearC = P(g.rear);
  const frontC = P(g.front);
  root.add(makeWheel(rearC, wheels.profile === 'disc', true));
  root.add(makeWheel(frontC, false, false));

  // Brakes
  if (disc) {
    root.add(tube(P({ x: g.rear.x + 26, y: g.rear.y - 46 }, -0.062), P({ x: g.rear.x + 36, y: g.rear.y - 34 }, -0.062), 0.014, 0.01, compMat));
    root.add(tube(P({ x: g.front.x - 30, y: g.front.y - 46 }, -0.062), P({ x: g.front.x - 22, y: g.front.y - 34 }, -0.062), 0.014, 0.01, compMat));
  } else {
    root.add(tube(P({ x: g.headBottom.x + 6, y: g.headBottom.y + 8 }, 0), P({ x: g.headBottom.x + 22, y: g.headBottom.y + 26 }, 0), 0.008, 0.03, compMat));
    root.add(tube(P({ x: stayJoin.x - 10, y: stayJoin.y + 6 }, 0), P({ x: stayJoin.x - 26, y: stayJoin.y + 26 }, 0), 0.008, 0.03, compMat));
  }

  // ── Drivetrain (drive side = +z)
  const ringR = (t: number) => (t * 12.7) / (2 * Math.PI) / 1000;
  const bb = P(g.bb);
  const big = Math.max(...groupset.chainrings);
  for (const [i, t] of [...groupset.chainrings].sort((a, b) => b - a).entries()) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR(t), 0.0028, 8, 96), i === 0 ? compMat : mats.plain('#3a4048', 0.4, 0.6));
    ring.position.set(bb.x, bb.y, 0.072 - i * 0.006);
    ring.castShadow = true;
    root.add(ring);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    root.add(tube(v3(bb.x, bb.y, 0.074), v3(bb.x + Math.cos(a) * (ringR(big) - 0.004), bb.y + Math.sin(a) * (ringR(big) - 0.004), 0.072), 0.005, 0.003, compMat));
  }
  const crankA = -1.1;
  const crankL = 0.1725;
  const pedalR = v3(bb.x + Math.cos(crankA) * crankL, bb.y + Math.sin(crankA) * crankL, 0.085);
  const pedalL = v3(bb.x - Math.cos(crankA) * crankL, bb.y - Math.sin(crankA) * crankL, -0.085);
  root.add(tube(v3(bb.x, bb.y, 0.082), pedalR, 0.011, 0.006, compMat));
  root.add(tube(v3(bb.x, bb.y, -0.082), pedalL, 0.011, 0.006, compMat));
  for (const p of [pedalR, pedalL]) {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.06), black);
    pedal.position.set(p.x, p.y, p.z + Math.sign(p.z) * 0.035);
    pedal.castShadow = true;
    root.add(pedal);
  }
  const cogs = 6;
  for (let i = 0; i < cogs; i++) {
    const teeth = groupset.cassette[0] + ((groupset.cassette[1] - groupset.cassette[0]) * i) / (cogs - 1);
    const cog = tube(v3(rearC.x, rearC.y, 0.06 - i * 0.004), v3(rearC.x, rearC.y, 0.0615 - i * 0.004), ringR(teeth), ringR(teeth), silver);
    root.add(cog);
  }
  // Chain
  const pulleyTop = v3(rearC.x + 0.012, rearC.y - 0.06, 0.06);
  const pulleyBot = v3(rearC.x - 0.004, rearC.y - 0.06 - (0.052 + (rd.maxCog - 28) * 0.0022), 0.06);
  const chainMat = mats.plain('#5b6470', 0.35, 0.8);
  const midCog = ringR((groupset.cassette[0] + groupset.cassette[1]) / 2);
  root.add(tube(v3(bb.x, bb.y + ringR(big), 0.07), v3(rearC.x, rearC.y + midCog, 0.055), 0.0035, 0.002, chainMat));
  root.add(tube(v3(bb.x, bb.y - ringR(big), 0.07), pulleyBot.clone().setY(pulleyBot.y - 0.006), 0.0035, 0.002, chainMat));
  root.add(tube(pulleyTop, pulleyBot, 0.008, 0.006, compMat));
  for (const p of [pulleyTop, pulleyBot]) root.add(tube(p.clone().setZ(0.055), p.clone().setZ(0.068), 0.0075, 0.0075, mats.plain('#dbe1e7', 0.4, 0.3)));
  root.add(blob(v3(rearC.x + 0.02, rearC.y - 0.022, 0.07), 0.022, 0.018, 0.012, compMat));
  if (rd.electronic) root.add(blob(v3(rearC.x + 0.03, rearC.y - 0.008, 0.074), 0.012, 0.007, 0.008, mats.plain(groupset.brand === 'SRAM' ? '#111' : '#2e3338', 0.4, 0.2)));

  // ── Seatpost and saddle
  const st = { x: g.seatTop.x - g.bb.x, y: g.seatTop.y - g.bb.y };
  const stLen = Math.hypot(st.x, st.y);
  const postTop = { x: g.seatTop.x + (st.x / stLen) * 46, y: g.seatTop.y + (st.y / stLen) * 46 };
  root.add(tube(P(g.seatTop), P(postTop), mmR(g.tube * 0.7), mmR(g.tube * 0.7) * 0.85, black));
  {
    const len = saddle.cutout && saddle.widthMm >= 140 ? 0.245 : 0.27;
    const wid = saddle.widthMm / 1000;
    const shape = new THREE.Shape();
    // Top-view outline in (x = along bike, y = sideways), nose at +x
    shape.moveTo(-len * 0.45, 0);
    shape.bezierCurveTo(-len * 0.47, wid * 0.5, -len * 0.25, wid * 0.52, -len * 0.05, wid * 0.36);
    shape.bezierCurveTo(len * 0.15, wid * 0.2, len * 0.4, wid * 0.14, len * 0.55, wid * 0.08);
    shape.bezierCurveTo(len * 0.58, 0.01, len * 0.58, -0.01, len * 0.55, -wid * 0.08);
    shape.bezierCurveTo(len * 0.4, -wid * 0.14, len * 0.15, -wid * 0.2, -len * 0.05, -wid * 0.36);
    shape.bezierCurveTo(-len * 0.25, -wid * 0.52, -len * 0.47, -wid * 0.5, -len * 0.45, 0);
    const pad = saddle.padding === 'plush' ? 0.016 : saddle.padding === 'medium' ? 0.01 : 0.006;
    const sg = new THREE.ExtrudeGeometry(shape, { depth: pad, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.006, bevelSegments: 4, curveSegments: 24 });
    sg.rotateX(-Math.PI / 2);
    const sm = new THREE.Mesh(sg, mats.plain(saddle.brand === 'Brooks' ? '#7a4b22' : '#17191c', saddle.brand === 'Brooks' ? 0.7 : 0.55, 0.05));
    const pt = P(postTop);
    sm.position.set(pt.x, pt.y + 0.012, 0);
    sm.castShadow = true;
    root.add(sm);
    root.add(tube(v3(pt.x - 0.06, pt.y + 0.008, 0), v3(pt.x + 0.06, pt.y + 0.01, 0), 0.006, 0.03, mats.plain('#6b7480', 0.4, 0.7)));
  }

  // ── Cockpit
  const stemLenPx = (bars.integratedStemMm ?? 100) * S;
  const stemEnd2 = { x: g.headTop.x + stemLenPx, y: g.headTop.y - stemLenPx * 0.12 - 4 };
  const ht = P(g.headTop);
  const spacerTop = P({ x: g.headTop.x - 2, y: g.headTop.y - 8 });
  root.add(tube(ht, spacerTop, mmR(g.tube * 1.15 + 2), mmR(g.tube * 1.15 + 2) * 0.75, black));
  const se = P(stemEnd2);
  const integrated = bars.barType === 'aero-integrated';
  root.add(tube(spacerTop, se, integrated ? 0.016 : 0.013, integrated ? 0.012 : 0.013, integrated ? mats.plain('#141619', 0.45, 0.1) : black));
  const barMat = mats.plain('#141619', 0.7, 0.05);
  const halfW = 0.2;
  const hasDrops = bars.positions.includes('drops');
  if (hasDrops) {
    const flare = bars.barType === 'flared-gravel' ? 0.05 : 0;
    const side = (s: number) => [
      v3(se.x - 0.02, se.y - 0.12, s * (halfW + flare)),
      v3(se.x + 0.035, se.y - 0.125, s * (halfW + flare * 0.9)),
      v3(se.x + 0.085, se.y - 0.1, s * (halfW + flare * 0.6)),
      v3(se.x + 0.095, se.y - 0.04, s * (halfW + flare * 0.2)),
      v3(se.x + 0.07, se.y + 0.004, s * halfW),
      v3(se.x + 0.025, se.y, s * (halfW - 0.01)),
      v3(se.x, se.y, s * (halfW - 0.05)),
    ];
    const pts = [...side(-1), v3(se.x, se.y, 0), ...side(1).reverse()];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
    const barMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.0125, 12, false), barMat);
    barMesh.castShadow = true;
    root.add(barMesh);
    if (integrated) root.add(tube(v3(se.x, se.y, -halfW + 0.04), v3(se.x, se.y, halfW - 0.04), 0.022, 0.009, mats.plain('#141619', 0.45, 0.1)));
    for (const s of [1, -1]) root.add(blob(v3(se.x + 0.08, se.y + 0.018, s * halfW), 0.035, 0.022, 0.016, compMat));
  }
  if (bars.barType === 'tri-aero') {
    if (!hasDrops) {
      const wing = new THREE.CatmullRomCurve3([v3(se.x + 0.07, se.y - 0.03, -0.2), v3(se.x + 0.02, se.y, -0.16), v3(se.x, se.y, 0), v3(se.x + 0.02, se.y, 0.16), v3(se.x + 0.07, se.y - 0.03, 0.2)]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(wing, 80, 0.012, 10, false), barMat));
    }
    for (const s of [1, -1]) {
      const ext = new THREE.CatmullRomCurve3([v3(se.x - 0.01, se.y + 0.05, s * 0.07), v3(se.x + 0.25, se.y + 0.055, s * 0.055), v3(se.x + 0.33, se.y + 0.09, s * 0.05)]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(ext, 40, 0.011, 10, false), barMat));
      const padBox = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.015, 0.075), black);
      padBox.position.set(se.x + 0.02, se.y + 0.065, s * 0.08);
      root.add(padBox);
      root.add(tube(v3(se.x, se.y, s * 0.08), v3(se.x + 0.01, se.y + 0.058, s * 0.08), 0.008, 0.008, compMat));
    }
  }
  return root;
}

// ───────────────────────── React component ─────────────────────────

export default function Bike3D({ parts, colourway }: { parts: ResolvedBuild; colourway: Colourway }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    bike?: THREE.Group;
    mats?: Materials;
    textures: THREE.Texture[];
    anim?: { from: V3; to: V3; t0: number };
  } | null>(null);
  const [view, setView] = useState<ViewId>('three-quarter');
  const [spin, setSpin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up renderer, scene, lights once.
  useEffect(() => {
    const mount = mountRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setError('3D needs WebGL, which this browser or device has turned off.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef2f6');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    camera.position.set(...VIEWS['three-quarter'].pos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.02, 0.55, 0);
    controls.enableDamping = true;
    controls.minDistance = 0.6;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.autoRotateSpeed = 1.6;

    const hemi = new THREE.HemisphereLight('#ffffff', '#c9d2dc', 0.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(1.5, 3.5, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1.4;
    sun.shadow.camera.right = 1.4;
    sun.shadow.camera.top = 1.4;
    sun.shadow.camera.bottom = -1.4;
    sun.shadow.radius = 4;
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.001;
    disc.receiveShadow = true;
    scene.add(disc);

    ctx.current = { renderer, scene, camera, controls, textures: [] };

    const resize = () => {
      const w = mount.clientWidth;
      const h = Math.max(260, Math.round(w * 0.56));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = (now: number) => {
      const c = ctx.current!;
      if (c.anim) {
        const k = Math.min(1, (now - c.anim.t0) / 650);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(c.anim.from, c.anim.to, e);
        if (k >= 1) c.anim = undefined;
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      const c = ctx.current;
      c?.mats?.dispose();
      c?.textures.forEach((t) => t.dispose());
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry !== UNIT_CYL && o.geometry !== UNIT_SPHERE) o.geometry.dispose();
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  // Rebuild the bike when parts or colours change.
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    if (c.bike) {
      c.scene.remove(c.bike);
      c.bike.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry !== UNIT_CYL && o.geometry !== UNIT_SPHERE) o.geometry.dispose();
      });
      c.mats?.dispose();
      c.textures.forEach((t) => t.dispose());
      c.textures = [];
    }
    c.mats = new Materials();
    c.bike = buildBike(parts, colourway, c.mats, c.textures);
    c.scene.add(c.bike);
  }, [parts, colourway]);

  useEffect(() => {
    if (ctx.current) ctx.current.controls.autoRotate = spin;
  }, [spin]);

  const goTo = (v: ViewId) => {
    setView(v);
    const c = ctx.current;
    if (!c) return;
    c.controls.target.set(0.02, 0.55, 0);
    c.anim = { from: c.camera.position.clone(), to: new THREE.Vector3().fromArray(VIEWS[v].pos), t0: performance.now() };
  };

  if (error) return <div className="flex h-72 items-center justify-center p-6 text-center text-sm text-slate-500">{error}</div>;

  return (
    <div className="relative">
      <div ref={mountRef} className="w-full cursor-grab overflow-hidden active:cursor-grabbing" aria-label="3D view of the bike. Drag to rotate, scroll or pinch to zoom." role="img" />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
        {(Object.keys(VIEWS) as ViewId[]).map((v) => (
          <button
            key={v}
            onClick={() => goTo(v)}
            aria-pressed={view === v}
            className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur transition ${view === v ? 'bg-slate-900 text-white' : 'bg-white/85 text-slate-700 hover:bg-white'}`}
          >
            {VIEWS[v].label}
          </button>
        ))}
        <button
          onClick={() => setSpin((s) => !s)}
          aria-pressed={spin}
          className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur ${spin ? 'bg-brand-600 text-white' : 'bg-white/85 text-slate-700 hover:bg-white'}`}
        >
          {spin ? 'Stop spin' : 'Spin'}
        </button>
      </div>
      <p className="pointer-events-none absolute left-3 top-2 text-[11px] text-slate-500">Drag to rotate · scroll or pinch to zoom</p>
    </div>
  );
}
