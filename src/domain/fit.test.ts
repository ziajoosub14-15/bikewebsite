import { describe, expect, it } from 'vitest';
import { fitRider } from './fit';
import { getComponent } from '../data/catalog';
import { DEFAULT_RIDER } from './rider';

const frame = getComponent('frame', 'frame-colnago-v4rs')!;
const bars = getComponent('handlebars', 'hb-zipp-sc70')!;
const integrated = getComponent('handlebars', 'hb-vision-metron-5d')!;

describe('fit calculator', () => {
  it('a 178 cm rider with an 83 cm inseam gets a 56 cm race frame, ~733 mm saddle height and a 100–130 mm stem', () => {
    const f = fitRider(DEFAULT_RIDER, frame, bars);
    expect(f.sizeCm).toBe(56);
    expect(f.saddleHeightMm).toBeCloseTo(733, -1);
    expect(f.stemFittedMm).toBeGreaterThanOrEqual(100);
    expect(f.stemFittedMm).toBeLessThanOrEqual(130);
    expect(f.quality).toBeGreaterThan(8);
    expect(f.notes[0].severity).toBe('ok');
  });

  it('a short rider gets a small frame', () => {
    const f = fitRider({ ...DEFAULT_RIDER, heightCm: 160, inseamCm: 73, armCm: 54 }, frame, bars);
    expect(f.sizeCm).toBe(49);
  });

  it('flags a frame that is far too big', () => {
    const f = fitRider({ ...DEFAULT_RIDER, heightCm: 160, inseamCm: 73, armCm: 54 }, frame, bars, 61);
    expect(f.notes.some((n) => n.severity === 'bad')).toBe(true);
    expect(f.quality).toBeLessThan(4);
  });

  it('long arms need a longer stem', () => {
    const shortArms = fitRider({ ...DEFAULT_RIDER, armCm: 55 }, frame, bars);
    const longArms = fitRider({ ...DEFAULT_RIDER, armCm: 68 }, frame, bars);
    expect(longArms.stemNeededMm).toBeGreaterThan(shortArms.stemNeededMm + 30);
  });

  it('warns when an integrated cockpit has the wrong stem length', () => {
    const f = fitRider({ ...DEFAULT_RIDER, armCm: 52 }, frame, integrated);
    expect(f.notes.some((n) => n.text.includes('one-piece cockpit'))).toBe(true);
  });
});
