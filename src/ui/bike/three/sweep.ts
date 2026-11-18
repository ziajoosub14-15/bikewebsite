import * as THREE from 'three';

export interface SweepOptions {
  /** Rings along the curve. */
  segments?: number;
  /** Vertices around each ring. */
  radial?: number;
  /** Size of the cross-section at t (0–1): depth in the bike's plane, width sideways (metres). */
  size: (t: number) => [number, number];
  /**
   * 0 = elliptical tube; 1 = full aero "Kamm tail": rounded leading edge, narrowing towards a cut-off
   * trailing edge. The leading edge faces the front of the bike.
   */
  aero?: number;
  /** Only build part of the curve. */
  from?: number;
  to?: number;
  capStart?: boolean;
  capEnd?: boolean;
  /** Texture tiles per metre (for carbon weave / tape). */
  uvPerMetre?: number;
  /** Optional per-ring colour (for paint fades). */
  colorAt?: (t: number) => THREE.Color;
}

const Z = new THREE.Vector3(0, 0, 1);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Sweep a cross-section along a curve to make a smooth, tapered frame tube.
 * The cross-section's depth lies in the bike's plane (perpendicular to the tube) and its width points
 * sideways, so aero tubes are deep and narrow just like real ones.
 */
export function sweepGeometry(curve: THREE.Curve<THREE.Vector3>, o: SweepOptions): THREE.BufferGeometry {
  const segs = o.segments ?? 40;
  const rad = o.radial ?? 28;
  const from = o.from ?? 0;
  const to = o.to ?? 1;
  const aero = o.aero ?? 0;
  const uvk = o.uvPerMetre ?? 60;
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const totalLen = curve.getLength();
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const L = new THREE.Vector3();
  const D = new THREE.Vector3();
  const v = new THREE.Vector3();

  const frameAt = (t: number) => {
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T).normalize();
    // Sideways axis: world Z made perpendicular to the tube. Fall back for tubes running sideways.
    const ref = Math.abs(T.dot(Z)) > 0.9 ? Y : Z;
    L.copy(ref).addScaledVector(T, -ref.dot(T)).normalize();
    D.crossVectors(T, L).normalize();
    // Make D point towards the front of the bike (leading edge); vertical tubes point forward, horizontal ones up.
    const fwd = D.dot(X);
    if (fwd < -0.05 || (Math.abs(fwd) <= 0.05 && D.y < 0)) D.multiplyScalar(-1);
    return Math.abs(D.dot(X));
  };

  for (let i = 0; i <= segs; i++) {
    const t = from + ((to - from) * i) / segs;
    const lead = frameAt(t);
    // Aero shaping only where the tube faces the wind (not on the horizontal top tube).
    const a = aero * Math.min(1, lead * 1.4);
    const [depth, width] = o.size(t);
    const c = o.colorAt?.(t);
    for (let k = 0; k <= rad; k++) {
      const th = (k / rad) * Math.PI * 2;
      let x = Math.cos(th) * depth * 0.5;
      let y = Math.sin(th) * width * 0.5;
      if (x < 0 && a > 0) {
        // Trailing half: taper the width and cut the tail off flat (Kamm tail).
        const f = -x / (depth * 0.5);
        y *= 1 - a * 0.35 * f;
        x = Math.max(x, -depth * 0.5 * (1 - a * 0.16));
      }
      v.copy(P).addScaledVector(D, x).addScaledVector(L, y);
      pos.push(v.x, v.y, v.z);
      uv.push((t * totalLen) * uvk, (k / rad) * Math.PI * (depth + width) * 0.5 * uvk);
      if (c) col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let k = 0; k < rad; k++) {
      const a = i * (rad + 1) + k;
      const b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }

  const addCap = (t: number, flip: boolean) => {
    frameAt(t);
    const centre = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    uv.push(0, 0);
    if (o.colorAt) {
      const c = o.colorAt(t);
      col.push(c.r, c.g, c.b);
    }
    const ring = t === from ? 0 : segs * (rad + 1);
    for (let k = 0; k < rad; k++) {
      if (flip) idx.push(centre, ring + k + 1, ring + k);
      else idx.push(centre, ring + k, ring + k + 1);
    }
  };
  if (o.capStart) addCap(from, false);
  if (o.capEnd) addCap(to, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (o.colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A smooth curve through 2D-drawing points mapped to 3D. */
export function curveThrough(points: THREE.Vector3[]): THREE.Curve<THREE.Vector3> {
  if (points.length === 2) return new THREE.LineCurve3(points[0], points[1]);
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

/** Gear outline (chainring or cog) as a Shape with teeth, plus an optional centre hole. */
export function gearShape(teeth: number, holeR: number, toothDepth = 0.0026): THREE.Shape {
  const pitchR = (teeth * 0.0127) / (2 * Math.PI);
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const phase = i % 4;
    const r = phase === 0 || phase === 3 ? pitchR - toothDepth * 0.4 : pitchR + toothDepth * 0.6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  if (holeR > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}
