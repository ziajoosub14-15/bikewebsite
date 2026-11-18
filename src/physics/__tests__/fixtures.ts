import type { BikePhysics, Environment, RiderPhysics, Route, RouteSegment } from '../types';

/** A typical ~8 kg carbon road bike with 28 mm race tyres and mid-depth wheels. */
export const roadBike: BikePhysics = {
  massKg: 8,
  cdaBike: 0.05,
  crrBase: 0.0032,
  tyreWidthMm: 28,
  tyrePressureBar: 5.5,
  tyreGrip: 0.95,
  drivetrainEfficiency: 0.97,
  brakeType: 'disc',
  wheelCrosswindSensitivity: 0.3,
  wheelMassKg: 2.0,
};

export const rider70: RiderPhysics = { massKg: 70, heightM: 1.78, powerW: 250, position: 'drops' };

export const calm: Environment = { temperatureC: 15, windSpeedMs: 0, windFromDeg: 0 };

export function flatRoute(lengthM = 20000, headingDeg = 0): Route {
  return {
    id: 'flat',
    name: 'Flat',
    startElevationM: 0,
    segments: [{ lengthM, gradePct: 0, headingDeg, surface: 'smooth' }],
  };
}

export function constantGrade(gradePct: number, lengthM = 5000): Route {
  return {
    id: `grade-${gradePct}`,
    name: `${gradePct}%`,
    startElevationM: gradePct < 0 ? 2000 : 0,
    segments: [{ lengthM, gradePct, headingDeg: 0, surface: 'smooth' }],
  };
}

/** Descent with hairpins every 400 m. */
export function hairpinDescent(): Route {
  const segments: RouteSegment[] = [];
  for (let i = 0; i < 8; i++) {
    segments.push({ lengthM: 400, gradePct: -8, headingDeg: i % 2 ? 180 : 0, surface: 'smooth', cornerRadiusM: 12 });
  }
  return { id: 'hairpins', name: 'Hairpins', startElevationM: 1500, segments };
}

export const kmh = (ms: number) => ms * 3.6;
