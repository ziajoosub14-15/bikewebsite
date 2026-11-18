import { gradeToAngle } from './power';
import type { Route } from './types';

/** Precomputed lookups over a route: where each segment starts and its elevation. */
export interface RouteGeometry {
  totalM: number;
  /** Distance (m) at the start of each segment. */
  segStartM: number[];
  /** Elevation (m) at the start of each segment. */
  segStartElevM: number[];
  /** Index of the segment containing distance x. */
  segmentAt(x: number): number;
  elevationAt(x: number): number;
}

export function buildGeometry(route: Route, startElevationOverride?: number): RouteGeometry {
  const segStartM: number[] = [];
  const segStartElevM: number[] = [];
  let d = 0;
  let e = startElevationOverride ?? route.startElevationM;
  for (const s of route.segments) {
    segStartM.push(d);
    segStartElevM.push(e);
    d += s.lengthM;
    e += s.lengthM * Math.sin(gradeToAngle(s.gradePct));
  }
  const totalM = d;
  const n = route.segments.length;

  // Simulations move forward, so try the last answer first; otherwise binary search.
  let last = 0;
  const segmentAt = (x: number): number => {
    if (n === 0) return 0;
    if (x >= segStartM[last] && (last === n - 1 || x < segStartM[last + 1])) return last;
    if (last < n - 1 && x >= segStartM[last + 1] && (last + 1 === n - 1 || x < segStartM[last + 2])) return ++last;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segStartM[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    last = lo;
    return lo;
  };
  const elevationAt = (x: number): number => {
    const i = segmentAt(x);
    const s = route.segments[i];
    const along = Math.min(Math.max(x - segStartM[i], 0), s.lengthM);
    return segStartElevM[i] + along * Math.sin(gradeToAngle(s.gradePct));
  };
  return { totalM, segStartM, segStartElevM, segmentAt, elevationAt };
}

export interface ProfilePoint {
  distM: number;
  elevationM: number;
  gradePct: number;
}

/** Elevation profile: one point at the start of each segment plus the finish. */
export function routeProfile(route: Route): ProfilePoint[] {
  const g = buildGeometry(route);
  const pts: ProfilePoint[] = route.segments.map((s, i) => ({
    distM: g.segStartM[i],
    elevationM: g.segStartElevM[i],
    gradePct: s.gradePct,
  }));
  const lastSeg = route.segments[route.segments.length - 1];
  if (lastSeg) pts.push({ distM: g.totalM, elevationM: g.elevationAt(g.totalM), gradePct: lastSeg.gradePct });
  return pts;
}

export function totalClimbM(route: Route): number {
  return route.segments.reduce(
    (sum, s) => sum + Math.max(0, s.lengthM * Math.sin(gradeToAngle(s.gradePct))),
    0,
  );
}
