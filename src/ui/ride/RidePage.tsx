import { useMemo, useState } from 'react';
import { runRide, timeAtDistance } from '../../domain/ride';
import { routeSections } from '../../routes/presets';
import { useActiveBuild, useStore } from '../../state/store';
import { ProfileChart } from '../charts/ProfileChart';
import { RideAnimation } from '../charts/RideAnimation';
import { Card, Slider, Tile } from '../common';
import { aed, duration } from '../format';
import { GarageBar } from '../builder/BuilderPage';
import { ConditionsPanel } from './ConditionsPanel';
import { sceneForRoute } from '../bike/backdrops';
import { RoutePicker } from './RoutePicker';
import { POSITION_LABEL } from '../../domain/rider';
import { isLightHex, resolveColourway } from '../bike/paint';
import { BackdropCanvas } from '../bike/BackdropCanvas';
import { BikeImage } from '../bike/BikeImage';

function EnergyBreakdown({ e }: { e: ReturnType<typeof runRide>['sim']['energy'] }) {
  const rows = [
    { label: 'Air resistance (drag)', j: Math.max(0, e.aeroJ) },
    { label: 'Climbing (gravity)', j: Math.max(0, e.gravityNetJ) },
    { label: 'Rolling resistance', j: e.rollingJ },
    { label: 'Braking (lost as heat)', j: e.brakingJ },
    { label: 'Drivetrain losses', j: e.drivetrainJ },
  ].filter((r) => r.j > 1);
  const total = rows.reduce((s, r) => s + r.j, 0);
  const max = Math.max(...rows.map((r) => r.j));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>
          You put in <strong className="tabular-nums">{Math.round(e.riderJ / 1000).toLocaleString('en-US')} kJ</strong>
        </span>
        <span className="text-slate-500">≈ {Math.round(e.riderJ / 1000).toLocaleString('en-US')} kcal burned (muscles are ~24% efficient)</span>
      </div>
      <ul className="space-y-2.5">
        {rows.sort((a, b) => b.j - a.j).map((r) => (
          <li key={r.label} title={`${r.label}: ${Math.round(r.j / 1000)} kJ`}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{r.label}</span>
              <span className="tabular-nums text-slate-600">
                {Math.round(r.j / 1000).toLocaleString('en-US')} kJ <span className="text-slate-400">· {Math.round((r.j / total) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-slate-700" style={{ width: `${(r.j / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {e.gravityNetJ < -1000 && <p className="mt-3 text-xs text-slate-500">The route ends {Math.round(-e.gravityNetJ / 1000)} kJ lower than it starts: gravity did that much of the work for you.</p>}
      {e.aeroJ < 0 && <p className="mt-3 text-xs text-slate-500">A tailwind pushed you along more than the air held you back.</p>}
    </div>
  );
}

export function RidePage() {
  const { state, route } = useStore();
  const { build, update } = useActiveBuild();
  const result = useMemo(() => runRide(build, state.rider, state.conditions, route), [build, state.rider, state.conditions, route]);
  const sections = useMemo(() => routeSections(route), [route]);
  const [markerM, setMarkerM] = useState<number | undefined>(undefined);
  const { sim, setup } = result;
  const t = sim.timeByTerrainS;
  const terrain = [
    { label: 'Climbing', s: t.climb },
    { label: 'Flat', s: t.flat },
    { label: 'Descending', s: t.descent },
  ];
  const series = useMemo(() => [{ name: build.name, color: '#2a78d6', sim }], [build.name, sim]);
  const cw = resolveColourway(setup.parts.frame, build.colourwayId, build.paint);
  const riderColor = isLightHex(cw.base) ? (cw.accent && !isLightHex(cw.accent) ? cw.accent : '#334155') : cw.base;
  const kit = cw.accent && !isLightHex(cw.accent) ? cw.accent : riderColor;
  const riders = useMemo(
    () => [{ name: build.name, color: kit, sim, bike: { parts: setup.parts, colourway: cw }, position: setup.rider.position }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [build.name, kit, sim, setup.parts, JSON.stringify(cw), setup.rider.position],
  );

  return (
    <div className="space-y-4">
      <GarageBar />
      <Card title="Route">
        <RoutePicker />
      </Card>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Conditions" subtitle="Wind is resolved into head/tail and crosswind for every bend of the route.">
            <ConditionsPanel />
          </Card>
          <Card title="Tyres">
            <Slider
              label={`${setup.parts.tyres.brand} ${setup.parts.tyres.widthMm} mm`}
              value={setup.tyrePressureBar}
              min={1.8}
              max={8.5}
              step={0.1}
              unit="bar"
              format={(v) => v.toFixed(1)}
              onChange={(v) => update({ tyrePressureBar: v })}
              hint={`Ideal on smooth roads for you: ${setup.idealPressureBar.toFixed(1)} bar. Drop it on rough roads and gravel.`}
            />
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:flex-row">
            <div className="relative overflow-hidden sm:w-[46%]">
              <BackdropCanvas id={state.backdrop} className="scale-110 blur-[3px]" />
              <div className="relative px-2 pt-2">
                <BikeImage parts={setup.parts} colourway={cw} width={900} />
              </div>
            </div>
            <div className="flex-1 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your bike</div>
              <div className="text-lg font-extrabold tracking-tight">{build.name}</div>
              <div className="text-xs text-slate-500">{cw.name}</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-slate-500">Frame</dt>
                <dd className="truncate">{setup.parts.frame.brand} {setup.parts.frame.name} · {setup.fit.sizeCm} cm</dd>
                <dt className="text-slate-500">Wheels</dt>
                <dd className="truncate">{setup.parts.wheels.brand} {setup.parts.wheels.name}</dd>
                <dt className="text-slate-500">Groupset</dt>
                <dd className="truncate">{setup.parts.groupset.brand} {setup.parts.groupset.name}</dd>
                <dt className="text-slate-500">Tyres</dt>
                <dd className="truncate">{setup.parts.tyres.brand} {setup.parts.tyres.widthMm} mm · {setup.tyrePressureBar.toFixed(1)} bar</dd>
                <dt className="text-slate-500">Weight</dt>
                <dd className="tabular-nums">{setup.weightKg.toFixed(2)} kg · {aed(setup.priceAed)}</dd>
              </dl>
              <a href="#/build" className="mt-2 inline-block text-sm font-medium text-brand-700 underline">Change parts</a>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Total time" value={duration(sim.totalTimeS)} tone="brand" sub={`${(sim.distanceM / 1000).toFixed(1)} km · ${route.name}`} />
            <Tile label="Avg speed" value={(sim.avgSpeedMs * 3.6).toFixed(1)} unit="km/h" sub={`avg power ${Math.round(sim.avgPowerW)} W`} />
            <Tile label="Max speed" value={(sim.maxSpeedMs * 3.6).toFixed(1)} unit="km/h" sub={`${sim.brakingPoints.length} braking points`} />
            <Tile label="Rider" value={String(setup.rider.powerW)} unit="W" sub={`${state.rider.weightKg} kg · ${POSITION_LABEL[setup.rider.position].toLowerCase()}`} />
          </div>

          <Card title="Elevation and speed" subtitle="Hover or drag along the chart to read the gradient and your speed at any point. Red bands are braking zones.">
            <ProfileChart route={route} series={series} showBraking markerM={markerM} />
          </Card>

          <Card title="Ride animation" subtitle="Side view, gradients exaggerated so you can see them. Watch the rider slow on climbs, coast and brake on descents.">
            <RideAnimation route={route} riders={riders} onPosition={setMarkerM} scene={sceneForRoute(route.id, state.backdrop)} height={340} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Where the energy went">
              <EnergyBreakdown e={sim.energy} />
            </Card>
            <Card title="Time by terrain">
              <ul className="space-y-2.5">
                {terrain.map((r) => (
                  <li key={r.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">{r.label}</span>
                      <span className="tabular-nums text-slate-600">
                        {duration(r.s)} <span className="text-slate-400">· {Math.round((r.s / sim.totalTimeS) * 100)}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-slate-100">
                      <div className="h-2.5 rounded-full bg-slate-700" style={{ width: `${(r.s / sim.totalTimeS) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">Climbing ≥ 2%, descending ≤ −2%.</p>
            </Card>
          </div>

          <Card title="Section times">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Section</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Length</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Avg grade</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Time</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Avg speed</th>
                    <th className="py-1.5 text-right font-semibold">Elapsed</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {sections.map((s) => {
                    const t0 = timeAtDistance(sim, s.startM);
                    const t1 = timeAtDistance(sim, s.endM);
                    return (
                      <tr key={s.label + s.startM} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3 font-medium">{s.label}</td>
                        <td className="py-1.5 pr-3 text-right">{((s.endM - s.startM) / 1000).toFixed(1)} km</td>
                        <td className="py-1.5 pr-3 text-right">{s.avgGradePct > 0 ? '+' : ''}{s.avgGradePct.toFixed(1)}%</td>
                        <td className="py-1.5 pr-3 text-right">{duration(t1 - t0)}</td>
                        <td className="py-1.5 pr-3 text-right">{(((s.endM - s.startM) / (t1 - t0)) * 3.6).toFixed(1)} km/h</td>
                        <td className="py-1.5 text-right text-slate-500">{duration(t1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {sim.brakingPoints.length > 0 && (
            <Card title="Braking points" subtitle={`${setup.parts.frame.compat.brakeType === 'disc' ? 'Disc' : 'Rim'} brakes, ${setup.parts.tyres.brand} ${setup.parts.tyres.name} grip. Corners are taken at the safe speed for their radius.`}>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {sim.brakingPoints.slice(0, 16).map((b, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 tabular-nums">
                    <span className="text-slate-600">km {(b.startDistM / 1000).toFixed(2)}</span>
                    <span>
                      {(b.fromSpeedMs * 3.6).toFixed(0)} → <strong>{(b.toSpeedMs * 3.6).toFixed(0)} km/h</strong>
                      <span className="text-slate-400"> · {Math.round(b.endDistM - b.startDistM)} m</span>
                    </span>
                  </li>
                ))}
              </ul>
              {sim.brakingPoints.length > 16 && <p className="mt-2 text-xs text-slate-500">…and {sim.brakingPoints.length - 16} more.</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
