import { describe, expect, it } from 'vitest';
import { PRO_GHOSTS, runRace } from './race';
import { PRESET_BUILDS } from './presets';
import { DEFAULT_RIDER } from './rider';
import { DEFAULT_CONDITIONS } from './ride';
import { PRESET_ROUTES } from '../routes/presets';
import { checkCompatibility } from './compatibility';

const route = (id: string) => PRESET_ROUTES.find((r) => r.id === id)!;
const calm = { ...DEFAULT_CONDITIONS, windKmh: 0 };

describe('race mode', () => {
  it('ghost builds are all compatible', () => {
    for (const g of PRO_GHOSTS) expect(checkCompatibility(g.selection).filter((i) => i.severity === 'error'), g.id).toEqual([]);
  });

  it('places, gaps and splits are consistent', () => {
    const r = runRace(
      [
        { id: 'a', name: 'Budget', spec: { selection: PRESET_BUILDS.budgetAlloy.selection } },
        { id: 'b', name: 'Dream', spec: { selection: PRESET_BUILDS.sworksDuraAce.selection } },
      ],
      DEFAULT_RIDER,
      calm,
      route('rolling'),
    );
    const dream = r.entries.find((e) => e.entrant.id === 'b')!;
    expect(dream.place).toBe(1);
    expect(dream.gapS).toBe(0);
    const budget = r.entries.find((e) => e.entrant.id === 'a')!;
    expect(budget.gapS).toBeGreaterThan(60);
    expect(budget.splits).toHaveLength(r.sections.length);
    expect(budget.splits[budget.splits.length - 1]).toBeCloseTo(budget.sim.totalTimeS, 3);
    expect(r.reasons[0]).toMatch(/Dream beat Budget by/);
    expect(r.reasons.join(' ')).toMatch(/gained/);
  });

  it('on a flat TT the TT bike wins and drag is the reason', () => {
    const r = runRace(
      [
        { id: 'tt', name: 'TT', spec: { selection: PRO_GHOSTS[3].selection } },
        { id: 'climb', name: 'Climber', spec: { selection: PRO_GHOSTS[1].selection } },
      ],
      { ...DEFAULT_RIDER, position: 'aero' },
      calm,
      route('flat-tt'),
    );
    expect(r.entries.find((e) => e.place === 1)!.entrant.id).toBe('tt');
    expect(r.reasons.join(' ')).toMatch(/lower drag/);
  });

  it('on the steep alpine climb the climber beats the aero bike, citing weight', () => {
    const r = runRace(
      [
        { id: 'aero', name: 'Aero', spec: { selection: PRO_GHOSTS[0].selection } },
        { id: 'climb', name: 'Climber', spec: { selection: PRO_GHOSTS[1].selection } },
      ],
      DEFAULT_RIDER,
      calm,
      route('alpine'),
    );
    expect(r.entries.find((e) => e.place === 1)!.entrant.id).toBe('climb');
    expect(r.reasons.join(' ')).toMatch(/lighter bike/);
  });

  it('disc brakes beat rim brakes on the technical descent', () => {
    const r = runRace(
      [
        { id: 'rim', name: 'Rim', spec: { selection: PRESET_BUILDS.rimClimber.selection } },
        { id: 'disc', name: 'Disc', spec: { selection: PRESET_BUILDS.colnagoUltegra.selection } },
      ],
      DEFAULT_RIDER,
      calm,
      route('descent'),
    );
    expect(r.entries.find((e) => e.place === 1)!.entrant.id).toBe('disc');
  });
});
