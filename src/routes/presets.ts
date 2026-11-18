import type { Route, RouteSegment, Surface } from '../physics/types';

interface Section {
  label: string;
  lengthM: number;
  /** Constant gradient, or a function of distance into the section (m) for variety. */
  grade: number | ((d: number) => number);
  heading: number | ((d: number) => number);
  surface?: Surface;
  /** Add a corner of this radius every `every` metres. Headings flip at each corner when `switchback` is set. */
  corners?: { every: number; radius: number | ((i: number) => number); switchback?: boolean };
  /** Corner at the very end of the section (e.g. a U-turn). */
  endCornerM?: number;
}

const STEP = 100;

/** Build a route from human-sized sections, cut into ≤100 m segments. */
export function makeRoute(id: string, name: string, description: string, startElevationM: number, sections: Section[]): Route {
  const segments: RouteSegment[] = [];
  for (const s of sections) {
    let d = 0;
    let cornerIdx = 0;
    let nextCorner = s.corners?.every ?? Infinity;
    let flip = false;
    while (d < s.lengthM - 1e-6) {
      const len = Math.min(STEP, s.lengthM - d, nextCorner - d > 0 ? nextCorner - d : STEP);
      const mid = d + len / 2;
      const grade = typeof s.grade === 'number' ? s.grade : s.grade(mid);
      let heading = typeof s.heading === 'number' ? s.heading : s.heading(mid);
      if (flip) heading = (heading + 180) % 360;
      const seg: RouteSegment = { lengthM: len, gradePct: Math.round(grade * 10) / 10, headingDeg: heading, surface: s.surface ?? 'smooth', label: s.label };
      d += len;
      if (s.corners && Math.abs(d - nextCorner) < 1e-6 && d < s.lengthM - 1) {
        const r = s.corners.radius;
        seg.cornerRadiusM = typeof r === 'number' ? r : r(cornerIdx);
        cornerIdx++;
        nextCorner += s.corners.every;
        if (s.corners.switchback) flip = !flip;
      }
      segments.push(seg);
    }
    if (s.endCornerM) segments[segments.length - 1].cornerRadiusM = s.endCornerM;
  }
  return { id, name, description, startElevationM, segments };
}

const wave = (amp: number, period: number, base = 0) => (d: number) => base + amp * Math.sin((2 * Math.PI * d) / period);

export const PRESET_ROUTES: Route[] = [
  makeRoute('flat-tt', 'Flat time trial', '40 km out-and-back on smooth, flat roads with a tight U-turn. Aero is everything.', 8, [
    { label: '0–10 km', lengthM: 10000, grade: wave(0.4, 3000), heading: 90 },
    { label: '10–20 km (turn)', lengthM: 10000, grade: wave(0.4, 3000), heading: 90, endCornerM: 7 },
    { label: '20–30 km', lengthM: 10000, grade: wave(-0.4, 3000), heading: 270 },
    { label: '30–40 km', lengthM: 10000, grade: wave(-0.4, 3000), heading: 270 },
  ]),
  makeRoute('rolling', 'Rolling hills', '55 km of short climbs and fast descents, with a rough chip-seal stretch.', 60, [
    { label: 'Flat start', lengthM: 6000, grade: wave(0.5, 2000), heading: 45 },
    { label: 'Climb 1', lengthM: 2200, grade: wave(1.2, 1100, 5), heading: 80, corners: { every: 700, radius: 45 } },
    { label: 'Descent 1', lengthM: 2200, grade: wave(1, 900, -5), heading: 120, corners: { every: 550, radius: 35 } },
    { label: 'Valley', lengthM: 7000, grade: wave(0.8, 2500), heading: 170 },
    { label: 'Climb 2', lengthM: 3200, grade: wave(1, 1600, 4), heading: 200, corners: { every: 800, radius: 40 } },
    { label: 'Descent 2', lengthM: 3200, grade: wave(1.5, 1200, -4.5), heading: 240, corners: { every: 600, radius: 30 } },
    { label: 'Chip-seal flat', lengthM: 9000, grade: wave(0.6, 3000), heading: 280, surface: 'rough' },
    { label: 'Climb 3', lengthM: 1600, grade: wave(1.5, 800, 7), heading: 320, corners: { every: 500, radius: 25 } },
    { label: 'Descent 3', lengthM: 1600, grade: wave(1, 800, -7), heading: 350, corners: { every: 400, radius: 22 } },
    { label: 'Run-in', lengthM: 19000, grade: wave(0.7, 4000), heading: 20 },
  ]),
  makeRoute('jebel-jais', 'Jebel Jais-style climb', 'A steady 20 km mountain road at about 5.4% with wide switchbacks, from the valley to around 1,450 m. Thin, cooler air at the top.', 340, [
    { label: 'Approach', lengthM: 3000, grade: 0.8, heading: 60 },
    { label: 'Lower slopes', lengthM: 7000, grade: wave(1.2, 2300, 5.2), heading: 70, corners: { every: 1400, radius: 25, switchback: true } },
    { label: 'Middle switchbacks', lengthM: 7000, grade: wave(1.5, 1800, 5.8), heading: 100, corners: { every: 900, radius: 18, switchback: true } },
    { label: 'Summit kilometres', lengthM: 6500, grade: wave(1, 1500, 5.1), heading: 40, corners: { every: 1100, radius: 22, switchback: true } },
  ]),
  makeRoute('alpine', 'Alpine hairpins', 'A steep 13.8 km Alpine-style climb averaging 8% through 21 tight hairpins.', 740, [
    { label: 'Hairpins 21–15', lengthM: 4600, grade: wave(0.9, 1300, 8.6), heading: 10, corners: { every: 650, radius: 8, switchback: true } },
    { label: 'Hairpins 14–8', lengthM: 4600, grade: wave(0.7, 1300, 7.8), heading: 15, corners: { every: 650, radius: 8, switchback: true } },
    { label: 'Hairpins 7–1', lengthM: 4600, grade: wave(0.8, 1300, 7.6), heading: 5, corners: { every: 650, radius: 8, switchback: true } },
  ]),
  makeRoute('descent', 'Technical descent', '12 km fast and twisty descent: corners from tight hairpins to fast sweepers. Brakes, tyre grip and drag decide it.', 1500, [
    { label: 'Fast top', lengthM: 3000, grade: wave(1, 1500, -6.5), heading: 200, corners: { every: 600, radius: (i) => [60, 40, 80, 35][i % 4] } },
    { label: 'Hairpins', lengthM: 4500, grade: wave(0.8, 1200, -8), heading: 180, corners: { every: 450, radius: (i) => [12, 15, 10, 20][i % 4], switchback: true } },
    { label: 'Sweepers', lengthM: 4500, grade: wave(1, 1500, -6), heading: 150, corners: { every: 750, radius: (i) => [45, 30, 70][i % 3] } },
  ]),
];

export function findRoute(id: string, custom: Route[] = []): Route | undefined {
  return [...PRESET_ROUTES, ...custom].find((r) => r.id === id);
}

export interface RouteSection {
  label: string;
  startM: number;
  endM: number;
  /** Average gradient (%). */
  avgGradePct: number;
  kind: 'climb' | 'descent' | 'flat';
  corners: number;
}

/** Consecutive segments with the same label → sections, used for split times and race analysis. */
export function routeSections(route: Route): RouteSection[] {
  const out: RouteSection[] = [];
  let d = 0;
  for (const seg of route.segments) {
    const label = seg.label ?? 'Route';
    const last = out[out.length - 1];
    const rise = (seg.lengthM * seg.gradePct) / 100;
    if (last && last.label === label) {
      last.endM = d + seg.lengthM;
      (last as RouteSection & { rise: number }).rise += rise;
      if (seg.cornerRadiusM) last.corners++;
    } else {
      out.push(Object.assign({ label, startM: d, endM: d + seg.lengthM, avgGradePct: 0, kind: 'flat' as const, corners: seg.cornerRadiusM ? 1 : 0 }, { rise }));
    }
    d += seg.lengthM;
  }
  return out.map((s) => {
    const { rise, ...rest } = s as RouteSection & { rise: number };
    const avg = (rise / (s.endM - s.startM)) * 100;
    return { ...rest, avgGradePct: Math.round(avg * 10) / 10, kind: avg >= 2 ? 'climb' : avg <= -2 ? 'descent' : 'flat' };
  });
}
