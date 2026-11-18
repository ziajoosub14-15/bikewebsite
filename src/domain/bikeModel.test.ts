import { describe, expect, it } from 'vitest';
import { bikePhysics, buildTotals, resolveBuild } from './bikeModel';
import { PRESET_BUILDS } from './presets';
import { simulate, steadySpeed, riderCda, airDensity, systemMass } from '../physics';
import type { RiderPhysics, Route } from '../physics';

const rider: RiderPhysics = { massKg: 70, heightM: 1.78, powerW: 250, position: 'drops' };
const flat: Route = {
  id: 'flat',
  name: 'flat',
  startElevationM: 0,
  segments: [{ lengthM: 20000, gradePct: 0, headingDeg: 0, surface: 'smooth' }],
};

describe('bike model from catalog parts', () => {
  it('preset builds have realistic weight and price', () => {
    for (const [key, p] of Object.entries(PRESET_BUILDS)) {
      const t = buildTotals(resolveBuild(p.selection));
      expect(t.weightKg, key).toBeGreaterThan(5.8);
      expect(t.weightKg, key).toBeLessThan(11);
      expect(t.priceAed, key).toBeGreaterThan(3000);
    }
  });

  it('BENCHMARK with real parts: road bikes at 250 W in the drops do 36–40 km/h on the flat', () => {
    for (const key of ['allRoundRace', 'colnagoUltegra', 'sunpeedTiagra', 'rimClimber'] as const) {
      const bike = bikePhysics(resolveBuild(PRESET_BUILDS[key].selection));
      const r = simulate({ bike, rider, env: { temperatureC: 15, windSpeedMs: 0, windFromDeg: 0 }, route: flat });
      const kmh = r.avgSpeedMs * 3.6;
      expect(kmh, key).toBeGreaterThan(36);
      expect(kmh, key).toBeLessThan(40);
    }
  });

  it('a budget bike with heavy wheels and cheap tyres is slower (34–38 km/h)', () => {
    const bike = bikePhysics(resolveBuild(PRESET_BUILDS.budgetAlloy.selection));
    const r = simulate({ bike, rider, env: { temperatureC: 15, windSpeedMs: 0, windFromDeg: 0 }, route: flat });
    expect(r.avgSpeedMs * 3.6).toBeGreaterThan(34);
    expect(r.avgSpeedMs * 3.6).toBeLessThan(38);
  });

  it('the TT bike in the aero position is clearly faster (≈ 42–46 km/h)', () => {
    const bike = bikePhysics(resolveBuild(PRESET_BUILDS.timeTrial.selection));
    const v =
      steadySpeed(250, {
        massKg: systemMass(70, bike.massKg),
        gradePct: 0,
        crr: bike.crrBase,
        cda: riderCda('aero', 1.78, 70) + bike.cdaBike,
        rho: airDensity(15, 0),
        headwindMs: 0,
        drivetrainEfficiency: bike.drivetrainEfficiency,
      }) * 3.6;
    expect(v).toBeGreaterThan(42);
    expect(v).toBeLessThan(46);
  });

  it('throws a clear error for an unknown part id', () => {
    expect(() => resolveBuild({ ...PRESET_BUILDS.gravel.selection, frame: 'nope' })).toThrow(/Unknown frame/);
  });
});
