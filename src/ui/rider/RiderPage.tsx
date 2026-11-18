import { useMemo } from 'react';
import { POSITION_LABEL, riderPowerW } from '../../domain/rider';
import { summarize } from '../../domain/summary';
import type { Position } from '../../physics/types';
import { useActiveBuild, useStore } from '../../state/store';
import { Card, NumberField, Segmented, Slider, Tile } from '../common';
import { ComfortPanel } from './ComfortPanel';
import { FitPanel } from './FitPanel';
import { GarageBar } from '../builder/BuilderPage';

export function RiderPage() {
  const { state, setRider } = useStore();
  const { build, update } = useActiveBuild();
  const r = state.rider;
  const s = useMemo(() => summarize(build, r), [build, r]);
  const bars = s.parts.handlebars;
  const power = riderPowerW(r);
  const positions: Position[] = ['hoods', 'drops', 'aero'];

  return (
    <div className="space-y-4">
      <GarageBar />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card title="Rider" subtitle="Your body and your engine. Used by every simulation and race.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField label="Weight" unit="kg" value={r.weightKg} min={35} max={150} step={0.5} onChange={(v) => setRider({ weightKg: v })} />
              <NumberField label="Height" unit="cm" value={r.heightCm} min={140} max={215} onChange={(v) => setRider({ heightCm: v })} />
              <NumberField label="Inseam (leg length)" unit="cm" value={r.inseamCm} min={60} max={105} onChange={(v) => setRider({ inseamCm: v })} />
              <NumberField label="Arm (shoulder–wrist)" unit="cm" value={r.armCm} min={40} max={80} onChange={(v) => setRider({ armCm: v })} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Inseam: stand barefoot against a wall with a book pressed up between your legs, and measure floor to the top of the book.</p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-4">
                <NumberField label="FTP (Functional Threshold Power)" unit="W" value={r.ftpW} min={80} max={500} step={5} onChange={(v) => setRider({ ftpW: v })} />
                <Slider
                  label="Ride at % of FTP"
                  value={r.ftpPct}
                  min={50}
                  max={120}
                  step={1}
                  unit="%"
                  onChange={(v) => setRider({ ftpPct: v })}
                  hint={r.ftpPct > 105 ? 'Above threshold: only sustainable for short efforts.' : r.ftpPct >= 95 ? 'About a one-hour all-out effort.' : r.ftpPct >= 75 ? 'Hard group-ride or race pace.' : 'Endurance pace, sustainable for hours.'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 self-start">
                <Tile label="Riding power" value={String(power)} unit="W" tone="brand" sub={`${r.ftpPct}% of ${r.ftpW} W FTP`} />
                <Tile label="Power to weight" value={(power / r.weightKg).toFixed(2)} unit="W/kg" sub={`FTP ${(r.ftpW / r.weightKg).toFixed(2)} W/kg`} />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-1.5 text-sm font-medium text-slate-700">Riding position</div>
              <Segmented
                label="Riding position"
                value={r.position}
                onChange={(p) => setRider({ position: p })}
                options={positions.map((p) => ({ value: p, label: POSITION_LABEL[p], title: bars.positions.includes(p) ? undefined : `Not possible with ${bars.brand} ${bars.name}` }))}
              />
              <p className="mt-2 text-xs text-slate-500">
                The rider makes up roughly 70–80% of total drag, so position matters more than any part. Your drag area now: <strong className="text-slate-700">{s.cdaTotal.toFixed(3)} m²</strong>.
                {s.rider.position !== r.position && (
                  <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                    {POSITION_LABEL[r.position]} isn’t possible with the {bars.brand} {bars.name}, so you’ll ride in the {POSITION_LABEL[s.rider.position].toLowerCase()} position. Choose aero bars in the builder to use it.
                  </span>
                )}
              </p>
            </div>
          </Card>

          <Card title={`Fit: ${s.parts.frame.brand} ${s.parts.frame.name}`} subtitle="Recommended frame size, saddle height and stem length from your measurements. A rule-of-thumb guide; a professional bike fit is more precise.">
            <FitPanel fit={s.fit} frame={s.parts.frame} chosen={build.frameSizeCm} onChoose={(size) => update({ frameSizeCm: size })} />
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Comfort ranking" subtitle={build.name}>
            <ComfortPanel score={s.comfort.score} factors={s.comfort.factors} />
          </Card>
          <Card title="Tyre pressure">
            <Slider
              label={`${s.parts.tyres.brand} ${s.parts.tyres.widthMm} mm`}
              value={s.tyrePressureBar}
              min={1.8}
              max={8.5}
              step={0.1}
              unit="bar"
              format={(v) => v.toFixed(1)}
              onChange={(v) => update({ tyrePressureBar: v })}
              hint={
                <>
                  Ideal for you on smooth roads: <strong>{s.idealPressureBar.toFixed(1)} bar</strong>. Lower is comfier; too low or too high costs speed.{' '}
                  {build.tyrePressureBar !== undefined && (
                    <button className="font-medium text-brand-700 underline" onClick={() => update({ tyrePressureBar: undefined })}>
                      Reset
                    </button>
                  )}
                </>
              }
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
