import { useId } from 'react';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Category, Colourway, Finish, WheelLook } from '../../types/components';
import { RIM_COLORS, TAN_WALL, hexMix, tubeSegments, tubeStripes, type TubeId } from '../bike/paint';
import { bezAt, cockpitGeometry, frameDrawing, lerp, S, spokeAngles, WHEEL_Y, type Pt, type TubeDef } from '../bike/frameShape';

export { geometry, lerp, S, WHEEL_Y, type Pt } from '../bike/frameShape';

/** Gradient stops across a tube's width, so it reads as a rounded, lit tube. */
function tubeStops(c: string, finish: Finish): [number, string, number?][] {
  const dk = (k: number) => hexMix(c, '#000000', k);
  const lt = (k: number) => hexMix(c, finish === 'pearl' ? '#e3ecff' : '#ffffff', k);
  switch (finish) {
    case 'matte':
      return [[0, dk(0.32)], [0.22, lt(0.06)], [0.45, c], [0.8, dk(0.12)], [1, dk(0.42)]];
    case 'metallic':
      return [[0, dk(0.4)], [0.16, c], [0.3, lt(0.7)], [0.4, lt(0.15)], [0.7, dk(0.1)], [0.9, lt(0.12)], [1, dk(0.5)]];
    case 'pearl':
      return [[0, dk(0.25)], [0.18, c], [0.3, lt(0.75)], [0.42, c], [0.85, dk(0.08)], [1, dk(0.35)]];
    default:
      return [[0, dk(0.38)], [0.17, c], [0.29, lt(0.6)], [0.38, c], [0.82, dk(0.12)], [1, dk(0.48)]];
  }
}

/** A solid black carbon "colourway" for seatposts, stems and other components. */
const CARBON: Colourway = { id: 'carbon', name: 'Carbon', base: '#1e2226', pattern: 'solid', finish: 'gloss', decal: '#ffffff', official: false };

/**
 * A tapered, shaded tube from a (width wa) to b (width wb), painted in colourway segments.
 * `range` lets one logical tube (e.g. a curved fork) be drawn as several straight pieces.
 */
function ShadedTube(props: { a: Pt; b: Pt; wa: number; wb: number; cw: Colourway; tube: TubeId; xAt: (p: Pt) => number; uid: string; range?: [number, number]; caps?: boolean; capA?: boolean; capB?: boolean; name?: string; layer?: 'outline' | 'fill'; gradW?: number }) {
  const { a, b, wa, wb, cw, tube, xAt, uid } = props;
  const [r0, r1] = props.range ?? [0, 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  if (n.y > 0) n = { x: -n.x, y: -n.y }; // normal pointing up the screen: the lit side
  const at = (t: number) => lerp(a, b, t);
  const w = (t: number) => wa + (wb - wa) * t;
  const edge = (t: number, side: number) => {
    const p = at(t);
    return `${(p.x + n.x * side * w(t) / 2).toFixed(1)},${(p.y + n.y * side * w(t) / 2).toFixed(1)}`;
  };
  // Paint segments in this piece's local t (0–1), mapped from the logical tube's range.
  const segs = tubeSegments(cw, tube, (lt) => xAt(at((lt - r0) / (r1 - r0))))
    .map((sg) => ({ ...sg, t0: (Math.max(sg.t0, r0) - r0) / (r1 - r0), t1: (Math.min(sg.t1, r1) - r0) / (r1 - r0) }))
    .filter((sg) => sg.t1 > sg.t0 + 1e-6);
  const stripes = tubeStripes(cw, tube)
    .map((st) => ({ ...st, t: (st.t - r0) / (r1 - r0), width: st.width / (r1 - r0) }))
    .filter((st) => st.t > 0 && st.t < 1);
  const wMax = props.gradW ?? Math.max(wa, wb);
  const mid = at(0.5);
  const gx1 = mid.x + (n.x * wMax) / 2;
  const gy1 = mid.y + (n.y * wMax) / 2;
  const gx2 = mid.x - (n.x * wMax) / 2;
  const gy2 = mid.y - (n.y * wMax) / 2;
  const outline = hexMix(cw.base, '#000000', 0.6);
  const gid = (i: number | string) => `${uid}-${props.name ?? tube}-${r0.toFixed(2)}-${i}`;
  const poly = (t0: number, t1: number, grow = 0) => {
    const e = (t: number, side: number) => {
      const p = at(t);
      const hw = w(t) / 2 + grow;
      return `${(p.x + n.x * side * hw).toFixed(1)},${(p.y + n.y * side * hw).toFixed(1)}`;
    };
    return `${e(t0, 1)} ${e(t1, 1)} ${e(t1, -1)} ${e(t0, -1)}`;
  };
  void edge;
  const caps = props.caps ?? true;
  const capA = caps && (props.capA ?? true);
  const capB = caps && (props.capB ?? true);
  return (
    <>
      {props.layer !== 'outline' && <defs>
        {[...segs.map((sg, i) => [i, sg.color, sg.finish] as const), ...stripes.map((st, i) => [`s${i}`, st.color, 'gloss' as Finish] as const)].map(([i, c, f]) => (
          <linearGradient key={String(i)} id={gid(i)} gradientUnits="userSpaceOnUse" x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
            {tubeStops(c, f).map(([o, col]) => (
              <stop key={o} offset={o} stopColor={col} />
            ))}
          </linearGradient>
        ))}
      </defs>}
      {props.layer !== 'fill' && (
        <>
          {/* outline */}
          <polygon points={poly(0, 1, 0.9)} fill={outline} />
          {capA && <circle cx={a.x} cy={a.y} r={wa / 2 + 0.9} fill={outline} />}
          {capB && <circle cx={b.x} cy={b.y} r={wb / 2 + 0.9} fill={outline} />}
        </>
      )}
      {props.layer !== 'outline' && (
        <>
          {capA && segs.length > 0 && <circle cx={a.x} cy={a.y} r={wa / 2} fill={`url(#${gid(0)})`} />}
          {capB && segs.length > 0 && <circle cx={b.x} cy={b.y} r={wb / 2} fill={`url(#${gid(segs.length - 1)})`} />}
          {segs.map((sg, i) => (
            // Slight overlap (in t and across joints) so neighbouring pieces meet without hairline gaps.
            <polygon
              key={i}
              points={poly(sg.t0 === 0 ? (capA ? 0 : -0.04) : sg.t0 - 0.02, sg.t1 === 1 ? (capB ? 1 : 1.04) : sg.t1 + 0.02)}
              fill={`url(#${gid(i)})`}
            />
          ))}
          {stripes.map((st, i) => (
            <polygon key={`s${i}`} points={poly(st.t - st.width / 2, st.t + st.width / 2)} fill={`url(#${gid(`s${i}`)})`} />
          ))}
        </>
      )}
    </>
  );
}

/** Draw a (possibly curved, multi-piece) frame tube as a chain of short shaded pieces. */
function Tube({ def, cw, xAt, uid, name, k = 5 }: { def: TubeDef; cw: Colourway; xAt: (p: Pt) => number; uid: string; name?: string; k?: number }) {
  const parts: JSX.Element[] = [];
  // All outlines first, then all paint, so piece joints don't show as dark lines.
  for (const layer of ['outline', 'fill'] as const)
  def.pieces.forEach((pc, pi) => {
    for (let j = 0; j < k; j++) {
      const t0 = j / k;
      const t1 = (j + 1) / k;
      const g0 = pc.r0 + (pc.r1 - pc.r0) * t0;
      const g1 = pc.r0 + (pc.r1 - pc.r0) * t1;
      parts.push(
        <ShadedTube
          key={`${layer}-${pi}-${j}`}
          layer={layer}
          gradW={Math.max(def.wa, def.wb)}
          uid={uid}
          name={`${name ?? def.id}-${pi}-${j}`}
          a={bezAt(pc.bez, t0)}
          b={bezAt(pc.bez, t1)}
          wa={def.wa + (def.wb - def.wa) * g0}
          wb={def.wa + (def.wb - def.wa) * g1}
          cw={cw}
          tube={def.id}
          xAt={xAt}
          range={[g0, g1]}
          capA={g0 === 0}
          capB={g1 === 1}
        />,
      );
    }
  });
  return <>{parts}</>;
}

function Wheel(props: {
  c: Pt;
  idBase: string;
  tyreMm: number;
  tread: string;
  rimDepthMm: number;
  solidDisc: boolean;
  discBrake: boolean;
  rear: boolean;
  look: WheelLook;
  sidewall: 'black' | 'tan';
  tyreBrand: string;
}) {
  const { c, tyreMm, solidDisc, discBrake, look, idBase } = props;
  const rimDepthMm = (props.rear ? look.depthRear : look.depthFront) ?? props.rimDepthMm;
  const tyreH = tyreMm * S * 0.95;
  const R = (311 + tyreMm) * S;
  const rimOuter = R - tyreH;
  const rimH = Math.max(rimDepthMm * S, 6);
  const rimInner = rimOuter - rimH;
  const carbon = look.rim.startsWith('carbon');
  const base = RIM_COLORS[look.rim];
  const sheen = look.rim === 'carbon-gloss' ? 0.22 : look.rim === 'carbon-matte' ? 0.12 : look.rim === 'alloy-silver' ? 0.35 : 0.14;
  const spokeColor = look.spokes ?? (look.rim === 'alloy-silver' ? '#a3adb8' : '#15181c');
  const f = (r: number) => Math.max(0, Math.min(1, r / R));
  const textR = rimOuter - rimH * 0.52;
  const arcId = `${idBase}-arc`;
  const tyreArc = `${idBase}-tarc`;
  const tyreTextR = R - tyreH * 0.52;
  const n = (props.rear ? look.spokesRear : look.spokesFront) ?? 24;
  const lacing = props.rear ? look.lacing ?? '2x' : 'radial';
  const spokeAngle = (i: number) => spokeAngles(i, n, lacing);
  const bold = look.decalStyle === 'bold';
  const mainSize = Math.max(7, Math.min(rimH * (bold ? 0.6 : 0.5), bold ? 20 : 17));
  const brakeTrack = !discBrake;
  return (
    <g>
      <defs>
        {/* Tyre: rounded, slightly lighter at the shoulders */}
        <radialGradient id={`${idBase}-tyre`} gradientUnits="userSpaceOnUse" cx={c.x} cy={c.y} r={R}>
          <stop offset={f(rimOuter)} stopColor="#2a2e33" />
          <stop offset={f(rimOuter + tyreH * 0.35)} stopColor="#16191c" />
          <stop offset={f(R - tyreH * 0.25)} stopColor="#1c1f23" />
          <stop offset={1} stopColor="#2c3035" />
        </radialGradient>
        {/* Rim: deep carbon profile with a soft band of sheen */}
        <radialGradient id={`${idBase}-rim`} gradientUnits="userSpaceOnUse" cx={c.x} cy={c.y} r={R}>
          <stop offset={f(rimInner)} stopColor={hexMix(base, '#000000', 0.45)} />
          <stop offset={f(rimInner + rimH * 0.18)} stopColor={base} />
          <stop offset={f(rimInner + rimH * 0.55)} stopColor={hexMix(base, '#ffffff', sheen)} />
          <stop offset={f(rimInner + rimH * 0.85)} stopColor={base} />
          <stop offset={f(rimOuter)} stopColor={hexMix(base, '#000000', 0.3)} />
        </radialGradient>
        <radialGradient id={`${idBase}-disc`} gradientUnits="userSpaceOnUse" cx={c.x - rimOuter * 0.25} cy={c.y - rimOuter * 0.3} r={rimOuter * 1.3}>
          <stop offset={0} stopColor="#3a4048" />
          <stop offset={0.6} stopColor="#1d2125" />
          <stop offset={1} stopColor="#0f1113" />
        </radialGradient>
        <radialGradient id={`${idBase}-hub`} cx="0.4" cy="0.35" r="0.7">
          <stop offset={0} stopColor="#59616b" />
          <stop offset={1} stopColor="#191d22" />
        </radialGradient>
      </defs>

      {/* Tyre */}
      <circle cx={c.x} cy={c.y} r={R - tyreH / 2} fill="none" stroke={`url(#${idBase}-tyre)`} strokeWidth={tyreH} />
      {props.tread !== 'slick' && (
        <circle cx={c.x} cy={c.y} r={R - 1.2} fill="none" stroke="#14171a" strokeWidth={props.tread === 'knob' ? 4.5 : 2} strokeDasharray={props.tread === 'knob' ? '4 5' : '2 3'} />
      )}
      {props.sidewall === 'tan' && <circle cx={c.x} cy={c.y} r={R - tyreH * 0.66} fill="none" stroke={TAN_WALL} strokeWidth={tyreH * 0.5} />}
      <path id={tyreArc} d={`M ${c.x - tyreTextR} ${c.y} a ${tyreTextR} ${tyreTextR} 0 1 1 ${2 * tyreTextR} 0 a ${tyreTextR} ${tyreTextR} 0 1 1 ${-2 * tyreTextR} 0`} fill="none" />
      {tyreH >= 11 && (
        <text fontSize={Math.min(tyreH * 0.42, 8)} fontWeight={800} letterSpacing={1.2} fill={props.sidewall === 'tan' ? '#5b4630' : '#8a9097'} dominantBaseline="central">
          <textPath href={`#${tyreArc}`} startOffset="30%">
            {props.tyreBrand.toUpperCase()}
          </textPath>
          <textPath href={`#${tyreArc}`} startOffset="80%">
            {props.tyreBrand.toUpperCase()}
          </textPath>
        </text>
      )}

      {/* Spinning part: spokes, rim or disc, decals */}
      <g className="wheel-spin">
        {solidDisc ? (
          <circle cx={c.x} cy={c.y} r={rimOuter} fill={`url(#${idBase}-disc)`} stroke="#0c0e10" strokeWidth={1.2} />
        ) : (
          <>
            {Array.from({ length: n }, (_, i) => {
              // Front: radial lacing. Rear: two-cross / G3 / 2:1, spokes leave the hub flange at a tangent.
              const hubR = props.rear ? 21 : 16;
              const [a, ar] = spokeAngle(i);
              return (
                <line
                  key={i}
                  x1={c.x + Math.cos(a) * hubR}
                  y1={c.y + Math.sin(a) * hubR}
                  x2={c.x + Math.cos(ar) * (rimInner + 1)}
                  y2={c.y + Math.sin(ar) * (rimInner + 1)}
                  stroke={spokeColor}
                  strokeWidth={carbon || look.spokes ? 1.9 : 1.2}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={c.x} cy={c.y} r={rimOuter - rimH / 2} fill="none" stroke={`url(#${idBase}-rim)`} strokeWidth={rimH} />
            <circle cx={c.x} cy={c.y} r={rimInner} fill="none" stroke={hexMix(base, '#000000', 0.55)} strokeWidth={1} />
            {look.wavyRim && (
              // Zipp NSW "Sawtooth": a wavy inner edge (like a whale's flipper).
              <path
                d={Array.from({ length: 181 }, (_, k) => {
                  const a = (k / 180) * Math.PI * 2;
                  const r = rimInner + 3 + Math.sin(a * 16) * 3;
                  return `${k ? 'L' : 'M'}${(c.x + Math.cos(a) * r).toFixed(1)},${(c.y + Math.sin(a) * r).toFixed(1)}`;
                }).join('') + 'Z'}
                fill="none"
                stroke={hexMix(base, '#ffffff', 0.12)}
                strokeWidth={6}
              />
            )}
            {/* Valve */}
            <rect x={c.x + Math.cos(-1.1) * rimInner - 2} y={c.y + Math.sin(-1.1) * rimInner - 6} width={4} height={10} rx={1.5} fill="#8b939c" transform={`rotate(${(-1.1 * 180) / Math.PI + 90} ${c.x + Math.cos(-1.1) * rimInner} ${c.y + Math.sin(-1.1) * rimInner})`} />
          </>
        )}
        {brakeTrack && <circle cx={c.x} cy={c.y} r={rimOuter - 3} fill="none" stroke={carbon ? '#2e3338' : '#9aa3ad'} strokeWidth={5} />}
        {look.rim === 'carbon-gloss' && <path d={`M ${c.x + Math.cos(-2.6) * textR} ${c.y + Math.sin(-2.6) * textR} A ${textR} ${textR} 0 0 1 ${c.x + Math.cos(-1.9) * textR} ${c.y + Math.sin(-1.9) * textR}`} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={rimH * 0.35} fill="none" strokeLinecap="round" />}
        <path id={arcId} d={`M ${c.x - textR} ${c.y} a ${textR} ${textR} 0 1 1 ${2 * textR} 0 a ${textR} ${textR} 0 1 1 ${-2 * textR} 0`} fill="none" />
        {rimH >= 9 && (
          <text dominantBaseline="central" fill={look.decalColor}>
            {[8, 58].map((start) => (
              <textPath key={start} href={`#${arcId}`} startOffset={`${start}%`}>
                <tspan fontSize={mainSize} fontWeight={bold ? 900 : 800} letterSpacing={bold ? 2.5 : 3}>
                  {look.decalText}
                </tspan>
                {look.decalSub && rimH >= 16 && (
                  <tspan fontSize={mainSize * 0.45} fontWeight={700} letterSpacing={1} dx={8} opacity={0.85}>
                    {look.decalSub}
                  </tspan>
                )}
              </textPath>
            ))}
          </text>
        )}
      </g>

      {/* Disc rotor */}
      {discBrake && (
        <g>
          <circle cx={c.x} cy={c.y} r={80 * S - 2.5} fill="none" stroke="#c3cad2" strokeWidth={5} />
          <circle cx={c.x} cy={c.y} r={80 * S - 2.5} fill="none" stroke="#7d8792" strokeWidth={2.2} strokeDasharray="2 5" />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            return <line key={i} x1={c.x + Math.cos(a) * 13} y1={c.y + Math.sin(a) * 13} x2={c.x + Math.cos(a + 0.25) * (80 * S - 5)} y2={c.y + Math.sin(a + 0.25) * (80 * S - 5)} stroke="#2a2f35" strokeWidth={3.5} strokeLinecap="round" />;
          })}
        </g>
      )}
      {/* Hub */}
      <circle cx={c.x} cy={c.y} r={props.rear ? 21 : 17} fill={`url(#${idBase}-hub)`} />
      <circle cx={c.x} cy={c.y} r={props.rear ? 15 : 12} fill="none" stroke="#6b737d" strokeWidth={1.2} />
      <circle cx={c.x} cy={c.y} r={5.5} fill="#aab3bd" />
      <circle cx={c.x} cy={c.y} r={2.2} fill="#3b4148" />
    </g>
  );
}

const ringRadius = (teeth: number) => ((teeth * 12.7) / (2 * Math.PI)) * S;

interface Props {
  build: ResolvedBuild;
  colourway: Colourway;
  highlight?: Category | null;
  /** Draw the dashed floor line (only on the plain studio background). */
  floorLine?: boolean;
  /** Leave the wheels out (the ride animation draws its own spinning wheels). */
  wheels?: boolean;
  /** Ground shadow under the bike. */
  shadow?: boolean;
}

export function BikeIllustration({ build, colourway: cw, highlight, floorLine = true, wheels: showWheels = true, shadow = true }: Props) {
  const uid = useId().replace(/:/g, '');
  const { frame, wheels, groupset, rearDerailleur: rd, handlebars: bars, saddle, tyres } = build;
  const fd = frameDrawing(frame);
  const g = fd.g;
  const sh = fd.shape;
  const ck = cockpitGeometry(fd, bars);
  const decal = cw.decal;
  const disc = frame.compat.brakeType === 'disc';
  const xAt = (p: Pt) => (p.x - g.rear.x) / (g.front.x - g.rear.x);
  const accent = groupset.brand === 'SRAM' && groupset.tier === 'pro' ? '#d7263d' : groupset.brand === 'Campagnolo' ? '#8fa3b8' : '#4b5563';
  const comp = groupset.tier === 'pro' || groupset.tier === 'performance' ? '#1b2027' : '#4a525d';
  const paintAt = (tube: TubeId, t: number) => tubeSegments(cw, tube, () => 0.5).find((sg) => sg.t0 <= t && sg.t1 >= t) ?? tubeSegments(cw, tube, () => 0.5)[0];

  const R = (311 + tyres.widthMm) * S;
  // Lift the bike so bigger tyres sit on the same ground line.
  const groundY = WHEEL_Y + (311 + 45) * S + 2;
  const lift = groundY - 2 - (WHEEL_Y + R);

  const down = fd.tubes.down.pieces[0].bez;
  const dtAngle = (Math.atan2(down.b.y - down.a.y, down.b.x - down.a.x) * 180) / Math.PI;

  // Saddle
  const postTop = fd.post.b;
  const padH = saddle.padding === 'plush' ? 15 : saddle.padding === 'medium' ? 10 : 7;
  const sLen = saddle.cutout && saddle.widthMm >= 140 ? 122 : 135;
  const saddleColor = saddle.brand === 'Brooks' ? '#7a4b22' : '#161a20';

  // Cockpit
  const stemEnd = ck.stemEnd;
  const ds = ck.dropsStart;
  const isTT = bars.barType === 'tri-aero';
  const hasDrops = bars.positions.includes('drops');
  const integrated = bars.barType === 'aero-integrated';

  // Drivetrain
  const rings = groupset.chainrings;
  const rBig = ringRadius(Math.max(...rings));
  const cogs = [groupset.cassette[0], (groupset.cassette[0] + groupset.cassette[1]) / 2, groupset.cassette[1]];
  const rCogMid = ringRadius(cogs[1]);
  const cageLen = 26 + (rd.maxCog - 28) * 1.1;
  const pulleyTop = { x: g.rear.x + 6, y: g.rear.y + 28 };
  const pulleyBottom = { x: g.rear.x - 2, y: g.rear.y + 28 + cageLen };
  const crankAngle = (62 * Math.PI) / 180;
  const pedal = { x: g.bb.x + Math.cos(crankAngle) * 172.5 * S, y: g.bb.y + Math.sin(crankAngle) * 172.5 * S };

  const hl = (cat: Category) => (highlight === cat ? `url(#${uid}-glow)` : undefined);

  /** Thin seam lines across a tube near its ends, for lugged frames. */
  const lugSeams = (def: TubeDef, ts: number[]) =>
    ts.map((t, i) => {
      const bz = def.pieces[0].bez;
      const p = bezAt(bz, t);
      const q = bezAt(bz, Math.min(1, t + 0.01));
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
      const w = (def.wa + (def.wb - def.wa) * t) / 2 + 1.5;
      return <line key={`${def.id}-${i}`} x1={p.x + n.x * w} y1={p.y + n.y * w} x2={p.x - n.x * w} y2={p.y - n.y * w} stroke="#000000" strokeOpacity={0.35} strokeWidth={1.4} />;
    });

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={920} height={520} viewBox="40 60 920 520" className="relative h-auto w-full select-none" role="img" aria-label={`${frame.brand} ${frame.name} with ${groupset.brand} ${groupset.name}`}>
      <defs>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0f172a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10b981" floodOpacity="0.55" />
        </filter>
        {fd.isoFlow && (
          // Trek IsoFlow: cut a real opening through the seat mast.
          <mask id={`${uid}-iso`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="700">
            <rect x="0" y="0" width="1000" height="700" fill="white" />
            <ellipse cx={fd.isoFlow.c.x} cy={fd.isoFlow.c.y} rx={fd.isoFlow.rx} ry={fd.isoFlow.ry} transform={`rotate(${fd.isoFlow.angleDeg} ${fd.isoFlow.c.x} ${fd.isoFlow.c.y})`} fill="black" />
          </mask>
        )}
      </defs>

      {shadow && <ellipse cx={510} cy={groundY + 4} rx={360} ry={16} fill={`url(#${uid}-shadow)`} />}
      {floorLine && <line x1={70} x2={950} y1={groundY} y2={groundY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 6" />}

      <g transform={`translate(0 ${lift})`}>
        {/* Wheels and tyres */}
        {showWheels && (
          <g filter={hl('wheels') ?? hl('tyres')}>
            <Wheel c={g.rear} rear idBase={`${uid}-rear`} tyreMm={tyres.widthMm} tread={tyres.tread} rimDepthMm={wheels.rimDepthMm} solidDisc={wheels.profile === 'disc'} discBrake={disc} look={wheels.look} sidewall={tyres.sidewall} tyreBrand={tyres.brand} />
            <Wheel c={g.front} rear={false} idBase={`${uid}-front`} tyreMm={tyres.widthMm} tread={tyres.tread} rimDepthMm={wheels.rimDepthMm} solidDisc={false} discBrake={disc} look={wheels.look} sidewall={tyres.sidewall} tyreBrand={tyres.brand} />
          </g>
        )}

        {/* Cassette, chain, derailleur */}
        <g filter={hl('groupset') ?? hl('rearDerailleur')}>
          {cogs.map((t, i) => (
            <circle key={i} cx={g.rear.x} cy={g.rear.y} r={ringRadius(t)} fill="none" stroke={i === 2 ? '#7b8794' : '#a7b1bd'} strokeWidth={i === 2 ? 3 : 2} />
          ))}
          <path d={`M ${g.bb.x} ${g.bb.y - rBig} L ${g.rear.x} ${g.rear.y - rCogMid} M ${g.bb.x} ${g.bb.y + rBig} L ${pulleyBottom.x} ${pulleyBottom.y + 6}`} stroke="#5b6573" strokeWidth={3} strokeDasharray="5 2" fill="none" />
        </g>
        <g filter={hl('rearDerailleur')}>
          <path d={`M ${g.rear.x + 4} ${g.rear.y + 4} l 14 6 l -4 18 l -14 -4 z`} fill={comp} stroke="#0b0e12" strokeWidth={1} />
          <line x1={pulleyTop.x} y1={pulleyTop.y} x2={pulleyBottom.x} y2={pulleyBottom.y} stroke={comp} strokeWidth={7} strokeLinecap="round" />
          <circle cx={pulleyTop.x} cy={pulleyTop.y} r={5} fill="#e2e8f0" stroke={comp} strokeWidth={2} />
          <circle cx={pulleyBottom.x} cy={pulleyBottom.y} r={5} fill="#e2e8f0" stroke={comp} strokeWidth={2} />
          {rd.electronic && <rect x={g.rear.x + 14} y={g.rear.y + 2} width={14} height={9} rx={2} fill={accent} />}
        </g>

        {/* Frame */}
        <g filter={hl('frame')}>
          <g mask={fd.isoFlow ? `url(#${uid}-iso)` : undefined}>
            {/* Rear end: stays and dropout (behind the main triangle) */}
            <Tube def={fd.tubes.seatstay} cw={cw} xAt={xAt} uid={uid} />
            <Tube def={fd.tubes.chainstay} cw={cw} xAt={xAt} uid={uid} k={3} />
            <path d={`M ${g.rear.x - 9} ${g.rear.y + 3} l 6 -14 l 16 4 l -4 14 z`} fill="#24282d" />
            {/* Main triangle */}
            <Tube def={fd.tubes.seat} cw={cw} xAt={xAt} uid={uid} />
            {sh.seatMast && (
              // Integrated seat mast: the frame paint carries on up to the topper.
              <ShadedTube uid={uid} name="mast" a={g.seatTop} b={{ x: g.seatTop.x + fd.post.dir.x * 16, y: g.seatTop.y + fd.post.dir.y * 16 }} wa={fd.tubes.seat.wb} wb={fd.tubes.seat.wb * 0.92} cw={cw} tube="seat" xAt={xAt} range={[0.99, 1]} />
            )}
            <Tube def={fd.tubes.top} cw={cw} xAt={xAt} uid={uid} k={4} />
            <Tube def={fd.tubes.down} cw={cw} xAt={xAt} uid={uid} k={4} />
          </g>
          {fd.isoFlow && <ellipse cx={fd.isoFlow.c.x} cy={fd.isoFlow.c.y} rx={fd.isoFlow.rx + 0.8} ry={fd.isoFlow.ry + 0.8} transform={`rotate(${fd.isoFlow.angleDeg} ${fd.isoFlow.c.x} ${fd.isoFlow.c.y})`} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={1.2} />}
          {/* Fork */}
          <Tube def={fd.tubes.fork} cw={cw} xAt={xAt} uid={uid} k={3} />
          <path d={`M ${g.front.x - 6} ${g.front.y + 5} l 2 -14 l 12 2 l -2 12 z`} fill="#24282d" />
          {/* Head tube */}
          <Tube def={fd.tubes.head} cw={cw} xAt={xAt} uid={uid} k={2} />
          {fd.nose &&
            (() => {
              const col = paintAt('head', 0.9);
              const pts = fd.nose!;
              return (
                <>
                  <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill={hexMix(col.color, '#000000', 0.55)} transform="translate(0.8 0.8)" />
                  <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill={col.color} />
                  {col.finish !== 'matte' && <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="#fff" strokeOpacity={0.3} strokeWidth={2} />}
                </>
              );
            })()}
          {fd.bento && (
            <path
              d={`M ${fd.bento.a.x} ${fd.bento.a.y - fd.tubes.top.wb / 2 + 1} L ${fd.bento.a.x + 4} ${fd.bento.a.y - fd.tubes.top.wb / 2 - fd.bento.h} L ${fd.bento.b.x - 2} ${fd.bento.b.y - fd.tubes.top.wb / 2 - fd.bento.h + 2} L ${fd.bento.b.x + 2} ${fd.bento.b.y - fd.tubes.top.wb / 2 + 1} Z`}
              fill={hexMix(paintAt('top', 0.8).color, '#000000', 0.25)}
              stroke="#000"
              strokeOpacity={0.3}
            />
          )}
          {sh.lugs && (
            <>
              {lugSeams(fd.tubes.top, [0.07, 0.94])}
              {lugSeams(fd.tubes.down, [0.9])}
              {lugSeams(fd.tubes.seat, [0.86])}
            </>
          )}
          {/* Bottom bracket shell */}
          {(() => {
            const bbCol = paintAt('seat', 0.02);
            return (
              <>
                <circle cx={g.bb.x} cy={g.bb.y} r={fd.tubes.down.wa / 2 + 2} fill={hexMix(bbCol.color, '#000000', 0.6)} />
                <circle cx={g.bb.x} cy={g.bb.y} r={fd.tubes.down.wa / 2 + 1} fill={hexMix(bbCol.color, '#000000', 0.1)} />
              </>
            );
          })()}
          {/* Down-tube logo, sized to fit the painted area it sits on */}
          {(() => {
            const dtLen = Math.hypot(down.b.x - down.a.x, down.b.y - down.a.y);
            const seg = tubeSegments(cw, 'down', (t) => xAt(lerp(down.a, down.b, t))).find((sg) => sg.t0 <= 0.38 && sg.t1 >= 0.38) ?? { t0: 0, t1: 1 };
            const s0 = Math.max(0.24, seg.t0 + 0.03);
            const s1 = Math.min(0.8, seg.t1 - 0.04);
            const centre = bezAt(down, (s0 + s1) / 2);
            const width = fd.tubes.down.wa + (fd.tubes.down.wb - fd.tubes.down.wa) * ((s0 + s1) / 2);
            return (
              <text transform={`translate(${centre.x} ${centre.y}) rotate(${dtAngle})`} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8, Math.min(width * 0.6, 19))} fontWeight={900} fontStyle="italic" textLength={(s1 - s0) * dtLen * 0.86} lengthAdjust="spacingAndGlyphs" fill={decal}>
                {frame.brand.toUpperCase()}
              </text>
            );
          })()}
          {cw.detail && <circle cx={fd.headTop.x + 1} cy={fd.headTop.y + 18} r={Math.max(3, g.tube * 0.3)} fill={cw.detail} />}
          {sh.futureShock && (
            // Specialized Future Shock: sprung boot between head tube and stem.
            <g>
              <rect x={fd.headTop.x - 9} y={fd.headTop.y - 15} width={18} height={15} rx={3} fill="#15181c" transform={`rotate(${(Math.atan2(fd.headUp.y, fd.headUp.x) * 180) / Math.PI + 90} ${fd.headTop.x} ${fd.headTop.y})`} />
              {[4, 8, 12].map((o) => (
                <line key={o} x1={fd.headTop.x - 8} y1={fd.headTop.y - o} x2={fd.headTop.x + 8} y2={fd.headTop.y - o - 2} stroke="#3a4048" strokeWidth={1.2} />
              ))}
            </g>
          )}
        </g>

        {/* Brakes */}
        <g>
          {disc ? (
            <>
              <rect x={g.rear.x + 22} y={g.rear.y - 52} width={16} height={22} rx={4} fill={comp} transform={`rotate(-18 ${g.rear.x + 30} ${g.rear.y - 41})`} />
              <rect x={g.front.x - 34} y={g.front.y - 50} width={16} height={22} rx={4} fill={comp} transform={`rotate(18 ${g.front.x - 26} ${g.front.y - 39})`} />
            </>
          ) : (
            <>
              <path d={`M ${g.headBottom.x + 4} ${g.headBottom.y + 6} q 18 4 22 22`} stroke={comp} strokeWidth={6} fill="none" strokeLinecap="round" />
              <path d={`M ${fd.stayJoin.x - 8} ${fd.stayJoin.y + 4} q -18 6 -22 24`} stroke={comp} strokeWidth={6} fill="none" strokeLinecap="round" />
            </>
          )}
        </g>

        {/* Seatpost + saddle */}
        <g filter={hl('saddle')}>
          <ShadedTube uid={uid} name="post" a={sh.seatMast ? { x: g.seatTop.x + fd.post.dir.x * 16, y: g.seatTop.y + fd.post.dir.y * 16 } : fd.post.a} b={postTop} wa={g.tube * (sh.seatMast ? 1.0 : 0.8)} wb={g.tube * 0.7} cw={CARBON} tube="seat" xAt={xAt} />
          <path
            d={`M ${postTop.x - sLen * 0.45} ${postTop.y - padH}
               q ${sLen * 0.08} ${-padH * 0.6} ${sLen * 0.3} ${-padH * 0.3}
               l ${sLen * 0.55} ${padH * 0.55}
               q ${sLen * 0.12} ${padH * 0.1} ${sLen * 0.12} ${padH * 0.55}
               l ${-sLen * 0.25} ${padH * 0.25}
               q ${-sLen * 0.45} ${padH * 0.05} ${-sLen * 0.72} ${-padH * 0.1} z`}
            fill={saddleColor}
          />
          <line x1={postTop.x - sLen * 0.25} y1={postTop.y - 1} x2={postTop.x + sLen * 0.3} y2={postTop.y + 1} stroke="#6b7480" strokeWidth={2.5} />
        </g>

        {/* Cockpit */}
        <g filter={hl('handlebars')}>
          {ck.spacers > 0 && <ShadedTube uid={uid} name="spacer" a={fd.headTop} b={ck.stemStart} wa={fd.tubes.head.wa} wb={fd.tubes.head.wa * 0.95} cw={CARBON} tube="head" xAt={() => 0} caps={false} />}
          {bars.style === 'v-stem' ? (
            // Cervélo V-stem: two arms with an opening between them.
            <>
              <ShadedTube uid={uid} name="stem-u" a={ck.stemStart} b={stemEnd} wa={9} wb={8} cw={CARBON} tube="top" xAt={() => 0} />
              <ShadedTube uid={uid} name="stem-l" a={{ x: ck.stemStart.x + 4, y: ck.stemStart.y + 16 }} b={stemEnd} wa={8} wb={7} cw={CARBON} tube="top" xAt={() => 0} />
            </>
          ) : bars.style === 'y-cockpit' ? (
            // Colnago CC.Y1: a wing that grows straight out of the head tube.
            <ShadedTube uid={uid} name="stem" a={ck.stemStart} b={stemEnd} wa={fd.tubes.head.wa * 0.85} wb={11} cw={CARBON} tube="top" xAt={() => 0} />
          ) : (
            <ShadedTube uid={uid} name="stem" a={ck.stemStart} b={stemEnd} wa={integrated ? 15 : 11} wb={integrated ? 12 : 9} cw={CARBON} tube="top" xAt={() => 0} />
          )}
          {(bars.style === 'wing-kink' || bars.style === 'rise') && <ShadedTube uid={uid} name="wing" a={stemEnd} b={ds} wa={12} wb={10} cw={CARBON} tube="top" xAt={() => 0} />}
          {hasDrops && (
            <>
              {bars.barType === 'flared-gravel' && <path d={`M ${ds.x} ${ds.y} c 22 -3 36 4 38 22 c 2 20 -6 40 -26 44`} stroke="#6b7480" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.6} transform="translate(8 6)" />}
              <path d={`M ${ds.x} ${ds.y} c 24 -4 40 4 42 26 c 2 24 -6 44 -28 46 l -10 0`} stroke="#161a20" strokeWidth={integrated ? 10 : 8} fill="none" strokeLinecap="round" />
              {/* lever + hood */}
              <path d={`M ${ds.x + 30} ${ds.y - 3} q 16 -10 20 6 q -2 6 -6 10 l -5 28`} stroke={comp} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {groupset.brand === 'Campagnolo' && <circle cx={ds.x + 41} cy={ds.y + 12} r={3} fill={accent} />}
            </>
          )}
          {isTT && !hasDrops && <path d={`M ${stemEnd.x - 6} ${stemEnd.y + 4} l 62 4 q 10 2 12 14`} stroke="#161a20" strokeWidth={10} fill="none" strokeLinecap="round" />}
          {isTT && (
            <>
              <rect x={stemEnd.x - 14} y={stemEnd.y - 22} width={34} height={8} rx={4} fill="#20262e" />
              <path d={`M ${stemEnd.x} ${stemEnd.y - 14} l 84 -4 q 10 -1 14 -12`} stroke="#161a20" strokeWidth={6} fill="none" strokeLinecap="round" />
              <line x1={stemEnd.x - 4} y1={stemEnd.y - 14} x2={stemEnd.x - 4} y2={stemEnd.y - 2} stroke="#2a313a" strokeWidth={6} />
            </>
          )}
        </g>

        {/* Chainset in front of the frame */}
        <g filter={hl('groupset')}>
          <circle cx={g.bb.x} cy={g.bb.y} r={rBig} fill="none" stroke={comp} strokeWidth={5} />
          <circle cx={g.bb.x} cy={g.bb.y} r={rBig + 2.5} fill="none" stroke="#7b8794" strokeWidth={1} strokeDasharray="1.5 2.5" />
          {rings.length > 1 && <circle cx={g.bb.x} cy={g.bb.y} r={ringRadius(Math.min(...rings))} fill="none" stroke="#5b6573" strokeWidth={3} />}
          {Array.from({ length: 4 }, (_, i) => {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            return <line key={i} x1={g.bb.x} y1={g.bb.y} x2={g.bb.x + Math.cos(a) * (rBig - 3)} y2={g.bb.y + Math.sin(a) * (rBig - 3)} stroke={comp} strokeWidth={6} strokeLinecap="round" />;
          })}
          <line x1={g.bb.x} y1={g.bb.y} x2={pedal.x} y2={pedal.y} stroke={comp} strokeWidth={11} strokeLinecap="round" />
          <line x1={g.bb.x} y1={g.bb.y} x2={pedal.x} y2={pedal.y} stroke={accent} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
          <rect x={pedal.x - 14} y={pedal.y - 4} width={28} height={8} rx={3} fill="#20262e" />
          <circle cx={g.bb.x} cy={g.bb.y} r={8} fill="#c4ccd6" stroke={comp} strokeWidth={2} />
        </g>
      </g>
    </svg>
  );
}
