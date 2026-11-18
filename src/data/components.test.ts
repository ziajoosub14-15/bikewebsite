import { describe, expect, it } from 'vitest';
import { allComponents, catalog } from './catalog';
import { CATEGORIES } from '../types/components';

/** Guards the JSON files: run `npm test` after adding parts. */
describe('component data', () => {
  it('has 8–50 options in every category', () => {
    for (const cat of CATEGORIES) {
      expect(catalog[cat].length, cat).toBeGreaterThanOrEqual(8);
      expect(catalog[cat].length, cat).toBeLessThanOrEqual(50);
    }
  });

  it('ids are unique', () => {
    const ids = allComponents().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every part sits in the file for its category and has sane values', () => {
    for (const cat of CATEGORIES) {
      for (const c of catalog[cat]) {
        const where = `${c.id}`;
        expect(c.category, where).toBe(cat);
        expect(c.name.length, where).toBeGreaterThanOrEqual(2);
        expect(c.brand.length, where).toBeGreaterThan(1);
        expect(c.description.length, where).toBeGreaterThan(10);
        expect(c.price, where).toBeGreaterThan(0);
        expect(c.weight, where).toBeGreaterThan(50);
        expect(c.weight, where).toBeLessThan(3000);
        expect(Math.abs(c.cdaDelta), where).toBeLessThanOrEqual(0.025);
        for (const score of [c.comfort, c.stiffness]) {
          expect(score, where).toBeGreaterThanOrEqual(1);
          expect(score, where).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('tyres have realistic Crr, pressure and grip', () => {
    for (const t of catalog.tyres) {
      expect(t.crr, t.id).toBeGreaterThan(0.002);
      expect(t.crr, t.id).toBeLessThan(0.008);
      expect(t.recommendedPressureBar, t.id).toBeGreaterThan(2);
      expect(t.recommendedPressureBar, t.id).toBeLessThan(8);
      expect(t.grip, t.id).toBeGreaterThan(0.7);
      expect(t.grip, t.id).toBeLessThanOrEqual(1);
    }
  });

  it('groupsets lose 2–4% in the drivetrain', () => {
    for (const g of catalog.groupset) {
      expect(g.drivetrainEfficiency, g.id).toBeGreaterThanOrEqual(0.96);
      expect(g.drivetrainEfficiency, g.id).toBeLessThanOrEqual(0.98);
    }
  });

  it('every frame has valid colourways; wheels and tyres have looks', () => {
    const hex = /^#[0-9a-f]{6}$/i;
    for (const f of catalog.frame) {
      expect(f.colourways.length, f.id).toBeGreaterThan(0);
      const ids = new Set<string>();
      for (const c of f.colourways) {
        expect(hex.test(c.base) && hex.test(c.decal), `${f.id}/${c.id}`).toBe(true);
        if (c.accent) expect(hex.test(c.accent)).toBe(true);
        if (['headBlock', 'rear', 'topTube', 'front', 'fade'].includes(c.pattern)) expect(c.accent, `${f.id}/${c.id} needs accent`).toBeDefined();
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
      }
    }
    for (const w of catalog.wheels) expect(hex.test(w.look.decalColor), w.id).toBe(true);
    for (const t of catalog.tyres) expect(['black', 'tan']).toContain(t.sidewall);
  });

  it('frames and wheels declare brake type and axle', () => {
    for (const p of [...catalog.frame, ...catalog.wheels]) {
      expect(p.compat.brakeType, p.id).toBeDefined();
      expect(p.compat.axle, p.id).toBeDefined();
    }
  });
});
