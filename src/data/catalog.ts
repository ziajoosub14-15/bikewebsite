import type {
  BikeComponent,
  Category,
  ComponentByCategory,
  Frame,
  Groupset,
  Handlebars,
  RearDerailleur,
  Saddle,
  Tyres,
  Wheels,
} from '../types/components';
import frames from './components/frames.json';
import wheels from './components/wheels.json';
import groupsets from './components/groupsets.json';
import rearDerailleurs from './components/rearDerailleurs.json';
import handlebars from './components/handlebars.json';
import saddles from './components/saddles.json';
import tyres from './components/tyres.json';

/**
 * All parts, grouped by category. Swap this for an API call later without touching the UI:
 * everything else reads parts through `catalog`, `getComponent` and `listComponents`.
 */
export const catalog: { [K in Category]: ComponentByCategory[K][] } = {
  frame: frames as Frame[],
  wheels: wheels as Wheels[],
  groupset: groupsets as Groupset[],
  rearDerailleur: rearDerailleurs as RearDerailleur[],
  handlebars: handlebars as Handlebars[],
  saddle: saddles as Saddle[],
  tyres: tyres as Tyres[],
};

const byId = new Map<string, BikeComponent>();
for (const list of Object.values(catalog)) {
  for (const c of list as BikeComponent[]) byId.set(c.id, c);
}

export function listComponents<K extends Category>(category: K): ComponentByCategory[K][] {
  return catalog[category];
}

export function getComponent<K extends Category>(
  category: K,
  id: string,
): ComponentByCategory[K] | undefined {
  const c = byId.get(id);
  return c && c.category === category ? (c as ComponentByCategory[K]) : undefined;
}

export function allComponents(): BikeComponent[] {
  return [...byId.values()];
}
