import { useState } from 'react';
import type { BuildSummary } from '../../domain/summary';
import { MISC_WEIGHT_G } from '../../domain/summary';
import { POSITION_LABEL } from '../../domain/rider';
import { ComfortPanel } from '../rider/ComfortPanel';
import type { Category } from '../../types/components';
import { aed } from '../format';
import { CATEGORY_LABEL } from '../labels';

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</span>
        {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11px] leading-tight text-slate-500">{sub}</div>}
    </div>
  );
}

function BarList({ rows, format, total }: { rows: { label: string; value: number }[]; format: (n: number) => string; total: number }) {
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${format(r.value)} (${Math.round((r.value / total) * 100)}%)`}>
          <div className="flex justify-between text-xs">
            <span className="text-slate-700">{r.label}</span>
            <span className="tabular-nums text-slate-500">
              {format(r.value)} <span className="text-slate-400">· {Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-slate-700 transition-all duration-500 group-hover:bg-brand-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  summary: BuildSummary;
  onJump: (c: Category) => void;
}

export function SummaryPanel({ summary: s, onJump }: Props) {
  const [breakdown, setBreakdown] = useState<'price' | 'weight'>('price');
  const errors = s.issues.filter((i) => i.severity === 'error');
  const warnings = s.issues.filter((i) => i.severity === 'warning');
  const priceRows = s.byCategory.map((c) => ({ label: CATEGORY_LABEL[c.category], value: c.priceAed })).sort((a, b) => b.value - a.value);
  const weightRows = [
    ...s.byCategory.map((c) => ({ label: CATEGORY_LABEL[c.category], value: c.weightG })),
    { label: 'Pedals, cages, sealant', value: MISC_WEIGHT_G },
  ].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Live summary</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              errors.length ? 'bg-rose-100 text-rose-800' : warnings.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {errors.length ? `${errors.length} won’t fit` : warnings.length ? `${warnings.length} to check` : 'Ready to ride'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Price" value={Math.round(s.priceAed).toLocaleString('en-US')} unit="AED" />
          <Tile label="Weight" value={s.weightKg.toFixed(2)} unit="kg" sub="incl. pedals & cages" />
          <Tile label="Est. CdA" value={s.cdaTotal.toFixed(3)} unit="m²" sub={`bike ${s.cdaBike.toFixed(3)} + rider (${POSITION_LABEL[s.rider.position].toLowerCase()})`} />
          <Tile label="Flat speed" value={(s.flatSpeedMs * 3.6).toFixed(1)} unit="km/h" sub={`${s.rider.powerW} W, ${s.rider.massKg} kg rider, no wind`} />
        </div>

      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Comfort ranking</h2>
        <ComfortPanel score={s.comfort.score} factors={s.comfort.factors} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-live="polite">
        <h2 className="font-bold">Compatibility</h2>
        {s.issues.length === 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white">✓</span>
            Every part works together.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {s.issues.map((i) => (
              <li key={i.id} className={`rounded-xl border p-3 text-sm ${i.severity === 'error' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                      i.severity === 'error' ? 'bg-rose-600' : 'bg-amber-500'
                    }`}
                    aria-label={i.severity === 'error' ? 'Error' : 'Warning'}
                  >
                    {i.severity === 'error' ? '✕' : '!'}
                  </span>
                  <div className="min-w-0">
                    <div className={`font-semibold ${i.severity === 'error' ? 'text-rose-900' : 'text-amber-950'}`}>{i.title}</div>
                    <p className="mt-0.5 text-slate-700">{i.message}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {i.categories.map((c) => (
                        <button key={c} onClick={() => onJump(c)} className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium hover:border-slate-400">
                          Change {CATEGORY_LABEL[c].toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{breakdown === 'price' ? 'Where the money goes' : 'Where the weight is'}</h2>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {(['price', 'weight'] as const).map((b) => (
              <button key={b} onClick={() => setBreakdown(b)} aria-pressed={breakdown === b} className={`rounded-md px-2 py-1 capitalize ${breakdown === b ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}>
                {b}
              </button>
            ))}
          </div>
        </div>
        {breakdown === 'price' ? (
          <BarList rows={priceRows} format={aed} total={s.priceAed} />
        ) : (
          <BarList rows={weightRows} format={(n) => `${Math.round(n).toLocaleString('en-US')} g`} total={s.weightKg * 1000} />
        )}
      </section>
      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Prices and weights are approximate public figures converted to AED; real prices vary by shop and spec.
      </p>
    </div>
  );
}
