import { describe, expect, it } from 'vitest';
import { checkCompatibility, issuesIfSwapped } from './compatibility';
import { PRESET_BUILDS } from './presets';
import type { BuildSelection } from '../types/components';

const base: BuildSelection = PRESET_BUILDS.colnagoUltegra.selection;
const ids = (sel: BuildSelection) => checkCompatibility(sel).map((i) => i.id);

describe('compatibility checker', () => {
  it('every preset build has no errors', () => {
    for (const [k, p] of Object.entries(PRESET_BUILDS)) {
      expect(checkCompatibility(p.selection).filter((i) => i.severity === 'error'), k).toEqual([]);
    }
  });

  it('rim-brake frame with disc wheels', () => {
    const r = ids({ ...base, frame: 'frame-colnago-c64-rim' });
    expect(r).toContain('brake-frame-wheels');
    expect(r).toContain('brake-frame-groupset');
    expect(r).toContain('axle');
  });

  it('mixing groupset brands', () => {
    expect(ids({ ...base, rearDerailleur: 'rd-sram-red-axs' })).toContain('brand-mix');
  });

  it('mismatched gear count', () => {
    expect(ids({ ...base, rearDerailleur: 'rd-shimano-105-r7000' })).toContain('speeds');
  });

  it('electronic shifters with a cable derailleur', () => {
    expect(ids({ ...base, rearDerailleur: 'rd-shimano-105-r7100' })).toContain('electronic');
  });

  it('derailleur that cannot wrap the largest cog', () => {
    // GRX cassette goes to 36T; the Ultegra Di2 derailleur only wraps 34T.
    const gravelWithRoadRd = { ...PRESET_BUILDS.gravel.selection, rearDerailleur: 'rd-shimano-ultegra-r8150' };
    expect(ids(gravelWithRoadRd)).toContain('max-cog');
    // 11-30 cassette on a 30T short cage is fine.
    const ok = { ...PRESET_BUILDS.rimClimber.selection, groupset: 'gs-shimano-105-r7000-rim' };
    expect(ids(ok)).not.toContain('max-cog');
  });

  it('tyre too wide for the frame clearance', () => {
    expect(ids({ ...base, tyres: 'ty-schwalbe-gone-bite-45' })).toContain('clearance');
    expect(ids({ ...base, tyres: 'ty-conti-gp5000as-32' })).toContain('clearance-tight');
  });

  it('tubular tyres on clincher rims and vice versa', () => {
    expect(ids({ ...base, tyres: 'ty-vittoria-corsa-tubular-25' })).toContain('tubular');
    expect(ids({ ...base, wheels: 'wheels-shimano-da-c50-tu' })).toContain('tubular');
  });

  it('integrated cockpit on an externally routed frame', () => {
    expect(ids({ ...base, frame: 'frame-sworks-aethos' })).toContain('routing');
  });

  it('narrow road tyre on wide gravel rim warns', () => {
    expect(ids({ ...PRESET_BUILDS.gravel.selection, tyres: 'ty-conti-gp5000str-25' })).toContain('rim-too-wide');
  });

  it('every issue explains itself in plain English', () => {
    const sel: BuildSelection = {
      frame: 'frame-java-siluro',
      wheels: 'wheels-zipp-super9-858',
      groupset: 'gs-sram-red-axs',
      rearDerailleur: 'rd-shimano-105-r7000',
      handlebars: 'hb-vision-metron-5d',
      saddle: 'sd-wtb-volt',
      tyres: 'ty-schwalbe-gone-bite-45',
    };
    const all = checkCompatibility(sel);
    expect(all.length).toBeGreaterThan(5);
    for (const i of all) expect(i.message.length).toBeGreaterThan(40);
    expect(all[0].severity).toBe('error');
  });

  it('issuesIfSwapped labels every problem the part would have in this build', () => {
    const rimBuild = { ...base, frame: 'frame-colnago-c64-rim' };
    // Another rim frame still clashes with the disc wheels.
    expect(issuesIfSwapped(rimBuild, 'frame', 'frame-sunpeed-zero').map((i) => i.id)).toContain('brake-frame-wheels');
    // Going back to a disc frame fixes it.
    expect(issuesIfSwapped(rimBuild, 'frame', 'frame-colnago-v4rs').filter((i) => i.severity === 'error')).toEqual([]);
    expect(issuesIfSwapped(base, 'wheels', 'wheels-shimano-r501').map((i) => i.id)).toContain('brake-frame-wheels');
    expect(issuesIfSwapped(base, 'wheels', 'wheels-zipp-404-firecrest')).toEqual([]);
  });
});
