import type { Category } from '../types/components';

export const CATEGORY_LABEL: Record<Category, string> = {
  frame: 'Frame',
  wheels: 'Wheels',
  groupset: 'Groupset',
  rearDerailleur: 'Rear derailleur',
  handlebars: 'Handlebars',
  saddle: 'Saddle',
  tyres: 'Tyres',
};

export const CATEGORY_HINT: Record<Category, string> = {
  frame: 'The heart of the bike: sets the fit, the ride feel, brake type and how wide a tyre fits.',
  wheels: 'Deeper rims cut drag but weigh more and get pushed around by crosswinds.',
  groupset: 'Shifters, brakes, chainset and cassette. Higher tiers are lighter and waste less power.',
  rearDerailleur: 'Moves the chain across the rear cogs. Must match the groupset brand, gears and cassette size.',
  handlebars: 'Changes the positions you can ride in. Aero cockpits are faster; flared bars give control off-road.',
  saddle: 'Where comfort is won or lost on long rides.',
  tyres: 'The cheapest big speed upgrade. Width, casing and pressure change speed, grip and comfort.',
};

export const PAINTS = [
  { name: 'Racing teal', hex: '#0f9b7a' },
  { name: 'Rosso', hex: '#d1263b' },
  { name: 'Cobalt', hex: '#1f4fd1' },
  { name: 'Stealth', hex: '#1c2128' },
  { name: 'Sand', hex: '#c8a46a' },
  { name: 'Pearl', hex: '#eef0f2' },
  { name: 'Ultraviolet', hex: '#6d3fd6' },
  { name: 'Fluo', hex: '#e5ef3a' },
];
