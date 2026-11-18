import { describe, expect, it } from 'vitest';
import { summarize } from './summary';
import { PRESET_BUILDS } from './presets';
import { DEFAULT_RIDER } from './rider';

const sum = (k: keyof typeof PRESET_BUILDS, rider = DEFAULT_RIDER) => summarize({ selection: PRESET_BUILDS[k].selection }, rider);

describe('build summary', () => {
  it('Colnago V4Rs + Ultegra Di2 adds up', () => {
    const s = sum('colnagoUltegra');
    expect(s.priceAed).toBe(s.byCategory.reduce((a, c) => a + c.priceAed, 0));
    expect(s.weightKg).toBeGreaterThan(6.5);
    expect(s.weightKg).toBeLessThan(8);
    expect(s.cdaTotal).toBeGreaterThan(0.28);
    expect(s.cdaTotal).toBeLessThan(0.31);
    expect(s.issues).toEqual([]);
    expect(s.comfort.score).toBeGreaterThan(4);
    expect(s.comfort.score).toBeLessThan(9);
  });

  it('gravel builds are more comfortable than TT builds', () => {
    const tt = summarize({ selection: PRESET_BUILDS.timeTrial.selection }, { ...DEFAULT_RIDER, position: 'aero' }).comfort.score;
    const gravel = sum('gravel', { ...DEFAULT_RIDER, position: 'hoods' }).comfort.score;
    expect(gravel).toBeGreaterThan(tt + 2);
  });

  it('the aero dream build is faster on the flat than the budget build', () => {
    expect(sum('sworksDuraAce').flatSpeedMs).toBeGreaterThan(sum('budgetAlloy').flatSpeedMs + 0.4);
  });

  it('asking for aero position on road bars falls back to the drops', () => {
    const s = sum('colnagoUltegra', { ...DEFAULT_RIDER, position: 'aero' });
    expect(s.rider.position).toBe('drops');
    const tt = summarize({ selection: PRESET_BUILDS.timeTrial.selection }, { ...DEFAULT_RIDER, position: 'drops' });
    expect(tt.rider.position).toBe('aero'); // TT bar has no drops
  });

  it('rider power follows FTP × %', () => {
    const s = sum('colnagoUltegra', { ...DEFAULT_RIDER, ftpW: 300, ftpPct: 80 });
    expect(s.rider.powerW).toBe(240);
  });

  it('softer tyres feel more comfortable', () => {
    const hard = summarize({ selection: PRESET_BUILDS.colnagoUltegra.selection, tyrePressureBar: 7 }, DEFAULT_RIDER);
    const soft = summarize({ selection: PRESET_BUILDS.colnagoUltegra.selection, tyrePressureBar: 4.5 }, DEFAULT_RIDER);
    expect(soft.comfort.factors.find((f) => f.key === 'tyres')!.score).toBeGreaterThan(hard.comfort.factors.find((f) => f.key === 'tyres')!.score);
  });
});
