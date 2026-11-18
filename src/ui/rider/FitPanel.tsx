import type { FitResult } from '../../domain/fit';
import type { Frame } from '../../types/components';

export function FitPanel({ fit, frame, chosen, onChoose, compact }: { fit: FitResult; frame: Frame; chosen?: number; onChoose: (size: number | undefined) => void; compact?: boolean }) {
  const q = fit.quality;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Measure label="Frame size" value={`${fit.sizeCm} cm`} sub={`ideal ≈ ${fit.idealSizeCm.toFixed(1)} cm`} />
        <Measure label="Saddle height" value={`${Math.round(fit.saddleHeightMm)} mm`} sub="BB centre to saddle top" />
        <Measure label="Stem" value={`${fit.stemFittedMm} mm`} sub={`you need ≈ ${Math.round(fit.stemNeededMm)} mm`} />
        <Measure label="Stack / reach" value={`${Math.round(fit.stackMm)} / ${Math.round(fit.reachMm)}`} sub="mm, approx." />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Size</span>
          <select value={chosen ?? ''} onChange={(e) => onChoose(e.target.value ? Number(e.target.value) : undefined)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option value="">Recommended ({fit.recommendedSizeCm})</option>
            {frame.sizesCm.map((s) => (
              <option key={s} value={s}>
                {s} cm
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-1 items-center gap-2 text-sm">
          <span className="text-slate-600">Fit quality</span>
          <div className="h-2 min-w-20 flex-1 rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${q >= 8 ? 'bg-emerald-600' : q >= 5 ? 'bg-amber-500' : 'bg-rose-600'}`} style={{ width: `${q * 10}%` }} />
          </div>
          <span className="font-semibold tabular-nums">{q.toFixed(1)}</span>
        </div>
      </div>
      <ul className={`mt-3 space-y-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        {fit.notes.map((n, i) => (
          <li key={i} className={`flex gap-2 rounded-lg px-3 py-2 ${n.severity === 'ok' ? 'bg-emerald-50 text-emerald-900' : n.severity === 'warning' ? 'bg-amber-50 text-amber-950' : 'bg-rose-50 text-rose-900'}`}>
            <span aria-hidden className="font-bold">{n.severity === 'ok' ? '✓' : n.severity === 'warning' ? '!' : '✕'}</span>
            {n.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Measure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
