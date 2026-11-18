import { describe, expect, it } from 'vitest';
import { crosswindCdaPenalty, resolveWind } from '../wind';

describe('wind', () => {
  it('riding north into a north wind is a full headwind', () => {
    expect(resolveWind(5, 0, 0)).toEqual({ headwindMs: 5, crosswindMs: 0 });
  });
  it('riding north with a south wind is a full tailwind', () => {
    const w = resolveWind(5, 180, 0);
    expect(w.headwindMs).toBeCloseTo(-5, 9);
    expect(w.crosswindMs).toBe(0);
  });
  it('an east wind is a pure crosswind when riding north', () => {
    const w = resolveWind(5, 90, 0);
    expect(w.headwindMs).toBe(0);
    expect(w.crosswindMs).toBeCloseTo(5, 9);
  });
  it('a wind at 45° splits evenly', () => {
    const w = resolveWind(10, 45, 0);
    expect(w.headwindMs).toBeCloseTo(7.071, 2);
    expect(w.crosswindMs).toBeCloseTo(7.071, 2);
  });
  it('deep wheels pay a crosswind penalty, shallow ones barely do', () => {
    expect(crosswindCdaPenalty(1.5, 1)).toBe(0);
    expect(crosswindCdaPenalty(8, 0.8)).toBeGreaterThan(crosswindCdaPenalty(8, 0.1) * 5);
  });
});
