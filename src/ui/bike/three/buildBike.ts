import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ResolvedBuild } from '../../../domain/bikeModel';
import type { Colourway, Finish } from '../../../types/components';
import { bezAt, cockpitGeometry, frameDrawing, S, spokeAngles, WHEEL_Y, type Pt, type TubeDef } from '../frameShape';
import { tubeSegments, tubeStripes, type TubeId } from '../paint';
import { curveThrough, gearShape, sweepGeometry } from './sweep';
import { barTapeBump, carbonWeave, flakeNoise, labelTexture, rimTexture, rotorAlpha, tyreTexture } from './textures';

type V3 = THREE.Vector3;
const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/** Creates and remembers materials so the model can be disposed in one go. */
class Mats {
  private cache = new Map<string, THREE.Material>();
  private get<T extends THREE.Material>(key: string, make: () => T): T {
    let m = this.cache.get(key) as T | undefined;
    if (!m) {
      m = make();
      this.cache.set(key, m);
    }
    return m;
  }
  /** Frame paint. `weave` shows the carbon weave through clear lacquer (raw-carbon finishes). */
  paint(color: string, finish: Finish, weave = false, vertexColors = false): THREE.MeshPhysicalMaterial {
    return this.get(`paint|${color}|${finish}|${weave}|${vertexColors}`, () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: vertexColors ? '#ffffff' : color,
        vertexColors,
        roughness: finish === 'matte' ? 0.58 : finish === 'metallic' ? 0.3 : 0.34,
        metalness: finish === 'metallic' ? 0.55 : 0.0,
        clearcoat: finish === 'matte' ? 0.05 : 1,
        clearcoatRoughness: finish === 'matte' ? 0.6 : 0.035,
        iridescence: finish === 'pearl' ? 0.75 : 0,
        iridescenceIOR: 1.45,
        sheen: finish === 'pearl' ? 0.6 : 0,
        sheenColor: new THREE.Color('#cfe0ff'),
        envMapIntensity: 1.0,
      });
      if (finish === 'metallic') {
        m.bumpMap = flakeNoise();
        m.bumpScale = 0.15;
      }
      if (weave) {
        m.map = carbonWeave('color');
        m.color.set('#ffffff');
        m.bumpMap = carbonWeave('bump');
        m.bumpScale = 0.25;
        m.roughness = finish === 'matte' ? 0.5 : 0.32;
        m.clearcoat = finish === 'matte' ? 0.25 : 1;
      }
      return m;
    });
  }
  /** Raw carbon components (stem, seatpost, cranks…). */
  carbon(gloss = true) {
    return this.paint('#16181b', gloss ? 'gloss' : 'matte', true);
  }
  metal(color: string, roughness = 0.3, metalness = 0.9) {
    return this.get(`metal|${color}|${roughness}|${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
  rubber(color = '#17181a', roughness = 0.85) {
    return this.get(`rubber|${color}|${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
  }
  tape() {
    return this.get('tape', () => new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.78, bumpMap: barTapeBump(), bumpScale: 0.6 }));
  }
  custom<T extends THREE.Material>(key: string, make: () => T): T {
    return this.get(key, make);
  }
  dispose() {
    this.cache.forEach((m) => m.dispose());
  }
}

/** Straight tube with an elliptical cross-section (rPlane in the bike's plane, rLat sideways). */
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false);
function rod(a: V3, b: V3, rPlane: number, rLat: number, mat: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const y = dir.normalize();
  let z = v3(0, 0, 1);
  if (Math.abs(y.dot(z)) > 0.95) z = v3(1, 0, 0);
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const z2 = new THREE.Vector3().crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z2).scale(v3(rPlane, len, rLat)).setPosition(a.clone().add(b).multiplyScalar(0.5));
  const mesh = new THREE.Mesh(UNIT_CYL, mat);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
const UNIT_SPHERE = new THREE.SphereGeometry(1, 32, 20);
function blob(at: V3, rx: number, ry: number, rz: number, mat: THREE.Material, rotZ = 0): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_SPHERE, mat);
  m.position.copy(at);
  m.scale.set(rx, ry, rz);
  m.rotation.z = rotZ;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface BuiltBike {
  group: THREE.Group;
  dispose(): void;
}

/**
 * Build a realistic 3D model of the bike from its parts. Units are metres; the bike stands on y = 0,
 * faces +x, and the drive side is +z.
 */
export function buildBike(parts: ResolvedBuild, cw: Colourway, opts: { wheels?: boolean; only?: 'wheels' } = {}): BuiltBike {
  const showWheels = opts.wheels ?? true;
  const { frame, wheels, groupset, rearDerailleur: rd, handlebars: bars, saddle, tyres } = parts;
  const mats = new Mats();
  const geos: THREE.BufferGeometry[] = [];
  const root = new THREE.Group();
  const add = (o: THREE.Object3D) => {
    root.add(o);
    o.traverse((x) => {
      if (x instanceof THREE.Mesh) {
        x.castShadow = true;
        x.receiveShadow = true;
        if (x.geometry !== UNIT_CYL && x.geometry !== UNIT_SPHERE) geos.push(x.geometry);
      }
    });
    return o;
  };

  const fd = frameDrawing(frame);
  const g = fd.g;
  const sh = fd.shape;
  const ck = cockpitGeometry(fd, bars);
  const Rm = (311 + tyres.widthMm) / 1000;
  /** 2D drawing units → metres (y up), axles at tyre-radius height. */
  const P = (p: Pt, z = 0) => v3((p.x - 506) / S / 1000, Rm + (WHEEL_Y - p.y) / S / 1000, z);
  const mm = (units: number) => units / S / 1000;
  const xAt = (p: Pt) => (p.x - g.rear.x) / (g.front.x - g.rear.x);
  const aeroness = frame.frameType === 'tt' ? 1 : frame.frameType === 'aero' ? 0.9 : frame.frameType === 'climbing' ? 0.25 : 0.4;
  const latRatio = frame.frameType === 'tt' ? 0.5 : frame.frameType === 'aero' ? 0.6 : frame.frameType === 'climbing' ? 0.9 : 0.82;
  const rawCarbon = frame.material === 'carbon' && /carbon/i.test(`${cw.id} ${cw.name}`);
  const alloy = frame.material !== 'carbon';
  const paintMat = (color: string, finish: Finish) => mats.paint(color, finish, rawCarbon);

  // ───────────── Frame tubes ─────────────
  /** 3D curve through a tube's (possibly curved, multi-piece) centre line, with sideways offsets. */
  const curveOf = (def: TubeDef, zA = 0, zB = 0) => {
    const pts: V3[] = [];
    def.pieces.forEach((pc, pi) => {
      const n = 8;
      for (let j = pi === 0 ? 0 : 1; j <= n; j++) {
        const t = j / n;
        const gt = pc.r0 + (pc.r1 - pc.r0) * t;
        pts.push(P(bezAt(pc.bez, t), zA + (zB - zA) * gt));
      }
    });
    return curveThrough(pts);
  };
  const sizeOf = (def: TubeDef, ratio: number) => (t: number): [number, number] => {
    const d = mm(def.wa + (def.wb - def.wa) * t);
    return [d, d * ratio];
  };

  /** Sweep a frame tube and paint it per colourway (hard paint edges, smooth fades, stripes). */
  const frameTube = (def: TubeDef, zA = 0, zB = 0, ratio = latRatio, aero = aeroness) => {
    const curve = curveOf(def, zA, zB);
    const size = sizeOf(def, ratio);
    const segs = tubeSegments(cw, def.id, (t) => {
      const pc = def.pieces.find((q) => t >= q.r0 && t <= q.r1) ?? def.pieces[0];
      return xAt(bezAt(pc.bez, (t - pc.r0) / (pc.r1 - pc.r0)));
    });
    if (cw.pattern === 'fade') {
      const c0 = new THREE.Color(cw.base);
      const c1 = new THREE.Color(cw.accent ?? cw.base);
      const geo = sweepGeometry(curve, {
        size,
        aero,
        capStart: true,
        capEnd: true,
        colorAt: (t) => {
          const pc = def.pieces.find((q) => t >= q.r0 && t <= q.r1) ?? def.pieces[0];
          const x = Math.max(0, Math.min(1, xAt(bezAt(pc.bez, (t - pc.r0) / (pc.r1 - pc.r0)))));
          return c0.clone().lerp(c1, x).convertSRGBToLinear();
        },
      });
      add(new THREE.Mesh(geo, mats.paint('#ffffff', cw.finish, false, true)));
    } else {
      segs.forEach((sg, i) => {
        const geo = sweepGeometry(curve, { size, aero, from: sg.t0, to: sg.t1, segments: Math.max(6, Math.round(40 * (sg.t1 - sg.t0))), capStart: i === 0, capEnd: i === segs.length - 1 });
        add(new THREE.Mesh(geo, paintMat(sg.color, sg.finish)));
      });
    }
    for (const st of tubeStripes(cw, def.id)) {
      const geo = sweepGeometry(curve, { size: (t) => size(t).map((x) => x * 1.012) as [number, number], aero, from: st.t - st.width / 2, to: st.t + st.width / 2, segments: 3 });
      add(new THREE.Mesh(geo, mats.paint(st.color, 'gloss')));
    }
    return curve;
  };
  const colorAt = (tube: TubeId, t: number) => {
    const segs = tubeSegments(cw, tube, () => (cw.pattern === 'fade' ? t : 0.5));
    const sg = segs.find((x) => t >= x.t0 && t <= x.t1) ?? segs[0];
    return paintMat(sg.color, sg.finish);
  };

  const T = fd.tubes;
  frameTube(T.seat, 0, 0, latRatio * 1.05);
  frameTube(T.top, 0, 0);
  const downCurve = frameTube(T.down, 0, 0);
  frameTube(T.head, 0, 0, 0.72, aeroness * 0.6);
  for (const side of [1, -1]) {
    frameTube(T.chainstay, 0.066 * side, 0.034 * side, 0.85, 0);
    frameTube(T.seatstay, 0.064 * side, 0.016 * side, 0.7, 0.3);
    frameTube(T.fork, (sh.fork === 'bayonet' ? 0.042 : 0.034) * side, 0.054 * side, 0.55, aeroness);
  }
  // Fork crown and steerer area: one smooth body bridging the two legs under the head tube.
  const hb = P(g.headBottom);
  add(blob(hb.clone().add(v3(0.002, -0.008, 0)), mm(T.fork.wa) * 0.5, mm(T.fork.wa) * 0.55, sh.fork === 'bayonet' ? 0.045 : 0.036, colorAt('fork', 0)));
  // Bottom bracket shell and junction
  const bb = P(g.bb);
  add(rod(bb.clone().setZ(-0.043), bb.clone().setZ(0.043), mm(T.down.wa) * 0.45, mm(T.down.wa) * 0.45, colorAt('seat', 0)));
  add(blob(bb, mm(T.down.wa) * 0.62, mm(T.down.wa) * 0.62, 0.045, colorAt('seat', 0)));
  // Seat cluster and stay junction
  add(blob(P(fd.seatCluster), mm(T.seat.wb) * 0.56, mm(T.seat.wb) * 0.62, mm(T.seat.wb) * latRatio * 0.6, colorAt('seat', 0.95)));
  add(blob(P(fd.stayJoin), mm(T.seat.wb) * 0.55, mm(T.seat.wb) * 0.6, Math.max(0.022, mm(T.seat.wb) * latRatio * 0.62), colorAt('seat', sh.stayJoin)));
  // Head tube / top tube / down tube junctions
  add(blob(P(fd.headTop).add(v3(0, -0.014, 0)), mm(T.head.wa) * 0.46, mm(T.head.wa) * 0.5, mm(T.head.wa) * 0.33, colorAt('head', 0.05)));
  // Dropouts and thru-axles
  for (const [c, half] of [[P(g.rear), 0.072], [P(g.front), 0.058]] as const) {
    for (const side of [1, -1]) {
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.03, 0.007, 3, 0.004), colorAt('chainstay', 0));
      plate.position.copy(c).add(v3(0.002, 0.004, side * (half - 0.006)));
      add(plate);
    }
    add(rod(c.clone().setZ(-half - 0.006), c.clone().setZ(half + 0.004), 0.0062, 0.0062, mats.metal('#22252a', 0.35, 0.8)));
    add(rod(c.clone().setZ(half + 0.004), c.clone().setZ(half + 0.012), 0.012, 0.012, mats.metal('#2b2e33', 0.3, 0.8)));
  }
  if (cw.detail) add(blob(P({ x: fd.headTop.x + 2, y: fd.headTop.y + 20 }), 0.007, 0.007, mm(T.head.wa) * 0.37, mats.paint(cw.detail, 'gloss')));
  if (fd.nose) {
    // Aero nose cone: a tapered wedge growing out of the lower head tube and flowing into the fork crown.
    const top = P(fd.nose[0]);
    const tip = P(fd.nose[1]);
    const low = P(fd.nose[3]);
    const curve = new THREE.CatmullRomCurve3([top, top.clone().lerp(tip, 0.55).add(v3(0, -0.004, 0)), tip, low]);
    const hd = mm(T.head.wb);
    const geo = sweepGeometry(curve, { size: (t) => [hd * (0.55 - 0.3 * Math.sin(t * Math.PI)), hd * 0.6 * (1 - 0.45 * Math.sin(t * Math.PI))], aero: 0, capStart: true, capEnd: true, segments: 24 });
    add(new THREE.Mesh(geo, colorAt('head', 0.9)));
  }
  if (fd.bento) {
    const a = P(fd.bento.a);
    const b = P(fd.bento.b);
    const box = new THREE.Mesh(new RoundedBoxGeometry(a.distanceTo(b), 0.022, 0.04, 4, 0.008), colorAt('top', 0.8));
    box.position.copy(a.clone().lerp(b, 0.5)).add(v3(0, mm(T.top.wb) * 0.5 + 0.006, 0));
    box.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    add(box);
  }
  if (fd.isoFlow) {
    // Trek IsoFlow: dark opening with a bevelled lip on both sides of the mast.
    for (const side of [1, -1]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mats.rubber('#060708', 0.9));
      hole.scale.set(mm(fd.isoFlow.rx), mm(fd.isoFlow.ry), 1);
      hole.position.copy(P(fd.isoFlow.c, side * (mm(T.seat.wb) * latRatio * 0.53 + 0.001)));
      hole.rotation.set(0, side === 1 ? 0 : Math.PI, ((side === 1 ? -1 : 1) * fd.isoFlow.angleDeg * Math.PI) / 180);
      add(hole);
    }
  }
  if (sh.lugs) {
    // Lugged joints: thin collars where the tubes meet.
    for (const [def, t] of [[T.top, 0.04], [T.top, 0.96], [T.down, 0.93], [T.seat, 0.88]] as const) {
      const bz = def.pieces[0].bez;
      const a = P(bezAt(bz, t - 0.02));
      const b = P(bezAt(bz, t + 0.02));
      const r = mm(def.wa + (def.wb - def.wa) * t) * 0.53;
      add(rod(a, b, r, r * latRatio * 1.02, colorAt(def.id, t)));
    }
  }
  if (alloy) {
    // Weld beads where aluminium tubes meet.
    const weldMat = colorAt('top', 0.5);
    for (const [def, t] of [[T.top, 0.02], [T.top, 0.98], [T.down, 0.97], [T.down, 0.03], [T.seat, 0.94]] as const) {
      const bz = def.pieces[0].bez;
      const p = P(bezAt(bz, t));
      const q = P(bezAt(bz, Math.min(1, t + 0.01)));
      const r = mm(def.wa + (def.wb - def.wa) * t) * 0.52;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0022, 8, 32), weldMat);
      torus.position.copy(p);
      torus.lookAt(q);
      torus.scale.set(1, latRatio, 1);
      add(torus);
    }
  }
  if (sh.futureShock) {
    const top = { x: fd.headTop.x + fd.headUp.x * 14, y: fd.headTop.y + fd.headUp.y * 14 };
    add(rod(P(fd.headTop), P(top), mm(T.head.wa) * 0.4, mm(T.head.wa) * 0.4, mats.rubber('#121315', 0.8)));
    for (let k = 1; k <= 3; k++) {
      const p = P({ x: fd.headTop.x + fd.headUp.x * k * 3.5, y: fd.headTop.y + fd.headUp.y * k * 3.5 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(mm(T.head.wa) * 0.41, 0.0018, 8, 24), mats.rubber('#1e2023', 0.7));
      ring.position.copy(p);
      ring.rotation.x = Math.PI / 2;
      add(ring);
    }
  }

  // Frame decals: brand on the down tube, model name on the top tube, both sides.
  const decalOn = (curve: THREE.Curve<V3>, size: (t: number) => [number, number], t: number, text: string, color: string, lengthM: number, heightK: number, italic: boolean) => {
    const proj = new THREE.Mesh(sweepGeometry(curve, { size, aero: aeroness, segments: 40 }));
    proj.updateMatrixWorld();
    const p = curve.getPointAt(t);
    const dir = curve.getTangentAt(t).setZ(0).normalize();
    const [depth, width] = size(t);
    const tex = labelTexture(text, color, { italic });
    for (const side of [1, -1]) {
      const zAxis = v3(0, 0, side);
      const xAxis = side === 1 ? dir.clone() : dir.clone().negate();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
      const rot = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
      const pos = p.clone().add(v3(0, 0, side * width * 0.5));
      const geo = new DecalGeometry(proj, pos, rot, v3(lengthM, depth * heightK, width * 1.2));
      const mat = mats.custom(`decal-${text}-${color}`, () => new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 }));
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = false;
      root.add(m);
      geos.push(geo);
    }
    proj.geometry.dispose();
  };
  {
    const segs = tubeSegments(cw, 'down', () => 0.5);
    const seg = segs.find((sg) => sg.t0 <= 0.4 && sg.t1 >= 0.4) ?? segs[0];
    const t0 = Math.max(0.24, seg.t0 + 0.03);
    const t1 = Math.min(0.8, seg.t1 - 0.04);
    const len = downCurve.getLength() * (t1 - t0) * 0.9;
    decalOn(downCurve, sizeOf(T.down, latRatio), (t0 + t1) / 2, frame.brand.toUpperCase(), cw.decal, len, 0.62, true);
    const topCurve = curveOf(T.top);
    const model = frame.name.replace(/\s*\(.*?\)\s*/g, '').replace(/^S-Works\s+/i, 'S-WORKS ');
    decalOn(topCurve, sizeOf(T.top, latRatio), 0.22, model.toUpperCase(), cw.decal, Math.min(0.09, 0.012 * model.length + 0.02), 0.42, false);
  }

  // ───────────── Wheels ─────────────
  const look = wheels.look;
  const carbonRims = look.rim.startsWith('carbon');
  const disc = frame.compat.brakeType === 'disc';
  const rimOuter = 0.311;
  const extHalf = (Math.max(wheels.internalWidthMm || 19, 17) + 6) / 2000;
  const rimMatFor = (depthMm: number) =>
    mats.custom(`rim-${depthMm}`, () => {
      const m = new THREE.MeshPhysicalMaterial({
        map: rimTexture(look, carbonRims, depthMm),
        roughness: look.rim === 'carbon-matte' ? 0.5 : look.rim === 'carbon-gloss' ? 0.22 : 0.38,
        metalness: look.rim.startsWith('alloy') ? 0.55 : 0.05,
        clearcoat: look.rim === 'carbon-gloss' ? 1 : look.rim === 'carbon-matte' ? 0.15 : 0.4,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide,
      });
      if (carbonRims) {
        m.bumpMap = carbonWeave('bump');
        m.bumpScale = 0.12;
      }
      return m;
    });
  const tyreMat = mats.custom('tyre', () => new THREE.MeshStandardMaterial({ map: tyreTexture(tyres), roughness: 0.86, metalness: 0, side: THREE.DoubleSide }));
  const spokeMat = mats.metal(look.spokes ?? (look.rim === 'alloy-silver' ? '#b9c0c7' : '#16181b'), 0.35, 0.7);
  const hubMat = mats.metal('#1f2226', 0.3, 0.75);

  const makeWheel = (center: V3, rear: boolean) => {
    const w = new THREE.Group();
    w.position.copy(center);
    const depthMm = (rear ? look.depthRear : look.depthFront) ?? wheels.rimDepthMm;
    const depth = Math.max(depthMm, 12) / 1000;
    const rimInner = rimOuter - depth;
    const solidDisc = rear && wheels.profile === 'disc';
    // Tyre: lathe around the wheel; texture prints the brand and colours the sidewalls.
    const tw = tyres.widthMm / 1000;
    const th = tw * 0.95;
    const tp: THREE.Vector2[] = [];
    for (let i = 0; i <= 28; i++) {
      const a = -Math.PI * 0.62 + (i / 28) * Math.PI * 1.24;
      tp.push(new THREE.Vector2(rimOuter + th * 0.5 + Math.cos(a) * th * 0.5, Math.sin(a) * tw * 0.5));
    }
    tp.unshift(new THREE.Vector2(rimOuter - 0.001, -tw * 0.4));
    tp.push(new THREE.Vector2(rimOuter - 0.001, tw * 0.4));
    const tyreGeo = new THREE.LatheGeometry(tp.reverse(), 160);
    tyreGeo.rotateX(Math.PI / 2);
    w.add(new THREE.Mesh(tyreGeo, tyreMat));
    // Rim profile: wide shoulders near the tyre, narrowing to the spoke bed (deep aero "U" shape).
    const wMax = extHalf * 1.07;
    const wIn = Math.max(0.006, extHalf * 0.45);
    const prof = [
      [rimOuter + 0.0015, extHalf * 0.98],
      [rimOuter - depth * 0.08, wMax],
      [rimOuter - depth * 0.45, wMax * 1.0],
      [rimInner + depth * 0.2, wIn * 1.3],
      [rimInner + 0.002, wIn],
      [rimInner, 0],
    ];
    const rimPts = [...prof.map(([r, z]) => new THREE.Vector2(r, z)), ...prof.slice(0, -1).reverse().map(([r, z]) => new THREE.Vector2(r, -z))];
    const rimGeo = new THREE.LatheGeometry(rimPts, 160);
    rimGeo.rotateX(Math.PI / 2);
    w.add(new THREE.Mesh(rimGeo, rimMatFor(depthMm)));
    if (solidDisc) {
      const dprof = [new THREE.Vector2(rimInner + 0.004, wIn), new THREE.Vector2(0.18, 0.016), new THREE.Vector2(0.03, 0.022), new THREE.Vector2(0.03, -0.022), new THREE.Vector2(0.18, -0.016), new THREE.Vector2(rimInner + 0.004, -wIn)];
      const dg = new THREE.LatheGeometry(dprof, 128);
      dg.rotateX(Math.PI / 2);
      w.add(new THREE.Mesh(dg, mats.carbon(look.rim === 'carbon-gloss')));
    } else {
      const n = (rear ? look.spokesRear : look.spokesFront) ?? 24;
      const lacing = rear ? look.lacing ?? '2x' : 'radial';
      for (let i = 0; i < n; i++) {
        const [a, ra] = spokeAngles(i, n, lacing);
        const side = i % 2 ? 1 : -1;
        const hubR = rear ? 0.027 : 0.022;
        const hub = v3(Math.cos(a) * hubR, Math.sin(a) * hubR, side * (rear && side === 1 ? 0.021 : 0.031));
        const rimP = v3(Math.cos(ra) * (rimInner + 0.002), Math.sin(ra) * (rimInner + 0.002), 0);
        w.add(rod(hub, rimP, 0.0011, 0.00045, spokeMat));
        w.add(rod(rimP.clone().multiplyScalar(0.985), rimP, 0.0018, 0.0018, mats.metal('#2a2d31', 0.35, 0.8)));
      }
      // Valve
      const va = -1.1;
      w.add(rod(v3(Math.cos(va) * rimInner, Math.sin(va) * rimInner, 0), v3(Math.cos(va) * (rimInner - 0.02), Math.sin(va) * (rimInner - 0.02), 0), 0.003, 0.003, mats.metal('#9aa3ad', 0.25, 1)));
    }
    // Hub with flanges
    const hubProf = [
      [0.012, -0.05],
      [0.017, -0.045],
      [0.017, -0.034],
      [rear ? 0.03 : 0.025, -0.032],
      [rear ? 0.03 : 0.025, -0.028],
      [0.016, -0.024],
      [0.016, 0.018],
      [rear ? 0.032 : 0.025, 0.02],
      [rear ? 0.032 : 0.025, 0.026],
      [0.017, 0.03],
      [0.017, 0.045],
      [0.012, 0.05],
    ].map(([r, z]) => new THREE.Vector2(r, z));
    const hubGeo = new THREE.LatheGeometry(hubProf, 48);
    hubGeo.rotateX(Math.PI / 2);
    w.add(new THREE.Mesh(hubGeo, hubMat));
    if (disc) {
      const rotor = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 96),
        mats.custom('rotor', () => new THREE.MeshStandardMaterial({ color: '#c9cfd6', metalness: 1, roughness: 0.32, alphaMap: rotorAlpha(), alphaTest: 0.5, side: THREE.DoubleSide })),
      );
      rotor.position.z = -0.056;
      w.add(rotor);
      w.add(rod(v3(0, 0, -0.056), v3(0, 0, -0.05), 0.018, 0.018, mats.metal('#1c1e21', 0.4, 0.8)));
    }
    return w;
  };
  const rearC = P(g.rear);
  const frontC = P(g.front);
  const wheelGroups: THREE.Object3D[] = [];
  if (showWheels) {
    wheelGroups.push(add(makeWheel(rearC, true)), add(makeWheel(frontC, false)));
  }

  // ───────────── Groupset ─────────────
  const pro = groupset.tier === 'pro' || groupset.tier === 'performance';
  const carbonCranks = pro && groupset.brand !== 'Shimano';
  const compMat = groupset.tier === 'entry' ? mats.metal('#9ea6ae', 0.3, 0.9) : groupset.brand === 'Shimano' ? mats.metal('#2b2e33', 0.28, 0.75) : mats.metal('#18191c', 0.4, 0.5);
  const crankMat = carbonCranks ? mats.carbon(true) : compMat;
  const steel = mats.metal('#b7bec6', 0.22, 1);
  const darkSteel = mats.metal('#4b5058', 0.3, 1);

  // Brakes
  if (disc) {
    const caliper = (c: V3, ang: number) => {
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.03, 0.026, 4, 0.008), compMat);
      body.position.copy(c).add(v3(Math.cos(ang) * 0.072, Math.sin(ang) * 0.072, -0.058));
      body.rotation.z = ang + Math.PI / 2;
      add(body);
    };
    caliper(rearC, 0.75);
    caliper(frontC, 2.35);
  } else {
    const rimCaliper = (at: V3) => {
      const arm = new THREE.Mesh(new THREE.TorusGeometry(tyres.widthMm / 2000 + 0.012, 0.0045, 10, 24, Math.PI), compMat);
      arm.position.copy(at);
      arm.rotation.y = Math.PI / 2;
      add(arm);
      add(blob(at.clone().add(v3(0, 0.012, 0)), 0.012, 0.016, 0.02, compMat));
    };
    rimCaliper(P({ x: g.headBottom.x + 12, y: g.headBottom.y + 18 }));
    rimCaliper(P({ x: fd.stayJoin.x - 18, y: fd.stayJoin.y + 16 }));
  }

  // Chainrings with teeth, spider and cranks
  const rings = [...groupset.chainrings].sort((a, b) => b - a);
  const ringR = (t: number) => (t * 0.0127) / (2 * Math.PI);
  rings.forEach((teeth, i) => {
    const geo = new THREE.ExtrudeGeometry(gearShape(teeth, ringR(teeth) - 0.012), { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 4 });
    const m = new THREE.Mesh(geo, i === 0 ? (groupset.tier === 'entry' ? steel : mats.metal('#26292d', 0.3, 0.85)) : darkSteel);
    m.position.copy(bb).setZ(0.068 - i * 0.0065);
    add(m);
  });
  const big = ringR(rings[0]);
  {
    // Four-arm spider: one flat, shaped piece behind the big ring (asymmetric like modern road cranks).
    const spider = new THREE.Shape();
    const arms = [0.55, 0.55 + Math.PI / 2, 0.55 + Math.PI, 0.55 + Math.PI * 1.62];
    const rIn = 0.02;
    const rOut = big - 0.006;
    arms.forEach((a, i) => {
      const w0 = 0.42;
      const w1 = 0.07;
      const pts = [
        [Math.cos(a - w0) * rIn, Math.sin(a - w0) * rIn],
        [Math.cos(a - w1) * rOut, Math.sin(a - w1) * rOut],
        [Math.cos(a + w1) * rOut, Math.sin(a + w1) * rOut],
        [Math.cos(a + w0) * rIn, Math.sin(a + w0) * rIn],
      ];
      if (i === 0) spider.moveTo(pts[0][0], pts[0][1]);
      else spider.lineTo(pts[0][0], pts[0][1]);
      spider.quadraticCurveTo(Math.cos(a) * rOut * 0.55 + Math.cos(a - Math.PI / 2) * 0.008, Math.sin(a) * rOut * 0.55 + Math.sin(a - Math.PI / 2) * 0.008, pts[1][0], pts[1][1]);
      spider.lineTo(pts[2][0], pts[2][1]);
      spider.quadraticCurveTo(Math.cos(a) * rOut * 0.55 + Math.cos(a + Math.PI / 2) * 0.008, Math.sin(a) * rOut * 0.55 + Math.sin(a + Math.PI / 2) * 0.008, pts[3][0], pts[3][1]);
    });
    spider.closePath();
    const geo = new THREE.ExtrudeGeometry(spider, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 10 });
    const m = new THREE.Mesh(geo, crankMat);
    m.position.copy(bb).setZ(0.0715);
    add(m);
    // Chainring bolts
    arms.forEach((a) => add(rod(bb.clone().add(v3(Math.cos(a) * (rOut - 0.004), Math.sin(a) * (rOut - 0.004), 0.071)), bb.clone().add(v3(Math.cos(a) * (rOut - 0.004), Math.sin(a) * (rOut - 0.004), 0.08)), 0.003, 0.003, steel)));
  }
  const crankA = -1.05;
  const crankL = 0.1725;
  for (const side of [1, -1]) {
    const a = side === 1 ? crankA : crankA + Math.PI;
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.018);
    shape.lineTo(crankL, -0.011);
    shape.absarc(crankL, 0, 0.011, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(0, 0.018);
    shape.absarc(0, 0, 0.018, Math.PI / 2, (Math.PI * 3) / 2, false);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 4, curveSegments: 12 });
    const arm = new THREE.Mesh(geo, crankMat);
    arm.position.copy(bb).setZ(side * 0.083 - 0.0055);
    arm.rotation.z = a;
    add(arm);
    // Pedal
    const pedal = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.016, 0.062, 4, 0.006), mats.carbon(false));
    body.position.z = side * 0.038;
    pedal.add(body);
    pedal.add(rod(v3(0, 0, 0), v3(0, 0, side * 0.012), 0.006, 0.006, steel));
    pedal.position.copy(bb).add(v3(Math.cos(a) * crankL, Math.sin(a) * crankL, side * 0.092));
    add(pedal);
  }
  add(rod(bb.clone().setZ(-0.09), bb.clone().setZ(0.09), 0.012, 0.012, darkSteel));

  // Cassette with teeth
  const speeds = groupset.compat.speeds ?? 12;
  for (let i = 0; i < speeds; i++) {
    const teeth = Math.round(groupset.cassette[0] + ((groupset.cassette[1] - groupset.cassette[0]) * Math.pow(i / (speeds - 1), 1.35)));
    const geo = new THREE.ExtrudeGeometry(gearShape(teeth, 0.012, 0.0022), { depth: 0.0017, bevelEnabled: false, curveSegments: 3 });
    const m = new THREE.Mesh(geo, i > speeds - 4 ? darkSteel : steel);
    m.position.copy(rearC).setZ(0.062 - i * 0.0037);
    add(m);
  }

  // Rear derailleur: hanger, parallelogram body, cage with toothed pulleys
  const rdMat = rd.electronic ? mats.carbon(true) : compMat;
  const hanger = rearC.clone().add(v3(0.006, -0.006, 0.072));
  const cageLen = 0.055 + (rd.maxCog - 28) * 0.0022;
  const pTop = rearC.clone().add(v3(0.014, -0.058, 0.06));
  const pBot = pTop.clone().add(v3(-0.012, -cageLen, 0));
  const knuckle = new THREE.Mesh(new RoundedBoxGeometry(0.028, 0.04, 0.02, 4, 0.006), rdMat);
  knuckle.position.copy(hanger).add(v3(0.012, -0.022, 0.006));
  knuckle.rotation.z = -0.35;
  add(knuckle);
  if (rd.electronic) add(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.02, 0.016, 3, 0.005), mats.metal('#121315', 0.5, 0.3))).position.copy(knuckle.position).add(v3(0.018, 0.012, 0.004));
  for (const z of [0.053, 0.067]) {
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.026, cageLen + 0.024, 0.002, 3, 0.0009), rdMat);
    plate.position.copy(pTop.clone().lerp(pBot, 0.5)).setZ(z);
    plate.rotation.z = Math.atan2(pTop.x - pBot.x, pTop.y - pBot.y) * -1;
    add(plate);
  }
  for (const p of [pTop, pBot]) {
    const geo = new THREE.ExtrudeGeometry(gearShape(12, 0.003, 0.0018), { depth: 0.006, bevelEnabled: false, curveSegments: 3 });
    const m = new THREE.Mesh(geo, mats.metal('#30343a', 0.4, 0.4));
    m.position.copy(p).setZ(0.057);
    add(m);
  }

  // Chain: alternating inner/outer link plates (figure-eight shaped) with rollers, along both runs
  {
    const plate = new THREE.Shape();
    plate.absarc(-0.00635, 0, 0.0042, Math.PI / 2, (Math.PI * 3) / 2, false);
    plate.quadraticCurveTo(0, -0.0028, 0.00635, -0.0042);
    plate.absarc(0.00635, 0, 0.0042, -Math.PI / 2, Math.PI / 2, false);
    plate.quadraticCurveTo(0, 0.0028, -0.00635, 0.0042);
    const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 0.0008, bevelEnabled: false, curveSegments: 8 });
    const rollerGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.0055, 12);
    rollerGeo.rotateX(Math.PI / 2);
    geos.push(plateGeo, rollerGeo);
    const runs: [V3, V3][] = [
      [bb.clone().add(v3(0, big, 0)).setZ(0.0695), rearC.clone().add(v3(0, ringR((groupset.cassette[0] + groupset.cassette[1]) / 2), 0)).setZ(0.057)],
      [bb.clone().add(v3(0, -big, 0)).setZ(0.0695), pBot.clone().add(v3(0, -0.012, 0)).setZ(0.06)],
    ];
    const lengths = runs.map(([a, b]) => Math.floor(a.distanceTo(b) / 0.0127));
    const total = lengths.reduce((x, y) => x + y, 0);
    const plates = new THREE.InstancedMesh(plateGeo, mats.metal('#9aa2ab', 0.28, 1), total * 2);
    const rollers = new THREE.InstancedMesh(rollerGeo, mats.metal('#5d636b', 0.35, 1), total);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    let r = 0;
    runs.forEach(([a, b], ri) => {
      const n = lengths[ri];
      q.setFromAxisAngle(v3(0, 0, 1), Math.atan2(b.y - a.y, b.x - a.x));
      for (let i = 0; i < n; i++) {
        const p = a.clone().lerp(b, (i + 0.5) / n);
        const outer = i % 2 === 0;
        for (const dz of outer ? [-0.0046, 0.0038] : [-0.0036, 0.0028]) {
          m4.compose(p.clone().add(v3(0, 0, dz)), q, v3(1, outer ? 1 : 0.94, 1));
          plates.setMatrixAt(k++, m4);
        }
        m4.compose(a.clone().lerp(b, i / n), q, v3(1, 1, 1));
        rollers.setMatrixAt(r++, m4);
      }
    });
    add(plates);
    add(rollers);
  }
  // Front derailleur (double chainrings)
  if (rings.length > 1) {
    const st = T.seat.pieces[0].bez;
    let best = 0.15;
    for (let t = 0; t < 0.5; t += 0.01) if (P(bezAt(st, t)).y - bb.y > big + 0.02) {
      best = t;
      break;
    }
    const fdp = P(bezAt(st, best)).add(v3(0.03, 0.004, 0.06));
    const cage = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.018, 0.012, 3, 0.004), rdMat);
    cage.position.copy(fdp);
    cage.rotation.z = -0.25;
    add(cage);
  }

  // ───────────── Seatpost and saddle ─────────────
  {
    const a = P(sh.seatMast ? { x: g.seatTop.x + fd.post.dir.x * 16, y: g.seatTop.y + fd.post.dir.y * 16 } : fd.post.a);
    const b = P(fd.post.b);
    if (sh.seatMast) {
      const mast = sweepGeometry(new THREE.LineCurve3(P(g.seatTop), a), { size: () => [mm(T.seat.wb), mm(T.seat.wb) * latRatio], aero: aeroness, capEnd: true, segments: 4 });
      add(new THREE.Mesh(mast, colorAt('seat', 1)));
    }
    const postDepth = frame.frameType === 'aero' || frame.frameType === 'tt' ? 0.042 : 0.03;
    const post = sweepGeometry(new THREE.LineCurve3(a, b), { size: () => [postDepth, 0.022], aero: aeroness * 0.6, capEnd: true, segments: 6 });
    add(new THREE.Mesh(post, mats.carbon(true)));
    if (sh.offAxisPost) add(blob(P(g.seatTop), mm(T.seat.wb) * 0.55, mm(T.seat.wb) * 0.65, mm(T.seat.wb) * latRatio * 0.6, colorAt('seat', 1)));
    // Clamp head
    add(blob(b.clone().add(v3(0, 0.004, 0)), 0.018, 0.01, 0.016, mats.metal('#1d1f22', 0.35, 0.7)));
    // Saddle shell: top-view outline, extruded, then bent so nose and tail drop like a real saddle.
    const len = saddle.cutout && saddle.widthMm >= 140 ? 0.245 : 0.272;
    const wid = saddle.widthMm / 1000;
    const shape = new THREE.Shape();
    shape.moveTo(-len * 0.45, 0);
    shape.bezierCurveTo(-len * 0.47, wid * 0.5, -len * 0.25, wid * 0.53, -len * 0.05, wid * 0.36);
    shape.bezierCurveTo(len * 0.15, wid * 0.2, len * 0.4, wid * 0.13, len * 0.55, wid * 0.08);
    shape.bezierCurveTo(len * 0.58, 0.012, len * 0.58, -0.012, len * 0.55, -wid * 0.08);
    shape.bezierCurveTo(len * 0.4, -wid * 0.13, len * 0.15, -wid * 0.2, -len * 0.05, -wid * 0.36);
    shape.bezierCurveTo(-len * 0.25, -wid * 0.53, -len * 0.47, -wid * 0.5, -len * 0.45, 0);
    const pad = saddle.padding === 'plush' ? 0.02 : saddle.padding === 'medium' ? 0.014 : 0.009;
    const sg = new THREE.ExtrudeGeometry(shape, { depth: pad, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 6, curveSegments: 32 });
    sg.rotateX(-Math.PI / 2);
    const pa = sg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i);
      // dome sideways, drop at nose and tail
      pa.setY(i, pa.getY(i) - 0.35 * x * x - 0.9 * z * z * (pa.getY(i) > pad * 0.5 ? 1 : 0.6));
    }
    sg.computeVertexNormals();
    const saddleMat = mats.custom(`saddle-${saddle.brand}`, () => new THREE.MeshPhysicalMaterial({ color: saddle.brand === 'Brooks' ? '#6d4320' : '#131416', roughness: saddle.brand === 'Brooks' ? 0.65 : 0.52, sheen: 0.4, sheenRoughness: 0.6, clearcoat: 0.15 }));
    const sm = new THREE.Mesh(sg, saddleMat);
    sm.position.copy(b).add(v3(0, 0.02, 0));
    add(sm);
    if (saddle.cutout) {
      const cut = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mats.rubber('#050506', 0.9));
      cut.scale.set(len * 0.18, wid * 0.08, 1);
      cut.rotation.x = -Math.PI / 2;
      cut.position.copy(b).add(v3(len * 0.06, 0.02 + pad + 0.0072, 0));
      add(cut);
    }
    for (const z of [0.022, -0.022]) {
      const rail = new THREE.CatmullRomCurve3([b.clone().add(v3(-len * 0.38, 0.018, z * 1.4)), b.clone().add(v3(-len * 0.1, 0.004, z)), b.clone().add(v3(len * 0.2, 0.004, z)), b.clone().add(v3(len * 0.45, 0.016, z * 0.5))]);
      add(new THREE.Mesh(new THREE.TubeGeometry(rail, 24, 0.0035, 8, false), pro ? mats.carbon(true) : steel));
    }
  }

  // ───────────── Cockpit ─────────────
  {
    const integrated = bars.barType === 'aero-integrated';
    if (ck.spacers > 0) {
      add(rod(P(fd.headTop), P(ck.stemStart), mm(T.head.wa) * 0.47, mm(T.head.wa) * 0.4, mats.carbon(true)));
      add(rod(P(ck.stemStart), P({ x: ck.stemStart.x + fd.headUp.x * 3, y: ck.stemStart.y + fd.headUp.y * 3 }), 0.017, 0.017, mats.metal('#16181b', 0.4, 0.6)));
    }
    const stem = (a: Pt, b: Pt, d: number, w: number) => {
      const geo = sweepGeometry(new THREE.LineCurve3(P(a), P(b)), { size: () => [d, w], aero: 0.5, capStart: true, capEnd: true, segments: 6 });
      add(new THREE.Mesh(geo, integrated ? mats.carbon(true) : mats.metal('#1b1d20', 0.35, 0.6)));
    };
    if (bars.style === 'v-stem') {
      stem(ck.stemStart, ck.stemEnd, 0.02, 0.03);
      stem({ x: ck.stemStart.x + 4, y: ck.stemStart.y + 16 }, ck.stemEnd, 0.018, 0.03);
    } else if (bars.style === 'y-cockpit') {
      stem(ck.stemStart, ck.stemEnd, mm(T.head.wa) * 0.75, 0.034);
    } else {
      stem(ck.stemStart, ck.stemEnd, integrated ? 0.034 : 0.032, integrated ? 0.03 : 0.032);
    }
    if (bars.style === 'wing-kink' || bars.style === 'rise') stem(ck.stemEnd, ck.dropsStart, 0.024, 0.04);
    const se = P(ck.dropsStart);
    const halfW = 0.2;
    const hasDrops = bars.positions.includes('drops');
    if (hasDrops) {
      const flare = bars.barType === 'flared-gravel' ? 0.05 : 0;
      const side = (s: number) => [
        v3(se.x - 0.022, se.y - 0.122, s * (halfW + flare)),
        v3(se.x + 0.035, se.y - 0.127, s * (halfW + flare * 0.9)),
        v3(se.x + 0.086, se.y - 0.1, s * (halfW + flare * 0.6)),
        v3(se.x + 0.096, se.y - 0.042, s * (halfW + flare * 0.2)),
        v3(se.x + 0.07, se.y + 0.004, s * halfW),
        v3(se.x + 0.025, se.y, s * (halfW - 0.01)),
        v3(se.x, se.y, s * (halfW - 0.05)),
      ];
      const curve = new THREE.CatmullRomCurve3([...side(-1), v3(se.x, se.y, 0), ...side(1).reverse()], false, 'catmullrom', 0.3);
      const tape = mats.tape();
      add(new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.0122, 14, false), tape));
      if (integrated) {
        const tops = sweepGeometry(new THREE.LineCurve3(v3(se.x, se.y, -halfW + 0.035), v3(se.x, se.y, halfW - 0.035)), { size: () => [0.036, 0.013], aero: 0, segments: 10, capStart: true, capEnd: true });
        add(new THREE.Mesh(tops, mats.carbon(true)));
      }
      // Hoods and levers
      for (const s of [1, -1]) {
        const hood = blob(v3(se.x + 0.085, se.y + 0.016, s * halfW), 0.04, 0.022, 0.017, mats.rubber('#141517', 0.75), -0.2);
        add(hood);
        add(blob(v3(se.x + 0.118, se.y + 0.028, s * halfW), 0.012, 0.016, 0.014, mats.rubber('#141517', 0.75)));
        const lever = new THREE.CatmullRomCurve3([v3(se.x + 0.11, se.y + 0.002, s * halfW), v3(se.x + 0.118, se.y - 0.04, s * halfW), v3(se.x + 0.108, se.y - 0.088, s * (halfW - 0.004))]);
        add(new THREE.Mesh(new THREE.TubeGeometry(lever, 16, 0.0045, 8, false), carbonCranks ? mats.carbon(true) : compMat));
      }
    }
    if (bars.barType === 'tri-aero') {
      const barMat = mats.carbon(true);
      if (!hasDrops) {
        const wing = new THREE.CatmullRomCurve3([v3(se.x + 0.07, se.y - 0.035, -0.2), v3(se.x + 0.02, se.y, -0.16), v3(se.x, se.y, 0), v3(se.x + 0.02, se.y, 0.16), v3(se.x + 0.07, se.y - 0.035, 0.2)]);
        add(new THREE.Mesh(new THREE.TubeGeometry(wing, 80, 0.013, 12, false), barMat));
      }
      for (const s of [1, -1]) {
        const ext = new THREE.CatmullRomCurve3([v3(se.x - 0.01, se.y + 0.05, s * 0.07), v3(se.x + 0.25, se.y + 0.055, s * 0.055), v3(se.x + 0.33, se.y + 0.09, s * 0.05)]);
        add(new THREE.Mesh(new THREE.TubeGeometry(ext, 40, 0.011, 12, false), barMat));
        const padBox = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.016, 0.075, 4, 0.007), mats.rubber('#18191b', 0.7));
        padBox.position.set(se.x + 0.02, se.y + 0.066, s * 0.08);
        add(padBox);
        add(rod(v3(se.x, se.y, s * 0.08), v3(se.x + 0.01, se.y + 0.058, s * 0.08), 0.008, 0.008, compMat));
      }
    }
  }

  if (opts.only === 'wheels') {
    // Keep just the wheels (used to make spinning wheel images for the ride animation).
    root.children = root.children.filter((c) => wheelGroups.includes(c));
  }

  return {
    group: root,
    dispose() {
      geos.forEach((g2) => g2.dispose());
      mats.dispose();
    },
  };
}
