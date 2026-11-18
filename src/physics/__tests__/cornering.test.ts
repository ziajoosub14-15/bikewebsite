import { describe, expect, it } from 'vitest';
import { brakingDecel, maxCornerSpeed } from '../cornering';
import { kmh } from './fixtures';

describe('cornering and braking', () => {
  it('a 12 m hairpin is taken at roughly 25–32 km/h on dry tarmac', () => {
    const v = kmh(maxCornerSpeed(12, 0.95, 'smooth'));
    expect(v).toBeGreaterThan(25);
    expect(v).toBeLessThan(32);
  });
  it('wider corners and grippier surfaces allow more speed', () => {
    expect(maxCornerSpeed(50, 0.95, 'smooth')).toBeGreaterThan(maxCornerSpeed(12, 0.95, 'smooth'));
    expect(maxCornerSpeed(20, 0.95, 'gravel')).toBeLessThan(maxCornerSpeed(20, 0.95, 'smooth'));
  });
  it('disc brakes stop harder than rim brakes', () => {
    expect(brakingDecel('disc', 0.95, 'smooth')).toBeGreaterThan(brakingDecel('rim', 0.95, 'smooth'));
  });
  it('on gravel the tyres, not the brakes, are the limit', () => {
    expect(brakingDecel('disc', 0.85, 'gravel')).toBeCloseTo(brakingDecel('rim', 0.85, 'gravel'), 6);
  });
});
