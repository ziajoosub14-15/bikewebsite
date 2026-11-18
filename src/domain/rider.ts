import type { Position, RiderPhysics } from '../physics/types';
import type { Handlebars } from '../types/components';

export interface RiderProfile {
  weightKg: number;
  heightCm: number;
  /** Floor to crotch, barefoot (cm). */
  inseamCm: number;
  /** Shoulder to wrist (cm). */
  armCm: number;
  /** Functional Threshold Power: watts the rider can hold for about an hour. */
  ftpW: number;
  /** Ride at this % of FTP. 100% ≈ a one-hour all-out effort. */
  ftpPct: number;
  /** Preferred riding position. Falls back if the handlebars can't do it. */
  position: Position;
}

export const DEFAULT_RIDER: RiderProfile = {
  weightKg: 70,
  heightCm: 178,
  inseamCm: 83,
  armCm: 61,
  ftpW: 250,
  ftpPct: 100,
  position: 'drops',
};

export const POSITION_LABEL: Record<Position, string> = {
  hoods: 'Upright / hoods',
  drops: 'Drops',
  aero: 'Aero bars',
};

const FALLBACK: Record<Position, Position[]> = {
  aero: ['aero', 'drops', 'hoods'],
  drops: ['drops', 'aero', 'hoods'],
  hoods: ['hoods', 'drops', 'aero'],
};

/** The position the rider can actually use with these handlebars. */
export function effectivePosition(wanted: Position, bars: Handlebars): Position {
  return FALLBACK[wanted].find((p) => bars.positions.includes(p)) ?? 'hoods';
}

export function riderPowerW(r: RiderProfile): number {
  return Math.round((r.ftpW * r.ftpPct) / 100);
}

export function riderPhysics(r: RiderProfile, bars: Handlebars): RiderPhysics {
  return {
    massKg: r.weightKg,
    heightM: r.heightCm / 100,
    powerW: riderPowerW(r),
    position: effectivePosition(r.position, bars),
  };
}
