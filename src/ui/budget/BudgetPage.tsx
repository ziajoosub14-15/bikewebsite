import { useMemo, useState } from 'react';
import { PRIORITY_LABEL, type AutoBuildResult, type Priority } from '../../domain/autobuild';
import { resolveBuild } from '../../domain/bikeModel';
import type { Upgrade } from '../../domain/upgrades';
import { weightVsAero } from '../../domain/weightVsAero';
import { makeBuild, useActiveBuild, useStore } from '../../state/store';
import { CATEGORIES } from '../../types/components';
import { runJob } from '../../workers/client';
import { BikeImage } from '../bike/BikeImage';
import { GarageBar } from '../builder/BuilderPage';
import { Card, NumberField, Segmented, Slider, Spinner, Tile } from '../common';
import { aed, duration } from '../format';
import { CATEGORY_LABEL, PAINTS } from '../labels';
import { RoutePicker } from '../ride/RoutePicker';
import { WeightAeroChart } from './WeightAeroChart';
import { resolveColourway } from '../bike/paint';
import { runRide } from '../../domain/ride';

function AutoBuild() {
  const { state, route, addBuild } = useStore();
  const [budget, setBudget] = useState(15000);
  const [priority, setPriority] = useState<Priority>('allround');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AutoBuildResult | null | 'none'>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const go = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const r = await runJob({ kind: 'autobuild', args: [budget, priority, state.rider, state.conditions, route] });
      setResult(r ?? 'none');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  const parts = result && result !== 'none' ? resolveBuild(result.selection) : null;

  return (
    <Card title="Auto-build" subtitle="Set a budget and what matters most. The app tries every compatible combination of parts and picks the best for the route.">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-[140px_1fr] items-end gap-3">
            <NumberField label="Budget" unit="AED" value={budget} min={3000} max={200000} step={500} onChange={setBudget} />
            <Slider label="" value={Math.min(budget, 80000)} min={3000} max={80000} step={500} onChange={setBudget} format={(v) => aed(v)} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Priority</div>
            <Segmented size="sm" label="Priority" value={priority} onChange={setPriority} options={(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">For this route</div>
            <RoutePicker compact />
          </div>
          <button onClick={go} disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
            {busy ? 'Searching…' : 'Find the best build'}
          </button>
          {busy && <Spinner label="Scoring thousands of combinations…" />}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
        <div className="min-w-0">
          {result === 'none' && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nothing complete fits {aed(budget)}. Try a bigger budget.</p>}
          {parts && result && result !== 'none' && (
            <div className="rounded-2xl border border-slate-200 bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_0%,#f1f5f9_70%)] p-3">
              <BikeImage parts={parts} colourway={resolveColourway(parts.frame, undefined, PAINTS[0].hex)} width={900} />
              <div className="mt-1 grid grid-cols-3 gap-2">
                <Tile label="Price" value={Math.round(result.priceAed).toLocaleString('en-US')} unit="AED" sub={`${aed(budget - result.priceAed)} left`} />
                <Tile label="Time" value={duration(result.timeS)} sub={route.name} />
                <Tile label="Comfort" value={result.comfort.toFixed(1)} unit="/10" />
              </div>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {CATEGORIES.map((c) => (
                  <li key={c} className="flex justify-between gap-3 py-1.5">
                    <span className="text-slate-500">{CATEGORY_LABEL[c]}</span>
                    <span className="text-right">
                      <span className="font-medium">{parts[c].brand}</span> {parts[c].name} <span className="tabular-nums text-slate-500">· {aed(parts[c].price)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{result.evaluated.toLocaleString('en-US')} combinations scored</span>
                <button
                  onClick={() => {
                    addBuild(makeBuild(`Auto ${PRIORITY_LABEL[priority].toLowerCase()} · ${Math.round(budget / 1000)}k`, result.selection, PAINTS[0].hex));
                    setSaved(true);
                  }}
                  disabled={saved}
                  className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saved ? 'Saved to My builds ✓' : 'Save as new build'}
                </button>
              </div>
            </div>
          )}
          {!result && !busy && (
            <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Your best bike for the budget will appear here.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Suggestions() {
  const { state, route, setRider } = useStore();
  const { build, update } = useActiveBuild();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ key: string; baselineS: number; upgrades: Upgrade[]; free: Upgrade[] } | null>(null);
  const key = JSON.stringify([build.selection, build.tyrePressureBar, state.rider, state.conditions, route.id]);
  const stale = data && data.key !== key;

  const go = async () => {
    setBusy(true);
    try {
      const r = await runJob({ kind: 'upgrades', args: [build, state.rider, state.conditions, route, 10] });
      setData({ key, ...r });
    } finally {
      setBusy(false);
    }
  };
  const apply = (u: Upgrade) => {
    if (u.riderChange) setRider(u.riderChange);
    if (u.specChange) update(u.specChange);
    if (Object.keys(u.change).length) update({ selection: { ...build.selection, ...u.change }, tyrePressureBar: u.change.tyres ? undefined : build.tyrePressureBar });
  };

  return (
    <Card
      title="Suggested changes"
      subtitle={`For “${build.name}” on ${route.name}. Every compatible swap is simulated; ranked by seconds saved per 100 AED.`}
      actions={
        <button onClick={go} disabled={busy} className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
          {busy ? 'Simulating…' : data ? 'Recalculate' : 'Find upgrades'}
        </button>
      }
    >
      {busy && <Spinner label="Simulating every compatible swap…" />}
      {stale && !busy && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">The build or conditions changed. Recalculate to update.</p>}
      {data && !busy && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Free changes</h3>
            {data.free.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing free left: position and tyre pressure are already optimal.</p>
            ) : (
              <ul className="space-y-2">
                {data.free.map((u) => (
                  <Row key={u.title} u={u} onApply={() => apply(u)} disabled={!!stale} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Best-value upgrades (current time {duration(data.baselineS)})</h3>
            {data.upgrades.length === 0 ? (
              <p className="text-sm text-slate-500">No part swap saves meaningful time here.</p>
            ) : (
              <ol className="space-y-2">
                {data.upgrades.map((u) => (
                  <Row key={u.title} u={u} onApply={() => apply(u)} disabled={!!stale} />
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
      {!data && !busy && <p className="text-sm text-slate-500">Press “Find upgrades” to test every part in the catalogue on this route.</p>}
    </Card>
  );
}

function Row({ u, onApply, disabled }: { u: Upgrade; onApply: () => void; disabled: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{u.kind === 'free' ? 'Free' : u.detail}</div>
        <div className="font-semibold">{u.title}</div>
        {u.kind === 'free' && <div className="text-xs text-slate-500">{u.detail}</div>}
      </div>
      <div className="text-right tabular-nums">
        <div className="font-bold text-emerald-700">−{u.secondsSaved >= 60 ? duration(u.secondsSaved) : `${u.secondsSaved.toFixed(0)} s`}</div>
        <div className="text-xs text-slate-500">
          {u.costAed > 0 ? `${aed(u.costAed)} · ${u.secPer100.toFixed(1)} s per 100 AED` : u.costAed < 0 ? `saves ${aed(-u.costAed)} too` : 'no cost'}
        </div>
      </div>
      <button onClick={onApply} disabled={disabled} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium hover:border-slate-500 disabled:opacity-40">
        Apply
      </button>
    </li>
  );
}

function WeightVsAero() {
  const { state, route } = useStore();
  const { build } = useActiveBuild();
  const data = useMemo(() => weightVsAero(build, state.rider), [build, state.rider]);
  const routeTime = useMemo(() => {
    const l = runRide({ ...build, selection: data.light.selection }, state.rider, state.conditions, route).sim.totalTimeS;
    const a = runRide({ ...build, selection: data.aero.selection }, state.rider, state.conditions, route).sim.totalTimeS;
    return { l, a };
  }, [build, data, state.rider, state.conditions, route]);
  return (
    <Card
      title="Weight vs aero"
      subtitle={`At ${Math.round((state.rider.ftpW * state.rider.ftpPct) / 100)} W and ${state.rider.weightKg} kg, at what gradient does a lighter bike beat a more aerodynamic one?`}
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-[#eb6834]/10 p-3 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Light bike</div>
          <div className="font-semibold">{data.light.label}</div>
          <div className="text-xs tabular-nums text-slate-600">
            {data.light.massKg.toFixed(2)} kg · CdA {data.light.cda.toFixed(3)} m² · {route.name}: {duration(routeTime.l)}
          </div>
        </div>
        <div className="rounded-xl bg-[#2a78d6]/10 p-3 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Aero bike</div>
          <div className="font-semibold">{data.aero.label}</div>
          <div className="text-xs tabular-nums text-slate-600">
            {data.aero.massKg.toFixed(2)} kg · CdA {data.aero.cda.toFixed(3)} m² · {route.name}: {duration(routeTime.a)}
          </div>
        </div>
      </div>
      <WeightAeroChart data={data} />
      <p className="mt-2 text-sm text-slate-700">
        {data.crossoverPct === null
          ? 'For you the aero bike is faster on every gradient up to 12%.'
          : data.crossoverPct === 0
            ? 'For you the lighter bike is faster everywhere, even on the flat.'
            : (
              <>
                Below <strong>{data.crossoverPct}%</strong> the aero bike is faster; steeper than that, the lighter bike wins. Stronger riders go faster, so drag matters more and the crossover moves to steeper gradients.
              </>
            )}{' '}
        Rest of the build stays the same; still air at 20 °C.
      </p>
    </Card>
  );
}

export function BudgetPage() {
  return (
    <div className="space-y-6">
      <AutoBuild />
      <GarageBar />
      <div className="grid gap-6 xl:grid-cols-2">
        <Suggestions />
        <WeightVsAero />
      </div>
    </div>
  );
}
