import type { Route, RouteSegment } from '../physics/types';

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number;
}

/**
 * Pull track points out of a GPX file (Strava, Garmin, Komoot...). Uses a small regex parser so it
 * also runs in tests and Web Workers where DOMParser isn't available.
 */
export function parseGpxPoints(xml: string): GpxPoint[] {
  const pts: GpxPoint[] = [];
  const re = /<(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = /lat\s*=\s*["']([-\d.]+)["']/.exec(m[1]);
    const lon = /lon\s*=\s*["']([-\d.]+)["']/.exec(m[1]);
    const ele = m[2] ? /<ele>\s*([-\d.]+)\s*<\/ele>/.exec(m[2]) : null;
    if (lat && lon) pts.push({ lat: parseFloat(lat[1]), lon: parseFloat(lon[1]), ele: ele ? parseFloat(ele[1]) : NaN });
  }
  // Fill missing elevations from neighbours (or 0).
  const firstEle = pts.find((p) => !isNaN(p.ele))?.ele ?? 0;
  let prev = firstEle;
  for (const p of pts) {
    if (isNaN(p.ele)) p.ele = prev;
    prev = p.ele;
  }
  return pts;
}

export function gpxName(xml: string): string | null {
  const m = /<name>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/name>/.exec(xml);
  return m ? m[1].trim() : null;
}

const R_EARTH = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: GpxPoint, b: GpxPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b (0 = north, 90 = east). */
export function bearingDeg(a: GpxPoint, b: GpxPoint): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const GPX = {
  /** Resample spacing (m). */
  RESAMPLE_M: 25,
  /** Segment length the route is cut into (m). */
  SEGMENT_M: 50,
  /** Elevation smoothing window (resampled points). GPS elevation is noisy. */
  SMOOTH_POINTS: 7,
  MAX_GRADE_PCT: 25,
  /** Heading change above this (degrees) between segments counts as a corner. */
  CORNER_MIN_DEG: 25,
  MIN_CORNER_RADIUS_M: 6,
  MAX_CORNER_RADIUS_M: 90,
  /** Sections shorter than this are merged into the previous one. */
  MIN_SECTION_M: 400,
};

/** Turn GPX text into a Route the simulator can ride. */
export function gpxToRoute(xml: string, id: string, fallbackName = 'Uploaded route'): Route {
  const raw = parseGpxPoints(xml);
  if (raw.length < 2) throw new Error('No track points found. Is this a GPX file with a track?');
  // Cumulative distance, dropping duplicate points.
  const pts: (GpxPoint & { d: number })[] = [{ ...raw[0], d: 0 }];
  for (let i = 1; i < raw.length; i++) {
    const step = haversineM(pts[pts.length - 1], raw[i]);
    if (step < 1) continue;
    pts.push({ ...raw[i], d: pts[pts.length - 1].d + step });
  }
  const total = pts[pts.length - 1].d;
  if (total < 200) throw new Error('This route is shorter than 200 m.');

  // Resample at fixed spacing.
  const res: GpxPoint[] = [];
  let j = 0;
  for (let d = 0; d <= total; d += GPX.RESAMPLE_M) {
    while (j < pts.length - 2 && pts[j + 1].d < d) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const t = b.d === a.d ? 0 : (d - a.d) / (b.d - a.d);
    res.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele: a.ele + (b.ele - a.ele) * t });
  }
  // Smooth elevation.
  const half = Math.floor(GPX.SMOOTH_POINTS / 2);
  const ele = res.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(res.length - 1, i + half); k++) {
      s += res[k].ele;
      n++;
    }
    return s / n;
  });

  // Cut into segments.
  const per = Math.round(GPX.SEGMENT_M / GPX.RESAMPLE_M);
  const segs: RouteSegment[] = [];
  for (let i = 0; i + per < res.length; i += per) {
    const k = i + per;
    const run = GPX.SEGMENT_M;
    const grade = Math.max(-GPX.MAX_GRADE_PCT, Math.min(GPX.MAX_GRADE_PCT, ((ele[k] - ele[i]) / run) * 100));
    segs.push({ lengthM: run, gradePct: Math.round(grade * 10) / 10, headingDeg: Math.round(bearingDeg(res[i], res[k])), surface: 'smooth' });
  }
  // Corners from heading change.
  for (let i = 0; i < segs.length - 1; i++) {
    let dh = Math.abs(segs[i + 1].headingDeg - segs[i].headingDeg);
    if (dh > 180) dh = 360 - dh;
    if (dh >= GPX.CORNER_MIN_DEG) {
      const r = GPX.SEGMENT_M / ((dh * Math.PI) / 180);
      if (r <= GPX.MAX_CORNER_RADIUS_M) segs[i].cornerRadiusM = Math.max(GPX.MIN_CORNER_RADIUS_M, Math.round(r));
    }
  }
  labelSections(segs);
  return { id, name: gpxName(xml) || fallbackName, description: `Uploaded GPX · ${(total / 1000).toFixed(1)} km`, startElevationM: Math.round(ele[0]), segments: segs };
}

/** Group segments into Climb / Descent / Flat sections for splits. */
export function labelSections(segs: RouteSegment[]): void {
  const kind = (g: number) => (g >= 2 ? 'climb' : g <= -2 ? 'descent' : 'flat');
  // Smooth grades over ~500 m before classifying so a single steep pixel doesn't start a climb.
  const w = Math.max(1, Math.round(250 / (segs[0]?.lengthM || 50)));
  const k = segs.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(segs.length - 1, i + w); j++) {
      s += segs[j].gradePct;
      n++;
    }
    return kind(s / n);
  });
  // Runs
  const runs: { kind: string; start: number; end: number; len: number }[] = [];
  segs.forEach((s, i) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === k[i]) {
      last.end = i;
      last.len += s.lengthM;
    } else runs.push({ kind: k[i], start: i, end: i, len: s.lengthM });
  });
  // Merge short runs into the previous one.
  const merged: typeof runs = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && (r.len < GPX.MIN_SECTION_M || last.kind === r.kind)) {
      last.end = r.end;
      last.len += r.len;
    } else merged.push({ ...r });
  }
  const counts: Record<string, number> = {};
  for (const r of merged) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    const name = r.kind === 'climb' ? 'Climb' : r.kind === 'descent' ? 'Descent' : 'Flat';
    for (let i = r.start; i <= r.end; i++) segs[i].label = `${name} ${counts[r.kind]}`;
  }
}
