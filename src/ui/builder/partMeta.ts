import { catalog } from '../../data/catalog';
import type { BikeComponent, Category } from '../../types/components';

export interface Meter {
  label: string;
  /** 0–10, relative to the other parts in the same category. */
  value: number;
}

function scale(cat: Category, pick: (c: BikeComponent) => number, higherIsBetter: boolean) {
  const vals = (catalog[cat] as BikeComponent[]).map(pick);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return (c: BikeComponent) => {
    if (max === min) return 5;
    const t = (pick(c) - min) / (max - min);
    return Math.round((higherIsBetter ? t : 1 - t) * 9 + 1);
  };
}

const aero = (cat: Category) => scale(cat, (c) => c.cdaDelta, false);
const light = (cat: Category) => scale(cat, (c) => c.weight, false);

/** Small bar meters on each card. Picked per category to show what matters for that part. */
export function metersFor(c: BikeComponent): Meter[] {
  switch (c.category) {
    case 'frame':
      return [
        { label: 'Aero', value: aero('frame')(c) },
        { label: 'Light', value: light('frame')(c) },
        { label: 'Comfort', value: c.comfort },
      ];
    case 'wheels':
      return [
        { label: 'Aero', value: aero('wheels')(c) },
        { label: 'Light', value: light('wheels')(c) },
        { label: 'Calm in wind', value: Math.round((1 - c.crosswindSensitivity) * 9 + 1) },
      ];
    case 'groupset':
      return [
        { label: 'Efficiency', value: scale('groupset', (x) => (x as typeof c).drivetrainEfficiency, true)(c) },
        { label: 'Light', value: light('groupset')(c) },
      ];
    case 'rearDerailleur':
      return [
        { label: 'Light', value: light('rearDerailleur')(c) },
        { label: 'Range', value: scale('rearDerailleur', (x) => (x as typeof c).maxCog, true)(c) },
      ];
    case 'handlebars':
      return [
        { label: 'Aero', value: aero('handlebars')(c) },
        { label: 'Comfort', value: c.comfort },
      ];
    case 'saddle':
      return [
        { label: 'Comfort', value: c.comfort },
        { label: 'Light', value: light('saddle')(c) },
      ];
    case 'tyres':
      return [
        { label: 'Fast rolling', value: scale('tyres', (x) => (x as typeof c).crr, false)(c) },
        { label: 'Grip', value: scale('tyres', (x) => (x as typeof c).grip, true)(c) },
        { label: 'Comfort', value: c.comfort },
      ];
  }
}

const TYPE: Record<string, string> = {
  aero: 'Aero',
  climbing: 'Climbing',
  endurance: 'Endurance',
  gravel: 'Gravel',
  tt: 'Time trial',
  standard: 'Standard drop',
  'aero-integrated': 'Integrated aero',
  'flared-gravel': 'Flared gravel',
  'tri-aero': 'Aero bars',
};

/** Short spec chips. */
export function factsFor(c: BikeComponent): string[] {
  switch (c.category) {
    case 'frame':
      return [c.range === 'top' ? 'Top model' : c.range === 'mid' ? 'Mid-range' : 'Entry', TYPE[c.frameType], c.compat.brakeType === 'rim' ? 'Rim brake' : 'Disc', `Tyres ≤ ${c.maxTyreWidthMm} mm`];
    case 'wheels':
      return [`${c.rimDepthMm} mm deep`, c.profile === 'disc' ? 'Rear disc' : c.rimType === 'tubular' ? 'Tubular' : 'Tubeless-ready', c.compat.brakeType === 'rim' ? 'Rim brake' : 'Disc'];
    case 'groupset':
      return [
        `${c.compat.speeds}-speed`,
        c.electronic ? 'Electronic' : 'Mechanical',
        `${c.chainrings.join('/')} · ${c.cassette[0]}-${c.cassette[1]}T`,
        c.compat.brakeType === 'rim' ? 'Rim brakes' : 'Hydraulic disc',
      ];
    case 'rearDerailleur':
      return [`${c.compat.speeds}-speed`, c.electronic ? 'Electronic' : 'Mechanical', `Up to ${c.maxCog}T`];
    case 'handlebars':
      return [TYPE[c.barType], c.positions.includes('aero') ? 'Aero position' : 'Hoods & drops', c.integratedStemMm ? `${c.integratedStemMm} mm stem` : 'Separate stem'];
    case 'saddle':
      return [`${c.widthMm} mm wide`, `${c.padding[0].toUpperCase()}${c.padding.slice(1)} padding`, c.cutout ? 'Cut-out' : 'Solid'];
    case 'tyres':
      return [`${c.widthMm} mm`, c.construction[0].toUpperCase() + c.construction.slice(1), `${c.recommendedPressureBar} bar`, `Crr ${c.crr.toFixed(4)}`];
  }
}
