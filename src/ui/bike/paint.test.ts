import { describe, expect, it } from 'vitest';
import { getComponent } from '../../data/catalog';
import { resolveColourway, tubeSegments, tubeStripes } from './paint';

const v5 = getComponent('frame', 'frame-colnago-v5rs')!;

describe('paint', () => {
  it('defaults to the first official colourway, Team UAE for the V5Rs', () => {
    const cw = resolveColourway(v5, undefined, '#ff0000');
    expect(cw.name).toMatch(/UAE/);
  });
  it('custom paint is a solid colour', () => {
    const cw = resolveColourway(v5, 'custom', '#ff0000');
    expect(cw.base).toBe('#ff0000');
    expect(tubeSegments(cw, 'down', (t) => t)).toEqual([{ t0: 0, t1: 1, color: '#ff0000', finish: 'gloss' }]);
  });
  it('team block colours the front end', () => {
    const cw = resolveColourway(v5, 'uae', '#000000');
    expect(tubeSegments(cw, 'fork', (t) => t)[0].color).toBe(cw.accent);
    const top = tubeSegments(cw, 'top', (t) => t);
    expect(top[0].color).toBe(cw.base);
    expect(top[top.length - 1].color).toBe(cw.accent);
    expect(tubeSegments(cw, 'chainstay', (t) => t)[0].color).toBe(cw.base);
  });
  it('matte black with gloss top tube', () => {
    const cw = resolveColourway(v5, 'black', '#000000');
    expect(tubeSegments(cw, 'top', (t) => t)[0].finish).toBe('gloss');
    expect(tubeSegments(cw, 'down', (t) => t)[0].finish).toBe('matte');
  });
  it('world champion stripes go on the top tube, seat tube and fork', () => {
    const cw = resolveColourway(v5, 'world-champion', '#000000');
    expect(tubeStripes(cw, 'top')).toHaveLength(5);
    expect(tubeStripes(cw, 'fork')).toHaveLength(5);
    expect(tubeStripes(cw, 'down')).toHaveLength(0);
  });
  it('fades change colour from rear to front', () => {
    const sl8 = getComponent('frame', 'frame-sworks-tarmac-sl8')!;
    const cw = resolveColourway(sl8, 'cypress', '#000000');
    const segs = tubeSegments(cw, 'down', (t) => 0.4 + t * 0.4);
    expect(segs[0].color).not.toBe(segs[segs.length - 1].color);
  });
});
