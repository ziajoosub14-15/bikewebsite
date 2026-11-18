import { useId } from 'react';
import type { ResolvedBuild } from '../../domain/bikeModel';
import type { Category, Colourway, FrameType, WheelLook } from '../../types/components';
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

/**
 * A tube painted in segments (colour blocks, fades) over a dark outline, with a highlight for gloss,
 * pearl and metallic finishes and optional stripes.
 */
function PaintedTube({ a, b, w, cw, tube, xAt, outline }: { a: Pt; b: Pt; w: number; cw: Colourway; tube: TubeId; xAt: (p: Pt) => number; outline: string }) {
  const at = (t: number) => lerp(a, b, t);
  const segs = tubeSegments(cw, tube, (t) => xAt(at(t)));
  const stripes = tubeStripes(cw, tube);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // Unit normal pointing "up" in screen space, for the highlight line.
  let nx = -(b.y - a.y) / len;
  let ny = (b.x - a.x) / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return (
    <>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={outline} strokeWidth={w + 2.5} strokeLinecap="round" />
      {segs.map((sg, i) => {
        const p0 = at(sg.t0);
        const p1 = at(sg.t1);
        const cap = (i === 0 && sg.t0 === 0) || (i === segs.length - 1 && sg.t1 === 1) ? 'round' : 'butt';
        return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={sg.color} strokeWidth={w} strokeLinecap={cap} />;
      })}
      {stripes.map((st, i) => {
        const p0 = at(st.t - st.width / 2);
        const p1 = at(st.t + st.width / 2);
        return <line key={`s${i}`} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={st.color} strokeWidth={w} />;
      })}
      {segs.map((sg, i) => {
        if (sg.finish === 'matte') return null;
        const p0 = at(Math.max(sg.t0, 0.04));
        const p1 = at(Math.min(sg.t1, 0.96));
        const off = w * 0.28;
        const hl = sg.finish === 'pearl' ? '#dfe9ff' : '#ffffff';
        const op = sg.finish === 'metallic' ? 0.45 : sg.finish === 'pearl' ? 0.6 : 0.32;
        return <line key={`h${i}`} x1={p0.x + nx * off} y1={p0.y + ny * off} x2={p1.x + nx * off} y2={p1.y + ny * off} stroke={hl} strokeOpacity={op} strokeWidth={Math.max(1, w * 0.18)} strokeLinecap="round" />;
      })}
    </>
  );
}

function Wheel(props: {
  c: Pt;
  idBase: string;
  tyreMm: number;
  tread: string;
  rimDepthMm: number;
  carbon: boolean;
  solidDisc: boolean;
  discBrake: boolean;
  look: WheelLook;
  sidewall: 'black' | 'tan';
}) {
  const { c, tyreMm, rimDepthMm, solidDisc, discBrake, look } = props;
  const tyreH = tyreMm * S * 0.95;
  const R = (311 + tyreMm) * S;
  const rimOuter = R - tyreH;
  const rimH = Math.max(rimDepthMm * S, 6);
  const rimInner = rimOuter - rimH;
  const rimColor = RIM_COLORS[look.rim];
  const rimEdge = look.rim === 'alloy-silver' ? '#8a95a3' : '#3a424c';
  const spokeColor = look.spokes ?? (look.rim === 'alloy-silver' ? '#9aa5b1' : '#3a4048');
  const textR = rimOuter - rimH / 2;
  const arcId = `${props.idBase}-arc`;
  const spokes = 24;
  return (
    <g>
      {/* Tyre */}
      <circle cx={c.x} cy={c.y} r={R - tyreH / 2} fill="none" stroke="#1d232b" strokeWidth={tyreH} />
      {props.tread !== 'slick' && (
        <circle
          cx={c.x}
          cy={c.y}
          r={R - 1.2}
          fill="none"
          stroke="#1d232b"
          strokeWidth={props.tread === 'knob' ? 4 : 2}
          strokeDasharray={props.tread === 'knob' ? '4 5' : '2 3'}
        />
      )}
      {props.sidewall === 'tan' ? (
        <circle cx={c.x} cy={c.y} r={R - tyreH * 0.68} fill="none" stroke={TAN_WALL} strokeWidth={tyreH * 0.5} />
      ) : (
        <circle cx={c.x} cy={c.y} r={R - tyreH * 0.3} fill="none" stroke="#3a434f" strokeWidth={1} opacity={0.6} />
      )}
      {/* Spinning part: rim, spokes or disc, logo */}
      <g className="wheel-spin">
        {solidDisc ? (
          <circle cx={c.x} cy={c.y} r={rimOuter} fill={`url(#${props.idBase}-disc)`} stroke={rimEdge} strokeWidth={1.5} />
        ) : (
          <>
            {Array.from({ length: spokes }, (_, i) => {
              const a = (i / spokes) * Math.PI * 2;
              const hubR = i % 2 ? 9 : 14;
              return (
                <line
                  key={i}
                  x1={c.x + Math.cos(a) * hubR}
                  y1={c.y + Math.sin(a) * hubR}
                  x2={c.x + Math.cos(a + (i % 2 ? 0.12 : -0.12)) * rimInner}
                  y2={c.y + Math.sin(a + (i % 2 ? 0.12 : -0.12)) * rimInner}
                  stroke={spokeColor}
                  strokeWidth={look.spokes ? 1.5 : 1}
                />
              );
            })}
            <circle cx={c.x} cy={c.y} r={rimOuter - rimH / 2} fill="none" stroke={rimColor} strokeWidth={rimH} />
            <circle cx={c.x} cy={c.y} r={rimInner} fill="none" stroke={rimEdge} strokeWidth={1} />
          </>
        )}
        <path
          id={arcId}
          d={`M ${c.x - textR} ${c.y} a ${textR} ${textR} 0 1 1 ${2 * textR} 0 a ${textR} ${textR} 0 1 1 ${-2 * textR} 0`}
          fill="none"
        />
        {rimH >= 9 && (
          <text
            fontSize={Math.max(6, Math.min(rimH * (look.decalStyle === 'bold' ? 0.62 : 0.42), look.decalStyle === 'bold' ? 18 : 11))}
            fontWeight={look.decalStyle === 'bold' ? 900 : 700}
            letterSpacing={look.decalStyle === 'bold' ? 2 : 1.5}
            fill={look.decalColor}
            opacity={look.decalStyle === 'bold' ? 1 : 0.85}
            dominantBaseline="central"
          >
            <textPath href={`#${arcId}`} startOffset="12%">
              {look.decalText}
            </textPath>
            <textPath href={`#${arcId}`} startOffset="62%">
              {look.decalText}
            </textPath>
          </text>
        )}
      </g>
      {/* Disc rotor */}
      {discBrake && (
        <g>
          <circle cx={c.x} cy={c.y} r={80 * S} fill="none" stroke="#a7b1bd" strokeWidth={4} />
          <circle cx={c.x} cy={c.y} r={80 * S - 6} fill="none" stroke="#d3d9e0" strokeWidth={1} strokeDasharray="3 3" />
        </g>
      )}
      <circle cx={c.x} cy={c.y} r={9} fill="#2f3741" />
      <circle cx={c.x} cy={c.y} r={3.5} fill="#9aa5b1" />
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
  const dtMid = lerp(g.bb, g.headBottom, 0.4);

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
          <Wheel c={g.rear} idBase={`${uid}-rear`} tyreMm={tyres.widthMm} tread={tyres.tread} rimDepthMm={wheels.rimDepthMm} carbon={wheels.look.rim.startsWith('carbon')} solidDisc={wheels.profile === 'disc'} discBrake={disc} look={wheels.look} sidewall={tyres.sidewall} />
          <Wheel c={g.front} idBase={`${uid}-front`} tyreMm={tyres.widthMm} tread={tyres.tread} rimDepthMm={wheels.rimDepthMm} carbon={wheels.look.rim.startsWith('carbon')} solidDisc={false} discBrake={disc} look={wheels.look} sidewall={tyres.sidewall} />
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
          {/* stays first, so the main triangle overlaps them */}
          <PaintedTube a={g.rear} b={stayJoin} w={g.tube * 0.55} cw={cw} tube="seatstay" xAt={xAt} outline={outline} />
          <PaintedTube a={g.rear} b={g.bb} w={g.tube * 0.7} cw={cw} tube="chainstay" xAt={xAt} outline={outline} />
          <PaintedTube a={g.bb} b={g.seatTop} w={g.tube} cw={cw} tube="seat" xAt={xAt} outline={outline} />
          <PaintedTube a={seatCluster} b={{ x: g.headTop.x + 2, y: g.headTop.y + 8 }} w={g.tube * 0.9} cw={cw} tube="top" xAt={xAt} outline={outline} />
          <PaintedTube a={g.bb} b={g.headBottom} w={g.tube * 1.3} cw={cw} tube="down" xAt={xAt} outline={outline} />
          <PaintedTube a={g.headTop} b={g.headBottom} w={g.tube * 1.15 + 2} cw={cw} tube="head" xAt={xAt} outline={outline} />
          {/* Fork: drawn as a straight-ish painted tube from crown to axle */}
          <PaintedTube a={g.headBottom} b={g.front} w={g.tube * 0.85} cw={cw} tube="fork" xAt={xAt} outline={outline} />
          {/* Down-tube decal */}
          <text
            transform={`translate(${dtMid.x} ${dtMid.y}) rotate(${dtAngle})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.max(8, Math.min(g.tube * 0.95, 16))}
            fontWeight={900}
            fontStyle="italic"
            letterSpacing={Math.max(1, g.tube * 0.18)}
            fill={decal}
          >
            {frame.brand.toUpperCase()}
          </text>
          {/* Bottom bracket shell */}
          <circle cx={g.bb.x} cy={g.bb.y} r={g.tube * 0.75 + 4} fill={outline} />
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
          <line x1={g.seatTop.x} y1={g.seatTop.y} x2={postTop.x} y2={postTop.y} stroke="#20262e" strokeWidth={g.tube * 0.7} strokeLinecap="round" />
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
          <line x1={g.headTop.x} y1={g.headTop.y} x2={g.headTop.x - 2} y2={g.headTop.y - 8} stroke={outline} strokeWidth={g.tube + 2} />
          <line
            x1={g.headTop.x - 2}
            y1={g.headTop.y - 6}
            x2={stemEnd.x}
            y2={stemEnd.y}
            stroke={bars.barType === 'aero-integrated' ? '#151a21' : '#2a313a'}
            strokeWidth={bars.barType === 'aero-integrated' ? 13 : 9}
            strokeLinecap="round"
          />
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
