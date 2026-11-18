import { useId } from 'react';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Category, Colourway, Finish, FrameType, WheelLook } from '../../types/components';
import { RIM_COLORS, TAN_WALL, hexMix, tubeSegments, tubeStripes, type TubeId } from '../bike/paint';

/** Pixels per millimetre. Wheels, tyres, rims, chainrings and cogs are drawn to scale. */
export const S = 0.5;
export const WHEEL_Y = 390;

export type Pt = { x: number; y: number };
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export interface FrameGeo {
  rear: Pt;
  front: Pt;
  bb: Pt;
  seatTop: Pt;
  headTop: Pt;
  headBottom: Pt;
  /** Where the seatstays meet the seat tube (0–1 along BB → seat top). */
  stayJoin: number;
  tube: number;
}

/** Side-view geometry per frame type: endurance/gravel sit taller, TT is long, low and steep. */
export function geometry(type: FrameType): FrameGeo {
  const rear = { x: 255, y: WHEEL_Y };
  switch (type) {
    case 'endurance':
      return { rear, front: { x: 758, y: WHEEL_Y }, bb: { x: 457, y: 426 }, seatTop: { x: 378, y: 160 }, headTop: { x: 642, y: 118 }, headBottom: { x: 672, y: 222 }, stayJoin: 0.9, tube: 11 };
    case 'gravel':
      return { rear, front: { x: 768, y: WHEEL_Y }, bb: { x: 460, y: 422 }, seatTop: { x: 380, y: 168 }, headTop: { x: 646, y: 122 }, headBottom: { x: 678, y: 226 }, stayJoin: 0.86, tube: 12 };
    case 'tt':
      return { rear, front: { x: 760, y: WHEEL_Y }, bb: { x: 462, y: 428 }, seatTop: { x: 418, y: 170 }, headTop: { x: 664, y: 176 }, headBottom: { x: 680, y: 230 }, stayJoin: 0.62, tube: 19 };
    case 'aero':
      return { rear, front: { x: 752, y: WHEEL_Y }, bb: { x: 457, y: 428 }, seatTop: { x: 374, y: 150 }, headTop: { x: 652, y: 142 }, headBottom: { x: 674, y: 218 }, stayJoin: 0.68, tube: 15 };
    case 'climbing':
    default:
      return { rear, front: { x: 752, y: WHEEL_Y }, bb: { x: 457, y: 428 }, seatTop: { x: 374, y: 150 }, headTop: { x: 650, y: 140 }, headBottom: { x: 672, y: 216 }, stayJoin: 0.9, tube: 9.5 };
  }
}

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
function ShadedTube(props: { a: Pt; b: Pt; wa: number; wb: number; cw: Colourway; tube: TubeId; xAt: (p: Pt) => number; uid: string; range?: [number, number]; caps?: boolean; name?: string }) {
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
  const wMax = Math.max(wa, wb);
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
  return (
    <>
      <defs>
        {[...segs.map((sg, i) => [i, sg.color, sg.finish] as const), ...stripes.map((st, i) => [`s${i}`, st.color, 'gloss' as Finish] as const)].map(([i, c, f]) => (
          <linearGradient key={String(i)} id={gid(i)} gradientUnits="userSpaceOnUse" x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
            {tubeStops(c, f).map(([o, col]) => (
              <stop key={o} offset={o} stopColor={col} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {/* outline */}
      <polygon points={poly(0, 1, 0.9)} fill={outline} />
      {caps && <circle cx={a.x} cy={a.y} r={wa / 2 + 0.9} fill={outline} />}
      {caps && <circle cx={b.x} cy={b.y} r={wb / 2 + 0.9} fill={outline} />}
      {caps && segs.length > 0 && <circle cx={a.x} cy={a.y} r={wa / 2} fill={`url(#${gid(0)})`} />}
      {caps && segs.length > 0 && <circle cx={b.x} cy={b.y} r={wb / 2} fill={`url(#${gid(segs.length - 1)})`} />}
      {segs.map((sg, i) => (
        <polygon key={i} points={poly(sg.t0, sg.t1 + (i < segs.length - 1 ? 0.004 : 0))} fill={`url(#${gid(i)})`} />
      ))}
      {stripes.map((st, i) => (
        <polygon key={`s${i}`} points={poly(st.t - st.width / 2, st.t + st.width / 2)} fill={`url(#${gid(`s${i}`)})`} />
      ))}
    </>
  );
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
  const { c, tyreMm, rimDepthMm, solidDisc, discBrake, look, idBase } = props;
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
  const n = 24;
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
              const a = (i / n) * Math.PI * 2;
              // Front: radial lacing. Rear: two-cross, spokes leave the hub flange at a tangent.
              const hubR = props.rear ? 21 : 16;
              const cross = props.rear ? (i % 2 ? 0.42 : -0.42) : 0;
              return (
                <line
                  key={i}
                  x1={c.x + Math.cos(a) * hubR}
                  y1={c.y + Math.sin(a) * hubR}
                  x2={c.x + Math.cos(a + cross) * (rimInner + 1)}
                  y2={c.y + Math.sin(a + cross) * (rimInner + 1)}
                  stroke={spokeColor}
                  strokeWidth={carbon || look.spokes ? 1.9 : 1.2}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={c.x} cy={c.y} r={rimOuter - rimH / 2} fill="none" stroke={`url(#${idBase}-rim)`} strokeWidth={rimH} />
            <circle cx={c.x} cy={c.y} r={rimInner} fill="none" stroke={hexMix(base, '#000000', 0.55)} strokeWidth={1} />
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
  const g = geometry(frame.frameType);
  const outline = hexMix(cw.base, '#000000', 0.5);
  void outline;
  const decal = cw.decal;
  const disc = frame.compat.brakeType === 'disc';
  const xAt = (p: Pt) => (p.x - g.rear.x) / (g.front.x - g.rear.x);
  const accent = groupset.brand === 'SRAM' && groupset.tier === 'pro' ? '#d7263d' : groupset.brand === 'Campagnolo' ? '#8fa3b8' : '#4b5563';
  const comp = groupset.tier === 'pro' || groupset.tier === 'performance' ? '#1b2027' : '#4a525d';

  const R = (311 + tyres.widthMm) * S;
  // Lift the bike so bigger tyres sit on the same ground line.
  const groundY = WHEEL_Y + (311 + 45) * S + 2;
  const lift = groundY - 2 - (WHEEL_Y + R);

  const seatCluster = lerp(g.bb, g.seatTop, 0.93);
  const stayJoin = lerp(g.bb, g.seatTop, g.stayJoin);
  const dtAngle = (Math.atan2(g.headBottom.y - g.bb.y, g.headBottom.x - g.bb.x) * 180) / Math.PI;

  // Saddle and seatpost
  const stDir = { x: (g.seatTop.x - g.bb.x) / Math.hypot(g.seatTop.x - g.bb.x, g.seatTop.y - g.bb.y), y: (g.seatTop.y - g.bb.y) / Math.hypot(g.seatTop.x - g.bb.x, g.seatTop.y - g.bb.y) };
  const postTop = { x: g.seatTop.x + stDir.x * 46, y: g.seatTop.y + stDir.y * 46 };
  const padH = saddle.padding === 'plush' ? 15 : saddle.padding === 'medium' ? 10 : 7;
  const sLen = saddle.cutout && saddle.widthMm >= 140 ? 122 : 135;
  const saddleColor = saddle.brand === 'Brooks' ? '#7a4b22' : '#161a20';

  // Cockpit
  const stemLen = (bars.integratedStemMm ?? 100) * S;
  const stemEnd = { x: g.headTop.x + stemLen, y: g.headTop.y - stemLen * 0.12 - 4 };
  const isTT = bars.barType === 'tri-aero';
  const hasDrops = bars.positions.includes('drops');

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
  const dim = (_cat: Category) => 1;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={920} height={520} viewBox="40 60 920 520" className="relative h-auto w-full select-none" role="img" aria-label={`${frame.brand} ${frame.name} with ${groupset.brand} ${groupset.name}`}>
      <defs>
        <radialGradient id={`${uid}-rear-disc`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#3b4450" />
          <stop offset="1" stopColor="#11151a" />
        </radialGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0f172a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10b981" floodOpacity="0.55" />
        </filter>
      </defs>

      {shadow && <ellipse cx={510} cy={groundY + 4} rx={360} ry={16} fill={`url(#${uid}-shadow)`} />}
      {floorLine && <line x1={70} x2={950} y1={groundY} y2={groundY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 6" />}

      <g transform={`translate(0 ${lift})`}>
        {/* Wheels and tyres */}
        {showWheels && <g filter={hl('wheels') ?? hl('tyres')} opacity={Math.max(dim('wheels'), dim('tyres'))}>
          <Wheel c={g.rear} rear idBase={`${uid}-rear`} tyreMm={tyres.widthMm} tread={tyres.tread} rimDepthMm={wheels.rimDepthMm} solidDisc={wheels.profile === 'disc'} discBrake={disc} look={wheels.look} sidewall={tyres.sidewall} tyreBrand={tyres.brand} />
          <Wheel c={g.front} rear={false} idBase={`${uid}-front`} tyreMm={tyres.widthMm} tread={tyres.tread} rimDepthMm={wheels.rimDepthMm} solidDisc={false} discBrake={disc} look={wheels.look} sidewall={tyres.sidewall} tyreBrand={tyres.brand} />
        </g>}

        {/* Cassette, chain, derailleur */}
        <g filter={hl('groupset') ?? hl('rearDerailleur')} opacity={Math.max(dim('groupset'), dim('rearDerailleur'))}>
          {cogs.map((t, i) => (
            <circle key={i} cx={g.rear.x} cy={g.rear.y} r={ringRadius(t)} fill="none" stroke={i === 2 ? '#7b8794' : '#a7b1bd'} strokeWidth={i === 2 ? 3 : 2} />
          ))}
          <path
            d={`M ${g.bb.x} ${g.bb.y - rBig} L ${g.rear.x} ${g.rear.y - rCogMid} M ${g.bb.x} ${g.bb.y + rBig} L ${pulleyBottom.x} ${pulleyBottom.y + 6}`}
            stroke="#5b6573"
            strokeWidth={3}
            strokeDasharray="5 2"
            fill="none"
          />
        </g>
        <g filter={hl('rearDerailleur')} opacity={dim('rearDerailleur')}>
          <path
            d={`M ${g.rear.x + 4} ${g.rear.y + 4} l 14 6 l -4 18 l -14 -4 z`}
            fill={comp}
            stroke="#0b0e12"
            strokeWidth={1}
          />
          <line x1={pulleyTop.x} y1={pulleyTop.y} x2={pulleyBottom.x} y2={pulleyBottom.y} stroke={comp} strokeWidth={7} strokeLinecap="round" />
          <circle cx={pulleyTop.x} cy={pulleyTop.y} r={5} fill="#e2e8f0" stroke={comp} strokeWidth={2} />
          <circle cx={pulleyBottom.x} cy={pulleyBottom.y} r={5} fill="#e2e8f0" stroke={comp} strokeWidth={2} />
          {rd.electronic && <rect x={g.rear.x + 14} y={g.rear.y + 2} width={14} height={9} rx={2} fill={accent} />}
        </g>

        {/* Frame */}
        <g filter={hl('frame')} opacity={dim('frame')}>
          {/* Rear end: stays and dropout (behind the main triangle) */}
          <ShadedTube uid={uid} a={g.rear} b={stayJoin} wa={g.tube * 0.42} wb={g.tube * 0.6} cw={cw} tube="seatstay" xAt={xAt} />
          <ShadedTube uid={uid} a={g.rear} b={g.bb} wa={g.tube * 0.5} wb={g.tube * 0.95} cw={cw} tube="chainstay" xAt={xAt} />
          <path d={`M ${g.rear.x - 9} ${g.rear.y + 3} l 6 -14 l 16 4 l -4 14 z`} fill="#24282d" />
          {/* Main triangle: tapered tubes, fat down tube, flared head tube */}
          <ShadedTube uid={uid} a={g.bb} b={g.seatTop} wa={g.tube * 1.2} wb={g.tube * 0.95} cw={cw} tube="seat" xAt={xAt} />
          <ShadedTube uid={uid} a={seatCluster} b={{ x: g.headTop.x + 2, y: g.headTop.y + 8 }} wa={g.tube * 0.85} wb={g.tube * 1.05} cw={cw} tube="top" xAt={xAt} />
          <ShadedTube uid={uid} a={g.bb} b={g.headBottom} wa={g.tube * 1.6} wb={g.tube * 1.3} cw={cw} tube="down" xAt={xAt} />
          {/* Fork: tapered and gently curved, drawn as three straight pieces */}
          {[0, 1, 2].map((k) => {
            const pt = (t: number) => {
              const ctrl = { x: g.front.x - 10, y: g.headBottom.y + (g.front.y - g.headBottom.y) * 0.55 };
              const u = 1 - t;
              return { x: u * u * g.headBottom.x + 2 * u * t * ctrl.x + t * t * g.front.x, y: u * u * g.headBottom.y + 2 * u * t * ctrl.y + t * t * g.front.y };
            };
            const t0 = k / 3;
            const t1 = (k + 1) / 3;
            const wAt = (t: number) => g.tube * (1.25 - 0.8 * t);
            return <ShadedTube key={k} uid={uid} a={pt(t0)} b={pt(t1)} wa={wAt(t0)} wb={wAt(t1)} cw={cw} tube="fork" xAt={xAt} range={[t0, t1]} />;
          })}
          <ShadedTube uid={uid} a={g.headTop} b={g.headBottom} wa={g.tube * 1.25 + 2} wb={g.tube * 1.6 + 3} cw={cw} tube="head" xAt={xAt} />
          {/* Bottom bracket shell */}
          {(() => {
            const bbCol = tubeSegments(cw, 'seat', () => 0.4)[0];
            return (
              <>
                <circle cx={g.bb.x} cy={g.bb.y} r={g.tube * 0.95 + 4} fill={hexMix(bbCol.color, '#000000', 0.6)} />
                <circle cx={g.bb.x} cy={g.bb.y} r={g.tube * 0.95 + 3} fill={hexMix(bbCol.color, '#000000', 0.12)} />
              </>
            );
          })()}
          {/* Down-tube logo, sized to fit the painted area it sits on */}
          {(() => {
            const dtLen = Math.hypot(g.headBottom.x - g.bb.x, g.headBottom.y - g.bb.y);
            const seg = tubeSegments(cw, 'down', (t) => xAt(lerp(g.bb, g.headBottom, t))).find((sg) => sg.t0 <= 0.32 && sg.t1 >= 0.32) ?? { t0: 0, t1: 1 };
            const s0 = Math.max(0.24, seg.t0 + 0.03);
            const s1 = Math.min(0.78, seg.t1 - 0.04);
            const centre = lerp(g.bb, g.headBottom, (s0 + s1) / 2);
            const width = g.tube * (1.6 - 0.3 * ((s0 + s1) / 2));
            return (
              <text
                transform={`translate(${centre.x} ${centre.y}) rotate(${dtAngle})`}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(8, Math.min(width * 0.62, 18))}
                fontWeight={900}
                fontStyle="italic"
                textLength={(s1 - s0) * dtLen * 0.86}
                lengthAdjust="spacingAndGlyphs"
                fill={decal}
              >
                {frame.brand.toUpperCase()}
              </text>
            );
          })()}
          {cw.detail && <circle cx={g.headTop.x + 1} cy={g.headTop.y + 18} r={Math.max(3, g.tube * 0.3)} fill={cw.detail} />}
        </g>

        {/* Brakes */}
        <g opacity={dim('groupset')}>
          {disc ? (
            <>
              <rect x={g.rear.x + 22} y={g.rear.y - 52} width={16} height={22} rx={4} fill={comp} transform={`rotate(-18 ${g.rear.x + 30} ${g.rear.y - 41})`} />
              <rect x={g.front.x - 34} y={g.front.y - 50} width={16} height={22} rx={4} fill={comp} transform={`rotate(18 ${g.front.x - 26} ${g.front.y - 39})`} />
            </>
          ) : (
            <>
              <path d={`M ${g.headBottom.x + 4} ${g.headBottom.y + 6} q 18 4 22 22`} stroke={comp} strokeWidth={6} fill="none" strokeLinecap="round" />
              <path d={`M ${stayJoin.x - 8} ${stayJoin.y + 4} q -18 6 -22 24`} stroke={comp} strokeWidth={6} fill="none" strokeLinecap="round" />
            </>
          )}
        </g>

        {/* Seatpost + saddle */}
        <g filter={hl('saddle')} opacity={dim('saddle')}>
          <ShadedTube uid={uid} name="post" a={g.seatTop} b={postTop} wa={g.tube * 0.8} wb={g.tube * 0.7} cw={CARBON} tube="seat" xAt={xAt} />
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
        <g filter={hl('handlebars')} opacity={dim('handlebars')}>
          {/* spacers + stem */}
          <ShadedTube uid={uid} name="spacer" a={g.headTop} b={{ x: g.headTop.x - 2, y: g.headTop.y - 9 }} wa={g.tube * 1.25 + 2} wb={g.tube * 1.2 + 2} cw={CARBON} tube="head" xAt={() => 0} caps={false} />
          <ShadedTube uid={uid} name="stem" a={{ x: g.headTop.x - 2, y: g.headTop.y - 6 }} b={stemEnd} wa={bars.barType === 'aero-integrated' ? 15 : 11} wb={bars.barType === 'aero-integrated' ? 12 : 9} cw={CARBON} tube="top" xAt={() => 0} />
          {hasDrops && (
            <>
              {bars.barType === 'flared-gravel' && (
                <path d={`M ${stemEnd.x} ${stemEnd.y} c 22 -3 36 4 38 22 c 2 20 -6 40 -26 44`} stroke="#6b7480" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.6} transform="translate(8 6)" />
              )}
              <path
                d={`M ${stemEnd.x} ${stemEnd.y} c 24 -4 40 4 42 26 c 2 24 -6 44 -28 46 l -10 0`}
                stroke="#161a20"
                strokeWidth={bars.barType === 'aero-integrated' ? 10 : 8}
                fill="none"
                strokeLinecap="round"
              />
              {/* lever + hood */}
              <path d={`M ${stemEnd.x + 30} ${stemEnd.y - 3} q 16 -10 20 6 q -2 6 -6 10 l -5 28`} stroke={comp} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {groupset.brand === 'Campagnolo' && <circle cx={stemEnd.x + 41} cy={stemEnd.y + 12} r={3} fill={accent} />}
            </>
          )}
          {isTT && !hasDrops && (
            <path d={`M ${stemEnd.x - 6} ${stemEnd.y + 4} l 62 4 q 10 2 12 14`} stroke="#161a20" strokeWidth={10} fill="none" strokeLinecap="round" />
          )}
          {isTT && (
            <>
              <rect x={stemEnd.x - 14} y={stemEnd.y - 22} width={34} height={8} rx={4} fill="#20262e" />
              <path d={`M ${stemEnd.x} ${stemEnd.y - 14} l 84 -4 q 10 -1 14 -12`} stroke="#161a20" strokeWidth={6} fill="none" strokeLinecap="round" />
              <line x1={stemEnd.x - 4} y1={stemEnd.y - 14} x2={stemEnd.x - 4} y2={stemEnd.y - 2} stroke="#2a313a" strokeWidth={6} />
            </>
          )}
        </g>

        {/* Chainset in front of the frame */}
        <g filter={hl('groupset')} opacity={dim('groupset')}>
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
