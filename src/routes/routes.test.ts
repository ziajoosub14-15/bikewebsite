import { describe, expect, it } from 'vitest';
import { PRESET_ROUTES, routeSections } from './presets';
import { gpxToRoute, haversineM, parseGpxPoints } from './gpx';
import { buildGeometry, simulate, totalClimbM } from '../physics';
import { bikePhysics, resolveBuild } from '../domain/bikeModel';
import { PRESET_BUILDS } from '../domain/presets';

const r = (id: string) => PRESET_ROUTES.find((x) => x.id === id)!;
const bike = bikePhysics(resolveBuild(PRESET_BUILDS.colnagoUltegra.selection));
const rider = { massKg: 70, heightM: 1.78, powerW: 250, position: 'drops' as const };
const env = { temperatureC: 25, windSpeedMs: 0, windFromDeg: 0 };

describe('preset routes', () => {
  it('have the advertised length and climbing', () => {
    expect(buildGeometry(r('flat-tt')).totalM).toBeCloseTo(40000, -1);
    const jj = r('jebel-jais');
    expect(buildGeometry(jj).totalM / 1000).toBeCloseTo(23.5, 0);
    const climbOnly = jj.segments.filter((s) => s.label !== 'Approach');
    const rise = climbOnly.reduce((a, s) => a + (s.lengthM * s.gradePct) / 100, 0);
    expect(rise / 20500).toBeGreaterThan(0.05);
    expect(rise / 20500).toBeLessThan(0.06);
    const alp = r('alpine');
    expect(alp.segments.filter((s) => s.cornerRadiusM).length).toBe(21);
    expect(totalClimbM(alp)).toBeGreaterThan(1050);
    expect(r('descent').segments.every((s) => s.gradePct < 0)).toBe(true);
  });

  it('sections group by label with sensible kinds', () => {
    const secs = routeSections(r('rolling'));
    expect(secs.map((s) => s.label)).toContain('Climb 1');
    expect(secs.find((s) => s.label === 'Climb 1')!.kind).toBe('climb');
    expect(secs.find((s) => s.label === 'Descent 1')!.kind).toBe('descent');
    expect(secs[secs.length - 1].endM).toBeCloseTo(buildGeometry(r('rolling')).totalM, 3);
  });

  it('realistic ride times at 250 W', () => {
    const t = (id: string) => simulate({ bike, rider, env, route: r(id) }).totalTimeS / 60;
    expect(t('flat-tt')).toBeGreaterThan(60); // ~38 km/h → ~63 min
    expect(t('flat-tt')).toBeLessThan(68);
    expect(t('jebel-jais')).toBeGreaterThan(65); // 20 km at 5.4% ≈ 70–80 min
    expect(t('jebel-jais')).toBeLessThan(90);
    expect(t('alpine')).toBeGreaterThan(55); // 13.8 km at 8% ≈ 60–70 min
    expect(t('alpine')).toBeLessThan(75);
    const desc = simulate({ bike, rider, env, route: r('descent'), startSpeedMs: 10 });
    expect(desc.brakingPoints.length).toBeGreaterThan(8);
  });
});

function syntheticGpx(): string {
  // 3 km north at 6% then 2 km east, flat, with a 90° corner.
  const pts: string[] = [];
  const lat0 = 25.0;
  const lon0 = 56.0;
  for (let i = 0; i <= 300; i++) pts.push(`<trkpt lat="${lat0 + (i * 10) / 111195}" lon="${lon0}"><ele>${100 + i * 0.6}</ele></trkpt>`);
  const latEnd = lat0 + 3000 / 111195;
  const mPerDegLon = 111195 * Math.cos((latEnd * Math.PI) / 180);
  for (let i = 1; i <= 200; i++) pts.push(`<trkpt lat="${latEnd}" lon="${lon0 + (i * 10) / mPerDegLon}"><ele>280</ele></trkpt>`);
  return `<?xml version="1.0"?><gpx><trk><name>Test climb</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}

describe('GPX import', () => {
  it('parses points', () => {
    const pts = parseGpxPoints(syntheticGpx());
    expect(pts.length).toBe(501);
    expect(haversineM(pts[0], pts[1])).toBeCloseTo(10, 0);
  });

  it('builds a route with distance, gradient, heading, corners and sections', () => {
    const route = gpxToRoute(syntheticGpx(), 'gpx-1');
    expect(route.name).toBe('Test climb');
    const total = buildGeometry(route).totalM;
    expect(total).toBeGreaterThan(4800);
    expect(total).toBeLessThan(5050);
    const climb = route.segments.slice(5, 50);
    expect(climb.every((s) => Math.abs(s.gradePct - 6) < 0.5)).toBe(true);
    expect(Math.abs(climb[0].headingDeg - 0) < 2 || Math.abs(climb[0].headingDeg - 360) < 2).toBe(true);
    expect(route.segments[route.segments.length - 1].headingDeg).toBeCloseTo(90, -1);
    expect(route.segments.some((s) => s.cornerRadiusM)).toBe(true);
    const labels = new Set(route.segments.map((s) => s.label));
    expect(labels.has('Climb 1')).toBe(true);
    expect(labels.has('Flat 1')).toBe(true);
    expect(simulate({ bike, rider, env, route }).totalTimeS).toBeGreaterThan(400);
  });

  it('rejects files without a track', () => {
    expect(() => gpxToRoute('<gpx></gpx>', 'x')).toThrow(/No track points/);
  });
});
