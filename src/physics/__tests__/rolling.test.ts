import { describe, expect, it } from 'vitest';
import { effectiveCrr, idealPressureBar, surfaceCrrFactor } from '../rolling';

describe('rolling resistance', () => {
  it('ideal pressure falls as tyres get wider', () => {
    const p25 = idealPressureBar(25, 80, 'smooth');
    const p28 = idealPressureBar(28, 80, 'smooth');
    const p45 = idealPressureBar(45, 80, 'smooth');
    expect(p25).toBeGreaterThan(p28);
    expect(p28).toBeGreaterThan(p45);
    expect(p28).toBeGreaterThan(5);
    expect(p28).toBeLessThan(6.2);
  });
  it('rougher surfaces roll slower', () => {
    const base = { crrBase: 0.003, widthMm: 28, pressureBar: 5.5, systemMassKg: 80 };
    const smooth = effectiveCrr({ ...base, surface: 'smooth' });
    const rough = effectiveCrr({ ...base, surface: 'rough' });
    const gravel = effectiveCrr({ ...base, surface: 'gravel' });
    expect(rough).toBeGreaterThan(smooth);
    expect(gravel).toBeGreaterThan(rough);
  });
  it('wide tyres suffer less on gravel', () => {
    expect(surfaceCrrFactor('gravel', 45)).toBeLessThan(surfaceCrrFactor('gravel', 28));
  });
  it('the ideal pressure gives the lowest Crr', () => {
    const ideal = idealPressureBar(28, 80, 'rough');
    const at = (p: number) =>
      effectiveCrr({ crrBase: 0.003, widthMm: 28, pressureBar: p, systemMassKg: 80, surface: 'rough' });
    expect(at(ideal)).toBeLessThan(at(ideal * 0.75));
    expect(at(ideal)).toBeLessThan(at(ideal * 1.3));
  });
  it('over-inflating hurts much more on gravel than on smooth tarmac', () => {
    const over = (surface: 'smooth' | 'gravel') => {
      const ideal = idealPressureBar(32, 80, surface);
      const base = { crrBase: 0.0035, widthMm: 32, systemMassKg: 80, surface };
      return effectiveCrr({ ...base, pressureBar: ideal * 1.4 }) / effectiveCrr({ ...base, pressureBar: ideal });
    };
    expect(over('gravel')).toBeGreaterThan(over('smooth'));
  });
});
