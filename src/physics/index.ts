/**
 * Pure physics: no React, no DOM, no storage. Safe to run in a Web Worker or on a server later.
 */
export { PHYSICS } from './config';
export * from './types';
export { airDensity, pressureAtAltitude, temperatureAt } from './atmosphere';
export { resolveWind, crosswindCdaPenalty } from './wind';
export { effectiveCrr, idealPressureBar, pressureCrrFactor, surfaceCrrFactor } from './rolling';
export { riderCda, dragForce, bodySurfaceArea } from './aero';
export { powerAtSpeed, steadySpeed, gradeToAngle, resistiveForces, type PointConditions } from './power';
export { maxCornerSpeed, brakingDecel, roadGrip } from './cornering';
export { buildGeometry, routeProfile, totalClimbM, type ProfilePoint } from './route';
export { simulate, systemMass, routeCorners, speedEnvelope } from './simulate';
