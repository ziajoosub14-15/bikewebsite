import { describe, expect, it } from 'vitest';
import { airDensity, pressureAtAltitude, temperatureAt } from '../atmosphere';

describe('atmosphere', () => {
  it('sea level at 15 °C is about 1.225 kg/m³', () => {
    expect(airDensity(15, 0)).toBeCloseTo(1.225, 2);
  });
  it('pressure at 2000 m is about 79.5 kPa', () => {
    expect(pressureAtAltitude(2000) / 1000).toBeCloseTo(79.5, 0);
  });
  it('air is thinner when hot and when high', () => {
    expect(airDensity(40, 0)).toBeLessThan(airDensity(15, 0));
    expect(airDensity(15, 1900)).toBeLessThan(airDensity(15, 0));
    // Jebel Jais summit (~1900 m) on a 25 °C day: about 0.96
    expect(airDensity(25, 1900)).toBeGreaterThan(0.9);
    expect(airDensity(25, 1900)).toBeLessThan(1.0);
  });
  it('cools ~6.5 °C per 1000 m', () => {
    expect(temperatureAt(30, 0, 1000)).toBeCloseTo(23.5, 5);
  });
});
