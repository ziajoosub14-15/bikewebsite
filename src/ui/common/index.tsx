import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Card({ title, subtitle, actions, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tile({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: ReactNode; tone?: 'brand' }) {
  return (
    <div className={`rounded-xl p-3 ${tone === 'brand' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${tone === 'brand' ? 'text-white/60' : 'text-slate-500'}`}>{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl">{value}</span>
        {unit && <span className={`text-xs font-medium ${tone === 'brand' ? 'text-white/60' : 'text-slate-500'}`}>{unit}</span>}
      </div>
      {sub && <div className={`mt-0.5 text-[11px] leading-tight ${tone === 'brand' ? 'text-white/60' : 'text-slate-500'}`}>{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: { value: T; options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[]; onChange: (v: T) => void; label?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-1 rounded-lg bg-slate-100 p-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${value === o.value ? 'bg-white font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, onChange, min, max, step, unit, format, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit?: string; format?: (v: number) => string; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums font-semibold text-slate-900">
          {format ? format(value) : value}
          {unit && <span className="ml-0.5 text-xs font-medium text-slate-500">{unit}</span>}
        </span>
      </div>
      <input type="range" className="w-full accent-brand-600" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </label>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-slate-500">
        <input
          type="number"
          inputMode="decimal"
          className="w-full min-w-0 rounded-lg bg-transparent px-3 py-2 tabular-nums outline-none"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(v) && v >= min && v <= max) onChange(v);
          }}
          onBlur={() => setText(String(value))}
        />
        {unit && <span className="pr-3 text-xs text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(240, Math.floor(entries[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

/** Race and multi-series colours (validated for colour-blind separation; always shown with a text label too). */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
