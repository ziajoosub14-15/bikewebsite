import { describe, expect, it } from 'vitest';
import { riderCda } from '../aero';
import { airDensity } from '../atmosphere';
import { powerAtSpeed, steadySpeed, type PointConditions } from '../power';
import { kmh, rider70, roadBike } from './fixtures';

function conditions(over: Partial<PointConditions> = {}): PointConditions {
  return {
    massKg: rider70.massKg + 1.2 + roadBike.massKg,
    gradePct: 0,
    crr: roadBike.crrBase,
    cda: riderCda('drops', 1.78, 70) + roadBike.cdaBike,
    rho: airDensity(15, 0),
    headwindMs: 0,
    drivetrainEfficiency: roadBike.drivetrainEfficiency,
    ...over,
  };
}

describe('power model', () => {
  it('BENCHMARK: 70 kg rider, 250 W, flat, no wind, drops ⇒ 36–40 km/h', () => {
    const v = kmh(steadySpeed(250, conditions()));
    expect(v).toBeGreaterThan(36);
    expect(v).toBeLessThan(40);
  });

  it('total CdA in the drops is about 0.30–0.32 m²', () => {
    const c = conditions();
    expect(c.cda).toBeGreaterThan(0.29);
    expect(c.cda).toBeLessThan(0.33);
  });

  it('aero bars are faster than drops, drops faster than hoods', () => {
    const at = (pos: 'hoods' | 'drops' | 'aero') =>
      steadySpeed(250, conditions({ cda: riderCda(pos, 1.78, 70) + roadBike.cdaBike }));
    expect(at('aero')).toBeGreaterThan(at('drops'));
    expect(at('drops')).toBeGreaterThan(at('hoods'));
  });

  it('on the flat, drag is the biggest cost (≈ 80–90%)', () => {
    const c = conditions();
    const p = powerAtSpeed(steadySpeed(250, c), c);
    const wheel = p.gravityW + p.rollingW + p.aeroW;
    expect(p.aeroW / wheel).toBeGreaterThan(0.8);
    expect(p.aeroW / wheel).toBeLessThan(0.92);
    expect(p.totalW).toBeCloseTo(250, 1);
  });

  it('250 W up an 8% climb ⇒ roughly 12–15 km/h, mostly fighting gravity', () => {
    const c = conditions({ gradePct: 8 });
    const v = steadySpeed(250, c);
    expect(kmh(v)).toBeGreaterThan(12);
    expect(kmh(v)).toBeLessThan(15);
    const p = powerAtSpeed(v, c);
    expect(p.gravityW / p.totalW).toBeGreaterThan(0.8);
  });

  it('a lighter bike matters on a climb but barely on the flat', () => {
    const climbGain = steadySpeed(250, conditions({ gradePct: 8, massKg: 77 })) / steadySpeed(250, conditions({ gradePct: 8 }));
    const flatGain = steadySpeed(250, conditions({ massKg: 77 })) / steadySpeed(250, conditions());
    expect(climbGain - 1).toBeGreaterThan((flatGain - 1) * 10);
  });

  it('headwind slows, tailwind speeds up', () => {
    const still = steadySpeed(250, conditions());
    expect(steadySpeed(250, conditions({ headwindMs: 4 }))).toBeLessThan(still);
    expect(steadySpeed(250, conditions({ headwindMs: -4 }))).toBeGreaterThan(still);
  });

  it('thin air at altitude is faster on the flat', () => {
    expect(steadySpeed(250, conditions({ rho: airDensity(15, 2000) }))).toBeGreaterThan(steadySpeed(250, conditions()));
  });

  it('coasting down a 6% hill reaches a realistic terminal speed (55–75 km/h)', () => {
    const v = kmh(steadySpeed(0, conditions({ gradePct: -6 })));
    expect(v).toBeGreaterThan(55);
    expect(v).toBeLessThan(75);
  });
});
