import { riderCda } from '../physics/aero';
import type { Route } from '../physics/types';
import { routeSections, type RouteSection } from '../routes/presets';
import type { BuildSelection } from '../types/components';
import type { RiderProfile } from './rider';
import { runRide, timeAtDistance, type Conditions, type RideResult } from './ride';
import type { BuildSpec } from './setup';
import { systemMass } from '../physics/simulate';

export interface Entrant {
  id: string;
  name: string;
  spec: BuildSpec;
  /** Ghosts are generic pro-level builds; their brands are hidden in the race view. */
  ghost?: boolean;
}

export interface RaceEntryResult extends RideResult {
  entrant: Entrant;
  /** Time at the end of each section (s). */
  splits: number[];
  place: number;
  gapS: number;
}

export interface RaceResult {
  route: Route;
  sections: RouteSection[];
  entries: RaceEntryResult[];
  /** Plain-English reasons the winner beat each rival. */
  reasons: string[];
}

export function runRace(entrants: Entrant[], rider: RiderProfile, conditions: Conditions, route: Route): RaceResult {
  const sections = routeSections(route);
  const results = entrants.map((e) => {
    const r = runRide(e.spec, rider, conditions, route);
    return { ...r, entrant: e, splits: sections.map((s) => timeAtDistance(r.sim, s.endM)) };
  });
  const order = [...results].sort((a, b) => a.sim.totalTimeS - b.sim.totalTimeS);
  const best = order[0].sim.totalTimeS;
  const entries = results.map((r) => ({ ...r, place: order.indexOf(r) + 1, gapS: r.sim.totalTimeS - best }));
  const winner = entries.find((e) => e.place === 1)!;
  const reasons = entries
    .filter((e) => e !== winner)
    .sort((a, b) => a.place - b.place)
    .flatMap((loser) => explain(winner, loser, sections));
  return { route, sections, entries, reasons };
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

function sectionTimes(e: RaceEntryResult): number[] {
  return e.splits.map((t, i) => t - (i ? e.splits[i - 1] : 0));
}

/** Why did the winner beat this rival? Looks at the sections where the most time was won. */
export function explain(w: RaceEntryResult, l: RaceEntryResult, sections: RouteSection[]): string[] {
  const wt = sectionTimes(w);
  const lt = sectionTimes(l);
  const gains = sections.map((s, i) => ({ s, gain: lt[i] - wt[i] })).filter((g) => g.gain > 0.5);
  gains.sort((a, b) => b.gain - a.gain);
  const wb = w.setup;
  const lb = l.setup;
  const wMass = systemMass(wb.rider.massKg, wb.bike.massKg);
  const lMass = systemMass(lb.rider.massKg, lb.bike.massKg);
  const wCda = riderCda(wb.rider.position, wb.rider.heightM, wb.rider.massKg) + wb.bike.cdaBike;
  const lCda = riderCda(lb.rider.position, lb.rider.heightM, lb.rider.massKg) + lb.bike.cdaBike;

  const why = (s: RouteSection): string => {
    const bits: string[] = [];
    const dMass = lMass - wMass;
    const dCda = lCda - wCda;
    const dCrr = lb.bike.crrBase - wb.bike.crrBase;
    if (s.kind === 'climb') {
      if (dMass > 0.15) bits.push(`a ${dMass.toFixed(1)} kg lighter bike`);
      if (dCda > 0.004 && s.avgGradePct < 6) bits.push(`lower drag (CdA ${wCda.toFixed(3)} vs ${lCda.toFixed(3)})`);
      if (wb.bike.drivetrainEfficiency - lb.bike.drivetrainEfficiency > 0.003) bits.push('a more efficient drivetrain');
    } else if (s.kind === 'descent') {
      if (s.corners >= 2 && wb.bike.brakeType === 'disc' && lb.bike.brakeType === 'rim') bits.push('later, harder braking with disc brakes');
      if (s.corners >= 2 && wb.bike.tyreGrip - lb.bike.tyreGrip > 0.02) bits.push('grippier tyres through the corners');
      if (dCda > 0.003) bits.push(`lower drag (CdA ${wCda.toFixed(3)} vs ${lCda.toFixed(3)})`);
      if (!bits.length && dMass < -0.3) bits.push('extra weight pulling it downhill');
    } else {
      if (dCda > 0.003) bits.push(`lower drag (CdA ${wCda.toFixed(3)} vs ${lCda.toFixed(3)})`);
      if (dCrr > 0.0003) bits.push('faster-rolling tyres');
      if (wb.bike.wheelCrosswindSensitivity < lb.bike.wheelCrosswindSensitivity - 0.2) bits.push('wheels that stay calm in the crosswind');
    }
    if (!bits.length) {
      if (dCda > 0.002) bits.push('slightly lower drag');
      else if (dMass > 0.1) bits.push('slightly lower weight');
      else if (dCrr > 0) bits.push('slightly faster tyres');
      else bits.push('small gains in every area');
    }
    return bits.join(' and ');
  };

  const total = l.sim.totalTimeS - w.sim.totalTimeS;
  const out = [`${w.entrant.name} beat ${l.entrant.name} by ${fmt(total)}.`];
  for (const g of gains.slice(0, 2)) out.push(`${w.entrant.name} gained ${fmt(g.gain)} on ${g.s.label} from ${why(g.s)}.`);
  const lost = sections.map((s, i) => ({ s, loss: wt[i] - lt[i] })).filter((x) => x.loss > 2).sort((a, b) => b.loss - a.loss)[0];
  if (lost) out.push(`${l.entrant.name} fought back ${fmt(lost.loss)} on ${lost.s.label}.`);
  return out;
}

/** Generic pro-level ghost builds. Shown without brand names. */
export const PRO_GHOSTS: { id: string; name: string; blurb: string; selection: BuildSelection }[] = [
  {
    id: 'ghost-aero',
    name: 'Pro Aero Racer',
    blurb: 'Aero frame, 58 mm wheels, top 12-speed electronic, fast tubeless tyres',
    selection: {
      frame: 'frame-cervelo-s5',
      wheels: 'wheels-zipp-404-firecrest',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-vision-metron-5d',
      saddle: 'sd-sworks-power-mirror',
      tyres: 'ty-vittoria-corsa-pro-28',
    },
  },
  {
    id: 'ghost-climber',
    name: 'Pro Climber',
    blurb: 'Featherweight frame and 33 mm wheels, top-tier wireless groupset',
    selection: {
      frame: 'frame-sworks-aethos',
      wheels: 'wheels-roval-alpinist',
      groupset: 'gs-sram-red-axs',
      rearDerailleur: 'rd-sram-red-axs',
      handlebars: 'hb-zipp-sl70-aero',
      saddle: 'sd-selle-italia-slr',
      tyres: 'ty-vittoria-corsa-pro-28',
    },
  },
  {
    id: 'ghost-allround',
    name: 'Pro All-Rounder',
    blurb: 'Light aero all-rounder, 51/60 mm wheels, integrated cockpit',
    selection: {
      frame: 'frame-sworks-tarmac-sl8',
      wheels: 'wheels-roval-rapide',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-roval-rapide-cockpit',
      saddle: 'sd-sworks-power-mirror',
      tyres: 'ty-conti-gp5000str-28',
    },
  },
  {
    id: 'ghost-tt',
    name: 'Pro TT Machine',
    blurb: 'Time-trial frame, rear disc wheel, aero bars, TT tyres',
    selection: {
      frame: 'frame-cervelo-p5',
      wheels: 'wheels-zipp-super9-858',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-vision-metron-tfe',
      saddle: 'sd-ism-pn31',
      tyres: 'ty-conti-gp5000tt-25',
    },
  },
];
