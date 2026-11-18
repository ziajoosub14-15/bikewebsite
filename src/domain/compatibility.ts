import type { BuildSelection, Category } from '../types/components';
import { resolveBuild, type ResolvedBuild } from './bikeModel';
import { catalog, getComponent } from '../data/catalog';

export type Severity = 'error' | 'warning';

export interface CompatIssue {
  /** Stable id so the UI can key and dedupe issues. */
  id: string;
  severity: Severity;
  /** The parts involved; the builder highlights these. */
  categories: Category[];
  title: string;
  /** Plain-English explanation of why it matters and how to fix it. */
  message: string;
}

type Rule = (b: ResolvedBuild) => CompatIssue | null;

const brakeName = (t?: string) => (t === 'rim' ? 'rim brakes' : 'disc brakes');
const axleName = (a?: string) => (a === 'qr' ? 'quick-release (QR) axles' : '12 mm thru-axles');
const label = (p: { brand: string; name: string }) => `${p.brand} ${p.name}`;

/**
 * Every rule looks at the whole build and returns one issue or null.
 * To add a rule, push a function here and add a test in compatibility.test.ts.
 */
const RULES: Rule[] = [
  // Brakes: frame vs wheels
  (b) =>
    b.frame.compat.brakeType !== b.wheels.compat.brakeType
      ? {
          id: 'brake-frame-wheels',
          severity: 'error',
          categories: ['frame', 'wheels'],
          title: 'Wheels and frame use different brakes',
          message: `The ${label(b.frame)} is built for ${brakeName(b.frame.compat.brakeType)}, but the ${label(
            b.wheels,
          )} are made for ${brakeName(b.wheels.compat.brakeType)}. ${
            b.frame.compat.brakeType === 'rim'
              ? 'Disc wheels have no braking surface on the rim and need rotor mounts the frame does not have.'
              : 'Rim-brake wheels have no rotor mounts, and a disc frame has nowhere to fit rim calipers.'
          } Choose ${brakeName(b.frame.compat.brakeType)} wheels.`,
        }
      : null,
  // Brakes: frame vs groupset
  (b) =>
    b.frame.compat.brakeType !== b.groupset.compat.brakeType
      ? {
          id: 'brake-frame-groupset',
          severity: 'error',
          categories: ['frame', 'groupset'],
          title: 'Groupset brakes don’t suit this frame',
          message: `The ${label(b.groupset)} comes with ${brakeName(b.groupset.compat.brakeType)}, but the ${label(
            b.frame,
          )} only takes ${brakeName(b.frame.compat.brakeType)}. Pick the ${
            b.frame.compat.brakeType === 'rim' ? 'rim-brake' : 'disc'
          } version of a groupset.`,
        }
      : null,
  // Axle standard
  (b) =>
    b.frame.compat.axle !== b.wheels.compat.axle
      ? {
          id: 'axle',
          severity: 'error',
          categories: ['frame', 'wheels'],
          title: 'Wrong axle standard',
          message: `The frame uses ${axleName(b.frame.compat.axle)} but the wheels have hubs for ${axleName(
            b.wheels.compat.axle,
          )}. The wheels will not lock into the dropouts.`,
        }
      : null,
  // Mixing brands
  (b) =>
    b.groupset.compat.brand !== b.rearDerailleur.compat.brand
      ? {
          id: 'brand-mix',
          severity: 'error',
          categories: ['groupset', 'rearDerailleur'],
          title: 'Mixing groupset brands',
          message: `${b.groupset.compat.brand} shifters can’t control a ${b.rearDerailleur.compat.brand} derailleur: each brand moves the derailleur by a different amount per click (or uses its own wireless protocol). Use a ${b.groupset.compat.brand} rear derailleur.`,
        }
      : null,
  // Gear count
  (b) =>
    b.groupset.compat.speeds !== b.rearDerailleur.compat.speeds
      ? {
          id: 'speeds',
          severity: 'error',
          categories: ['groupset', 'rearDerailleur'],
          title: 'Different number of gears',
          message: `The groupset is ${b.groupset.compat.speeds}-speed but the derailleur is ${b.rearDerailleur.compat.speeds}-speed. It won’t line up with the cogs, so shifting will skip and rattle. Pick a ${b.groupset.compat.speeds}-speed derailleur.`,
        }
      : null,
  // Electronic vs mechanical
  (b) =>
    b.groupset.electronic !== b.rearDerailleur.electronic
      ? {
          id: 'electronic',
          severity: 'error',
          categories: ['groupset', 'rearDerailleur'],
          title: b.groupset.electronic ? 'Electronic shifters, cable derailleur' : 'Cable shifters, electronic derailleur',
          message: b.groupset.electronic
            ? 'The shifters send electronic signals, but this derailleur is moved by a cable. Choose the electronic (Di2 / AXS / Wireless) derailleur.'
            : 'The shifters pull a cable, but this derailleur is motor-driven and needs electronic shifters. Choose a mechanical derailleur.',
        }
      : null,
  // Derailleur capacity
  (b) =>
    b.groupset.cassette[1] > b.rearDerailleur.maxCog
      ? {
          id: 'max-cog',
          severity: 'error',
          categories: ['groupset', 'rearDerailleur'],
          title: 'Cassette too big for the derailleur',
          message: `The cassette’s largest cog has ${b.groupset.cassette[1]} teeth, but this derailleur can only wrap up to ${b.rearDerailleur.maxCog}. The derailleur would hit the cog in the easiest gear. Choose a longer-cage derailleur.`,
        }
      : null,
  // Tyre clearance
  (b) => {
    const over = b.tyres.widthMm - b.frame.maxTyreWidthMm;
    if (over > 0)
      return {
        id: 'clearance',
        severity: 'error',
        categories: ['frame', 'tyres'],
        title: 'Tyres too wide for the frame',
        message: `${b.tyres.widthMm} mm tyres won’t fit: the ${label(b.frame)} clears up to ${b.frame.maxTyreWidthMm} mm. They would rub the frame or fork, and mud makes it worse. Choose ${b.frame.maxTyreWidthMm} mm or narrower.`,
      };
    if (over === 0)
      return {
        id: 'clearance-tight',
        severity: 'warning',
        categories: ['frame', 'tyres'],
        title: 'Tyres at the frame’s limit',
        message: `${b.tyres.widthMm} mm is the widest this frame takes. Tyres often measure 1–2 mm wider on modern rims, so check the fit before riding in wet or dirty conditions.`,
      };
    return null;
  },
  // Tubular vs clincher
  (b) => {
    const tubRim = b.wheels.rimType === 'tubular';
    const tubTyre = b.tyres.construction === 'tubular';
    if (tubRim === tubTyre) return null;
    return {
      id: 'tubular',
      severity: 'error',
      categories: ['wheels', 'tyres'],
      title: tubRim ? 'Tubular rims need tubular tyres' : 'Tubular tyres need tubular rims',
      message: tubRim
        ? 'These rims have no hook or bead seat: the tyre is glued on. Choose a tubular tyre, or clincher/tubeless wheels.'
        : 'A tubular tyre is sewn closed and glued onto a special rim. It can’t be mounted on clincher or tubeless rims.',
    };
  },
  // Tyre / rim width ratio
  (b) => {
    const inner = b.wheels.internalWidthMm;
    if (!inner || b.tyres.construction === 'tubular') return null;
    const ratio = b.tyres.widthMm / inner;
    if (ratio < 1.1)
      return {
        id: 'rim-too-wide',
        severity: 'warning',
        categories: ['wheels', 'tyres'],
        title: 'Rim is wide for this tyre',
        message: `A ${b.tyres.widthMm} mm tyre on a ${inner} mm internal rim gets stretched flat, leaving the rim exposed to impacts. Many tyre makers won’t approve it. Choose a wider tyre.`,
      };
    if (ratio > 2.6)
      return {
        id: 'rim-too-narrow',
        severity: 'warning',
        categories: ['wheels', 'tyres'],
        title: 'Rim is narrow for this tyre',
        message: `A ${b.tyres.widthMm} mm tyre on a ${inner} mm internal rim balloons into a light-bulb shape and feels squirmy in corners at low pressure. Choose wider rims.`,
      };
    return null;
  },
  // Integrated cockpit needs internal routing
  (b) =>
    b.handlebars.barType === 'aero-integrated' && !b.frame.internalRouting
      ? {
          id: 'routing',
          severity: 'error',
          categories: ['frame', 'handlebars'],
          title: 'Integrated cockpit needs internal routing',
          message: `The ${label(b.handlebars)} hides the cables inside the bar and feeds them into the frame through the headset. The ${label(b.frame)} routes cables outside, so they have nowhere to go. Choose a standard bar and stem.`,
        }
      : null,
  // Proprietary cockpits
  (b) =>
    b.frame.requiresBars && !b.frame.requiresBars.includes(b.handlebars.id)
      ? {
          id: 'frame-needs-cockpit',
          severity: 'error',
          categories: ['frame', 'handlebars'],
          title: 'This frame needs its own cockpit',
          message: `The ${label(b.frame)} only works with its own integrated cockpit (${b.frame.requiresBars
            .map((id) => {
              const bar = getComponent('handlebars', id);
              return bar ? label(bar) : id;
            })
            .join(' or ')}). Its steerer and head tube are shaped for it, so normal bars and stems won't fit.`,
        }
      : null,
  (b) =>
    b.handlebars.fitsFrames && !b.handlebars.fitsFrames.includes(b.frame.id)
      ? {
          id: 'cockpit-for-other-frame',
          severity: 'error',
          categories: ['frame', 'handlebars'],
          title: 'Cockpit made for a different frame',
          message: `The ${label(b.handlebars)} is made only for the ${b.handlebars.fitsFrames
            .map((id) => {
              const f = getComponent('frame', id);
              return f ? label(f) : id;
            })
            .join(', ')}. It won't mount on the ${label(b.frame)}.`,
        }
      : null,
  // TT frame with no aero bars
  (b) =>
    b.frame.frameType === 'tt' && !b.handlebars.positions.includes('aero')
      ? {
          id: 'tt-no-aerobars',
          severity: 'warning',
          categories: ['frame', 'handlebars'],
          title: 'TT frame without aero bars',
          message: 'Time-trial frames have a steep seat angle meant for riding on aero extensions. With ordinary drop bars you lose most of the speed advantage and the fit feels cramped.',
        }
      : null,
  // Gravel gearing on a road race bike is fine; knobbly tyres on an aero/TT frame are a hint, not an error.
  (b) =>
    b.tyres.tread === 'knob' && (b.frame.frameType === 'aero' || b.frame.frameType === 'tt')
      ? {
          id: 'knobby-on-aero',
          severity: 'warning',
          categories: ['frame', 'tyres'],
          title: 'Off-road tyres on a race frame',
          message: 'Knobbly gravel tyres roll slowly on tarmac and undo the aero frame’s advantage.',
        }
      : null,
];

/** All problems with a build, errors first. */
export function checkCompatibility(sel: BuildSelection): CompatIssue[] {
  const b = resolveBuild(sel);
  const issues = RULES.map((r) => r(b)).filter((x): x is CompatIssue => x !== null);
  return issues.sort((a, c) => (a.severity === c.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export function hasErrors(issues: CompatIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/**
 * What would be wrong if the user picked this part, keeping everything else? Returns the issues
 * that involve this category, so the builder can label each option.
 */
export function issuesIfSwapped(sel: BuildSelection, category: Category, id: string): CompatIssue[] {
  if (!getComponent(category, id)) return [];
  return checkCompatibility({ ...sel, [category]: id }).filter((i) => i.categories.includes(category));
}

/**
 * The rear derailleur to pair with a groupset: same model family when possible (Dura-Ace with Dura-Ace),
 * otherwise the cheapest one that is fully compatible.
 */
export function matchingDerailleur(sel: BuildSelection, groupsetId: string): string | null {
  const gs = getComponent('groupset', groupsetId);
  if (!gs) return null;
  const family = gs.name.split(' ')[0].toLowerCase();
  const ok = catalog.rearDerailleur.filter((rd) => {
    const cand = { ...sel, groupset: groupsetId, rearDerailleur: rd.id };
    // Only derailleur rules matter here (brake type etc. belong to the groupset choice itself).
    return !checkCompatibility(cand).some((i) => i.severity === 'error' && i.categories.includes('rearDerailleur'));
  });
  const same = ok.filter((rd) => rd.name.toLowerCase().startsWith(family) || rd.name.toLowerCase().includes(` ${family}`));
  const pick = (same.length ? same : ok).sort((a, b) => a.price - b.price)[0];
  return pick?.id ?? null;
}

/** Quick check used by auto-build: can this bar go on this frame at all? */
export function barFitsFrame(bar: { id: string; barType: string; fitsFrames?: string[] }, frame: { id: string; internalRouting: boolean; requiresBars?: string[] }): boolean {
  if (frame.requiresBars && !frame.requiresBars.includes(bar.id)) return false;
  if (bar.fitsFrames && !bar.fitsFrames.includes(frame.id)) return false;
  if (bar.barType === 'aero-integrated' && !frame.internalRouting) return false;
  return true;
}
