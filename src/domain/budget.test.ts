import { describe, expect, it } from 'vitest';
import { autoBuild } from './autobuild';
import { suggestUpgrades } from './upgrades';
import { weightVsAero } from './weightVsAero';
import { PRESET_BUILDS } from './presets';
import { DEFAULT_RIDER } from './rider';
import { DEFAULT_CONDITIONS } from './ride';
import { PRESET_ROUTES } from '../routes/presets';
import { checkCompatibility } from './compatibility';
import { buildTotals, resolveBuild } from './bikeModel';

const route = (id: string) => PRESET_ROUTES.find((r) => r.id === id)!;
const calm = { ...DEFAULT_CONDITIONS, windKmh: 0 };

describe('auto-build', () => {
  it('stays within budget and is fully compatible', () => {
    for (const budget of [8000, 20000, 45000]) {
      const r = autoBuild(budget, 'allround', DEFAULT_RIDER, calm, route('rolling'))!;
      expect(r, String(budget)).not.toBeNull();
      expect(r.priceAed).toBeLessThanOrEqual(budget);
      expect(buildTotals(resolveBuild(r.selection)).priceAed).toBe(r.priceAed);
      expect(checkCompatibility(r.selection).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('more budget buys a faster bike', () => {
    const cheap = autoBuild(8000, 'flat', DEFAULT_RIDER, calm, route('flat-tt'))!;
    const rich = autoBuild(45000, 'flat', DEFAULT_RIDER, calm, route('flat-tt'))!;
    expect(rich.timeS).toBeLessThan(cheap.timeS - 30);
  });

  it('climbing priority on the alpine route picks a lighter bike than flat priority on the TT', () => {
    const climb = autoBuild(40000, 'climbing', DEFAULT_RIDER, calm, route('alpine'))!;
    const flat = autoBuild(40000, 'flat', DEFAULT_RIDER, calm, route('flat-tt'))!;
    expect(buildTotals(resolveBuild(climb.selection)).weightKg).toBeLessThan(buildTotals(resolveBuild(flat.selection)).weightKg);
    expect(buildTotals(resolveBuild(flat.selection)).cdaBike).toBeLessThan(buildTotals(resolveBuild(climb.selection)).cdaBike);
  });

  it('comfort priority gives a comfier bike', () => {
    const comfy = autoBuild(25000, 'comfort', { ...DEFAULT_RIDER, position: 'hoods' }, calm, route('rolling'))!;
    const fast = autoBuild(25000, 'flat', { ...DEFAULT_RIDER, position: 'hoods' }, calm, route('rolling'))!;
    expect(comfy.comfort).toBeGreaterThan(fast.comfort);
  });

  it('returns null when nothing fits the budget', () => {
    expect(autoBuild(1000, 'allround', DEFAULT_RIDER, calm, route('rolling'))).toBeNull();
  });
});

describe('upgrade suggestions', () => {
  it('ranks real time savings for a budget bike, with free changes', () => {
    const r = suggestUpgrades({ selection: PRESET_BUILDS.budgetAlloy.selection, tyrePressureBar: 7.5 }, DEFAULT_RIDER, calm, route('flat-tt'));
    expect(r.upgrades.length).toBeGreaterThan(3);
    for (const u of r.upgrades) expect(u.secondsSaved).toBeGreaterThan(0);
    // Tyres are the classic best-value upgrade on a budget bike.
    expect(r.upgrades.slice(0, 3).some((u) => u.detail === 'Tyres')).toBe(true);
    // Sorted by value
    const finite = r.upgrades.filter((u) => isFinite(u.secPer100));
    for (let i = 1; i < finite.length; i++) expect(finite[i - 1].secPer100).toBeGreaterThanOrEqual(finite[i].secPer100);
    expect(r.free.some((f) => f.title.includes('bar'))).toBe(true);
  });

  it('suggests the aero position when the bars allow it', () => {
    const sel = { ...PRESET_BUILDS.colnagoUltegra.selection, handlebars: 'hb-profile-clipons' };
    const r = suggestUpgrades({ selection: sel }, { ...DEFAULT_RIDER, position: 'hoods' }, calm, route('flat-tt'));
    expect(r.free[0].riderChange?.position).toBe('aero');
  });
});

describe('weight vs aero', () => {
  it('finds a crossover gradient where the light bike starts winning', () => {
    const r = weightVsAero({ selection: PRESET_BUILDS.colnagoUltegra.selection }, DEFAULT_RIDER);
    expect(r.light.massKg).toBeLessThan(r.aero.massKg);
    expect(r.aero.cda).toBeLessThan(r.light.cda);
    expect(r.points[0].diffSPerKm).toBeLessThan(0); // aero wins on the flat
    expect(r.crossoverPct).not.toBeNull();
    expect(r.crossoverPct!).toBeGreaterThan(2);
    expect(r.crossoverPct!).toBeLessThan(12);
  });

  it('a stronger rider needs a steeper hill before light wins', () => {
    const weak = weightVsAero({ selection: PRESET_BUILDS.colnagoUltegra.selection }, { ...DEFAULT_RIDER, ftpW: 180 }).crossoverPct!;
    const strong = weightVsAero({ selection: PRESET_BUILDS.colnagoUltegra.selection }, { ...DEFAULT_RIDER, ftpW: 380 }).crossoverPct!;
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('auto-build sanity', () => {
  it('all-round on a road route picks a road frame, and drivetrains use same-family derailleurs', async () => {
    const { matchingDerailleur } = await import('./compatibility');
    const r = autoBuild(15000, 'allround', DEFAULT_RIDER, calm, route('rolling'))!;
    expect(resolveBuild(r.selection).frame.frameType).not.toBe('gravel');
    const sel = PRESET_BUILDS.colnagoUltegra.selection;
    expect(matchingDerailleur(sel, 'gs-shimano-da-di2')).toBe('rd-shimano-da-r9250');
    expect(matchingDerailleur(sel, 'gs-shimano-105-r7100')).toBe('rd-shimano-105-r7100');
    expect(matchingDerailleur(sel, 'gs-sram-force-axs')).toBe('rd-sram-force-axs');
  });
});
