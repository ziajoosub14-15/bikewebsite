import { describe, expect, it } from 'vitest';
import { simulate } from '../simulate';
import type { SimInput } from '../types';
import { calm, constantGrade, flatRoute, hairpinDescent, kmh, rider70, roadBike } from './fixtures';

const base = (over: Partial<SimInput> = {}): SimInput => ({
  bike: roadBike,
  rider: rider70,
  env: calm,
  route: flatRoute(),
  startSpeedMs: 0,
  ...over,
});

function energyBalanceError(input: SimInput): number {
  const r = simulate(input);
  const e = r.energy;
  const sinks = e.drivetrainJ + e.rollingJ + e.aeroJ + e.gravityNetJ + e.brakingJ + e.kineticNetJ;
  // Compare against the biggest energy flow (rider may do no work at all on a descent).
  const scale = Math.max(e.riderJ, Math.abs(e.gravityNetJ));
  return Math.abs(e.riderJ - sinks) / scale;
}

describe('time-step simulation', () => {
  it('BENCHMARK: 20 km flat TT at 250 W averages 36–40 km/h', () => {
    const r = simulate(base());
    expect(kmh(r.avgSpeedMs)).toBeGreaterThan(36);
    expect(kmh(r.avgSpeedMs)).toBeLessThan(40);
    expect(r.distanceM).toBeCloseTo(20000, 3);
    expect(r.timedOut).toBe(false);
  });

  it('a standing start takes time to reach cruising speed', () => {
    const r = simulate(base());
    const at5s = r.samples.find((s) => s.t >= 5)!;
    expect(kmh(at5s.speedMs)).toBeLessThan(30);
    expect(kmh(at5s.speedMs)).toBeGreaterThan(10);
  });

  it('energy in = energy out (within 1%) on flat, climb, and technical descent', () => {
    expect(energyBalanceError(base())).toBeLessThan(0.01);
    expect(energyBalanceError(base({ route: constantGrade(7) }))).toBeLessThan(0.01);
    expect(energyBalanceError(base({ route: hairpinDescent(), startSpeedMs: 8 }))).toBeLessThan(0.01);
  });

  it('carries momentum: a short dip into a rise is faster than flat-only pacing predicts', () => {
    const route = {
      id: 'dip',
      name: 'dip',
      startElevationM: 100,
      segments: [
        { lengthM: 2000, gradePct: 0, headingDeg: 0, surface: 'smooth' as const },
        { lengthM: 300, gradePct: -5, headingDeg: 0, surface: 'smooth' as const },
        { lengthM: 300, gradePct: 5, headingDeg: 0, surface: 'smooth' as const },
      ],
    };
    const r = simulate(base({ route }));
    // Speed at the bottom of the dip is above flat cruising speed.
    const bottom = r.samples.find((s) => s.distM >= 2300)!;
    const cruise = r.samples.find((s) => s.distM >= 1900)!;
    expect(bottom.speedMs).toBeGreaterThan(cruise.speedMs + 2);
  });

  it('brakes before hairpins and never exceeds the corner limit', () => {
    const r = simulate(base({ route: hairpinDescent(), startSpeedMs: 8 }));
    expect(r.corners).toHaveLength(8);
    expect(r.brakingPoints.length).toBeGreaterThanOrEqual(7);
    for (const c of r.corners) {
      const at = r.samples.find((s) => s.distM >= c.distM);
      if (at) expect(at.speedMs).toBeLessThanOrEqual(c.maxSafeSpeedMs + 0.5);
    }
    // Braking starts before each corner, not after.
    for (const b of r.brakingPoints) expect(b.startDistM).toBeLessThan(b.endDistM + 1);
    expect(r.energy.brakingJ).toBeGreaterThan(0);
  });

  it('disc brakes are faster than rim brakes on a technical descent', () => {
    const disc = simulate(base({ route: hairpinDescent(), startSpeedMs: 8 }));
    const rim = simulate(base({ route: hairpinDescent(), startSpeedMs: 8, bike: { ...roadBike, brakeType: 'rim' } }));
    expect(disc.totalTimeS).toBeLessThan(rim.totalTimeS);
  });

  it('coasts on steep descents', () => {
    const r = simulate(base({ route: constantGrade(-8), startSpeedMs: 10 }));
    const later = r.samples.filter((s) => s.t > 30);
    expect(later.every((s) => s.coasting && s.powerW === 0)).toBe(true);
    expect(kmh(r.maxSpeedMs)).toBeGreaterThan(60);
    expect(kmh(r.maxSpeedMs)).toBeLessThan(85);
  });

  it('time is split between climb, flat and descent', () => {
    const route = {
      id: 'mix',
      name: 'mix',
      startElevationM: 0,
      segments: [
        { lengthM: 2000, gradePct: 0, headingDeg: 0, surface: 'smooth' as const },
        { lengthM: 2000, gradePct: 6, headingDeg: 0, surface: 'smooth' as const },
        { lengthM: 2000, gradePct: -6, headingDeg: 0, surface: 'smooth' as const },
      ],
    };
    const r = simulate(base({ route }));
    const t = r.timeByTerrainS;
    expect(t.climb).toBeGreaterThan(t.flat);
    expect(t.flat).toBeGreaterThan(t.descent);
    expect(t.climb + t.flat + t.descent).toBeCloseTo(r.totalTimeS, 6);
  });

  it('headwind out and tailwind back is slower overall than no wind', () => {
    const outBack = {
      id: 'ob',
      name: 'ob',
      startElevationM: 0,
      segments: [
        { lengthM: 10000, gradePct: 0, headingDeg: 0, surface: 'smooth' as const },
        { lengthM: 10000, gradePct: 0, headingDeg: 180, surface: 'smooth' as const },
      ],
    };
    const still = simulate(base({ route: outBack }));
    const windy = simulate(base({ route: outBack, env: { ...calm, windSpeedMs: 5, windFromDeg: 0 } }));
    expect(windy.totalTimeS).toBeGreaterThan(still.totalTimeS);
  });

  it('deep wheels lose time in a strong crosswind', () => {
    const cross = { ...calm, windSpeedMs: 9, windFromDeg: 90 };
    const shallow = simulate(base({ env: cross, bike: { ...roadBike, wheelCrosswindSensitivity: 0.05 } }));
    const deep = simulate(base({ env: cross, bike: { ...roadBike, wheelCrosswindSensitivity: 1 } }));
    expect(deep.totalTimeS).toBeGreaterThan(shallow.totalTimeS);
  });

  it('gravel is much slower than tarmac, and wide tyres help there', () => {
    const tarmac = simulate(base());
    const gravel = simulate(base({ env: { ...calm, surfaceOverride: 'gravel' } }));
    expect(gravel.totalTimeS).toBeGreaterThan(tarmac.totalTimeS * 1.05);
    const wide = simulate(
      base({
        env: { ...calm, surfaceOverride: 'gravel' },
        bike: { ...roadBike, tyreWidthMm: 45, tyrePressureBar: 2.6, crrBase: 0.0045 },
      }),
    );
    expect(wide.totalTimeS).toBeLessThan(gravel.totalTimeS);
  });
});

describe('route lookup', () => {
  it('finds segments forwards, backwards and at random', async () => {
    const { buildGeometry } = await import('../route');
    const route = {
      id: 'r',
      name: 'r',
      startElevationM: 0,
      segments: Array.from({ length: 500 }, () => ({ lengthM: 10, gradePct: 0, headingDeg: 0, surface: 'smooth' as const })),
    };
    const g = buildGeometry(route);
    expect(g.segmentAt(0)).toBe(0);
    expect(g.segmentAt(4999)).toBe(499);
    expect(g.segmentAt(1234)).toBe(123);
    expect(g.segmentAt(1240)).toBe(124);
    expect(g.segmentAt(5)).toBe(0);
    expect(g.segmentAt(2500)).toBe(250);
  });
});
