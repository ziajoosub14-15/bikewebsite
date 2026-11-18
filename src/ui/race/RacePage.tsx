import { useMemo, useState } from 'react';
import { PRO_GHOSTS, runRace, type Entrant } from '../../domain/race';
import { useStore } from '../../state/store';
import { ProfileChart } from '../charts/ProfileChart';
import { RideAnimation } from '../charts/RideAnimation';
import { Card, SERIES_COLORS } from '../common';
import { aed, duration } from '../format';
import { ConditionsPanel, compassName } from '../ride/ConditionsPanel';
import { RoutePicker } from '../ride/RoutePicker';

export function RacePage() {
  const { state, route } = useStore();
  const [picked, setPicked] = useState<string[]>(() => [...state.builds.slice(0, 2).map((b) => b.id), 'ghost-allround'].slice(0, 3));
  const [showConditions, setShowConditions] = useState(false);

  const options = [
    ...state.builds.map((b) => ({ id: b.id, name: b.name, sub: 'Your build', ghost: false, spec: b as Entrant['spec'] })),
    ...PRO_GHOSTS.map((g) => ({ id: g.id, name: `👻 ${g.name}`, sub: g.blurb, ghost: true, spec: { selection: g.selection } })),
  ];
  const valid = picked.filter((id) => options.some((o) => o.id === id));
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));

  const entrants: Entrant[] = valid.map((id) => {
    const o = options.find((x) => x.id === id)!;
    return { id, name: o.name, spec: o.spec, ghost: o.ghost };
  });
  const key = JSON.stringify([entrants.map((e) => [e.id, e.spec]), state.rider, state.conditions, route.id]);
  const race = useMemo(() => (entrants.length >= 2 ? runRace(entrants, state.rider, state.conditions, route) : null), // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  const colorOf = (id: string) => SERIES_COLORS[valid.indexOf(id) % SERIES_COLORS.length];
  const series = useMemo(() => race?.entries.map((e) => ({ name: e.entrant.name, color: colorOf(e.entrant.id), sim: e.sim })) ?? [], // eslint-disable-next-line react-hooks/exhaustive-deps
    [race]);
  const [markerM, setMarkerM] = useState<number | undefined>();
  const animRiders = useMemo(() => race?.entries.map((e) => ({ name: e.entrant.name, color: colorOf(e.entrant.id), sim: e.sim })) ?? [], // eslint-disable-next-line react-hooks/exhaustive-deps
    [race]);
  const c = state.conditions;

  return (
    <div className="space-y-6">
      <Card title="Line-up" subtitle="Pick 2–4 bikes. Everyone gets the same rider, power and conditions, so only the bikes differ.">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {options.map((o) => {
            const on = valid.includes(o.id);
            const full = !on && valid.length >= 4;
            return (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                disabled={full}
                aria-pressed={on}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:opacity-40 ${on ? 'border-slate-900 bg-white shadow-[0_0_0_1px_#0f172a]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-bold text-white ${on ? 'border-transparent' : 'border-slate-300'}`} style={on ? { background: colorOf(o.id) } : undefined}>
                  {on ? '✓' : ''}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{o.name}</span>
                  <span className="block text-xs text-slate-500">{o.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="Course"
        actions={
          <button onClick={() => setShowConditions((v) => !v)} className="text-sm font-medium text-brand-700 underline" aria-expanded={showConditions}>
            {showConditions ? 'Hide conditions' : `Wind ${c.windKmh} km/h from ${compassName(c.windFromDeg)} · ${c.temperatureC} °C · change`}
          </button>
        }
      >
        <RoutePicker compact />
        {showConditions && (
          <div className="mt-4 max-w-xl">
            <ConditionsPanel />
          </div>
        )}
      </Card>

      {!race ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Pick at least two bikes to race.</p>
      ) : (
        <>
          <Card title="Race" subtitle={`${route.name} · ${state.rider.weightKg} kg rider at ${Math.round((state.rider.ftpW * state.rider.ftpPct) / 100)} W`}>
            <RideAnimation route={route} riders={animRiders} onPosition={setMarkerM} height={340} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card title="Result">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1.5 pr-2 font-semibold">#</th>
                      <th className="py-1.5 pr-3 font-semibold">Bike</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Time</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Gap</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Avg</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Weight</th>
                      <th className="py-1.5 text-right font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...race.entries].sort((a, b) => a.place - b.place).map((e) => (
                      <tr key={e.entrant.id} className="border-t border-slate-100">
                        <td className="py-2 pr-2 text-lg font-extrabold">{e.place === 1 ? '🏆' : e.place}</td>
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: colorOf(e.entrant.id) }} />
                            <span className="font-semibold">{e.entrant.name}</span>
                          </span>
                          {!e.entrant.ghost && <span className="ml-4.5 block text-xs text-slate-500">{e.setup.parts.frame.brand} {e.setup.parts.frame.name}</span>}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold">{duration(e.sim.totalTimeS)}</td>
                        <td className="py-2 pr-3 text-right">{e.gapS < 0.5 ? '–' : `+${duration(e.gapS)}`}</td>
                        <td className="py-2 pr-3 text-right">{(e.sim.avgSpeedMs * 3.6).toFixed(1)} km/h</td>
                        <td className="py-2 pr-3 text-right">{e.setup.weightKg.toFixed(2)} kg</td>
                        <td className="py-2 text-right">{e.entrant.ghost ? '—' : aed(e.setup.priceAed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Why the winner won">
              <ul className="space-y-2 text-sm">
                {race.reasons.map((r, i) => (
                  <li key={i} className={`rounded-lg px-3 py-2 ${/ beat /.test(r) ? 'bg-slate-900 font-semibold text-white' : 'bg-slate-50 text-slate-700'}`}>
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="Speed comparison" subtitle="Same distance axis as the profile. Hover to compare speeds at any point.">
            <ProfileChart route={route} series={series} markerM={markerM} />
            <div className="mt-2 flex flex-wrap gap-3 text-xs" aria-label="Legend">
              {series.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </Card>

          <Card title="Split times" subtitle="Elapsed time at the end of each section, with the section time underneath. Bold = fastest through that section.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Section</th>
                    {race.entries.map((e) => (
                      <th key={e.entrant.id} className="py-1.5 pr-3 text-right font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block size-2 rounded-full" style={{ background: colorOf(e.entrant.id) }} />
                          <span className="max-w-32 truncate normal-case tracking-normal">{e.entrant.name}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {race.sections.map((s, i) => {
                    const secT = race.entries.map((e) => e.splits[i] - (i ? e.splits[i - 1] : 0));
                    const best = Math.min(...secT);
                    const lead = Math.min(...race.entries.map((e) => e.splits[i]));
                    return (
                      <tr key={s.label + i} className="border-t border-slate-100 align-top">
                        <td className="py-1.5 pr-3">
                          <div className="font-medium">{s.label}</div>
                          <div className="text-xs text-slate-500">
                            {((s.endM - s.startM) / 1000).toFixed(1)} km · {s.avgGradePct > 0 ? '+' : ''}
                            {s.avgGradePct.toFixed(1)}%
                          </div>
                        </td>
                        {race.entries.map((e, j) => (
                          <td key={e.entrant.id} className="py-1.5 pr-3 text-right">
                            <div className={secT[j] === best ? 'font-bold' : ''}>{duration(e.splits[i])}</div>
                            <div className="text-xs text-slate-500">
                              {duration(secT[j])}
                              {e.splits[i] - lead >= 0.5 && <span className="text-rose-700"> · +{duration(e.splits[i] - lead)}</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
