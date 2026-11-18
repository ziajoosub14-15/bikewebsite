import type { BikeComponent } from '../../types/components';
import type { CompatIssue } from '../../domain/compatibility';
import { aed } from '../format';
import { factsFor, metersFor } from './partMeta';

interface Props {
  part: BikeComponent;
  current: BikeComponent;
  selected: boolean;
  issues: CompatIssue[];
  onSelect: () => void;
}

function Delta({ value, unit, format }: { value: number; unit?: string; format: (n: number) => string }) {
  if (value === 0) return <span className="text-slate-400">same</span>;
  const better = value < 0;
  return (
    <span className={better ? 'text-emerald-700' : 'text-slate-600'}>
      {value > 0 ? '+' : '−'}
      {format(Math.abs(value))}
      {unit}
    </span>
  );
}

export function PartCard({ part, current, selected, issues, onSelect }: Props) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex h-full flex-col rounded-2xl border bg-white p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        selected
          ? 'border-brand-500 shadow-[0_0_0_1px_var(--color-brand-500),0_8px_24px_-12px_rgba(15,155,122,0.5)]'
          : errors.length
            ? 'border-rose-200 bg-rose-50/30 hover:border-rose-300'
            : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{part.brand}</div>
          <div className="mt-0.5 font-semibold leading-snug text-slate-900">{part.name}</div>
        </div>
        {selected ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white" aria-label="Selected">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : (
          <span className="size-6 shrink-0 rounded-full border-2 border-slate-200 group-hover:border-slate-300" />
        )}
      </div>

      {errors.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-100/70 px-2 py-1.5 text-xs font-medium text-rose-800">
          <span aria-hidden>✕</span>
          <span>Won’t fit: {errors[0].title.toLowerCase()}</span>
        </div>
      )}
      {!errors.length && warnings.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-100/70 px-2 py-1.5 text-xs font-medium text-amber-900">
          <span aria-hidden>!</span>
          <span>{warnings[0].title}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {factsFor(part).map((f) => (
          <span key={f} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            {f}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {metersFor(part).map((m) => (
          <div key={m.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-20 shrink-0 text-slate-500">{m.label}</span>
            <div className="flex flex-1 gap-[2px]" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={m.value} aria-label={m.label}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < m.value ? 'bg-slate-700' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div>
          <div className="text-base font-bold tabular-nums">{aed(part.price)}</div>
          <div className="text-xs tabular-nums text-slate-500">{part.weight.toLocaleString('en-US')} g</div>
        </div>
        {!selected && (
          <div className="text-right text-xs tabular-nums">
            <div>
              <Delta value={part.price - current.price} format={(n) => aed(n)} />
            </div>
            <div>
              <Delta value={part.weight - current.weight} unit=" g" format={(n) => n.toLocaleString('en-US')} />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
