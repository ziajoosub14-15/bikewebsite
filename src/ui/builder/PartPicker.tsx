import { useMemo, useState } from 'react';
import { listComponents } from '../../data/catalog';
import { issuesIfSwapped } from '../../domain/compatibility';
import type { BikeComponent, BuildSelection, Category } from '../../types/components';
import { CATEGORY_HINT, CATEGORY_LABEL } from '../labels';
import { PartCard } from './PartCard';

type Sort = 'default' | 'price-asc' | 'price-desc' | 'weight' | 'aero' | 'comfort';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'default', label: 'Featured' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'weight', label: 'Lightest' },
  { id: 'aero', label: 'Most aero' },
  { id: 'comfort', label: 'Most comfortable' },
];

interface Props {
  category: Category;
  selection: BuildSelection;
  onChoose: (category: Category, id: string) => void;
}

export function PartPicker({ category, selection, onChoose }: Props) {
  const [brandByCat, setBrandByCat] = useState<Partial<Record<Category, string>>>({});
  const [sort, setSort] = useState<Sort>('default');
  const [hideIncompatible, setHideIncompatible] = useState(false);
  const [range, setRange] = useState<'all' | 'top' | 'mid' | 'entry'>('all');
  const brand = brandByCat[category] ?? 'All';

  const parts = listComponents(category) as BikeComponent[];
  const current = parts.find((p) => p.id === selection[category])!;
  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of parts) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [parts]);

  const rows = useMemo(() => {
    const withIssues = parts.map((p) => ({ part: p, issues: issuesIfSwapped(selection, category, p.id) }));
    let list = withIssues.filter((r) => brand === 'All' || r.part.brand === brand);
    if (category === 'frame' && range !== 'all') list = list.filter((r) => r.part.category === 'frame' && r.part.range === range);
    if (hideIncompatible) list = list.filter((r) => r.part.id === selection[category] || !r.issues.some((i) => i.severity === 'error'));
    const by: Record<Sort, (a: BikeComponent, b: BikeComponent) => number> = {
      default: () => 0,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      weight: (a, b) => a.weight - b.weight,
      aero: (a, b) => a.cdaDelta - b.cdaDelta,
      comfort: (a, b) => b.comfort - a.comfort,
    };
    return [...list].sort((a, b) => by[sort](a.part, b.part));
  }, [parts, selection, category, brand, sort, hideIncompatible, range]);

  const incompatibleCount = parts.filter((p) => issuesIfSwapped(selection, category, p.id).some((i) => i.severity === 'error')).length;

  return (
    <section aria-labelledby="picker-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <h2 id="picker-title" className="text-xl font-bold tracking-tight">
            Choose {CATEGORY_LABEL[category].toLowerCase()}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{CATEGORY_HINT[category]}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={hideIncompatible} onChange={(e) => setHideIncompatible(e.target.checked)} />
              <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2" />
              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
            </span>
            Hide parts that won’t fit{incompatibleCount ? ` (${incompatibleCount})` : ''}
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            aria-label="Sort parts"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap" role="group" aria-label="Filter by brand">
          {[['All', parts.length] as const, ...brands].map(([b, n]) => (
            <button
              key={b}
              onClick={() => setBrandByCat((m) => ({ ...m, [category]: b }))}
              aria-pressed={brand === b}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition ${
                brand === b ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {b} <span className={brand === b ? 'text-white/60' : 'text-slate-400'}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {category === 'frame' && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by model range">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Range</span>
          {(
            [
              ['all', 'All'],
              ['top', 'Top models'],
              ['mid', 'Mid-range'],
              ['entry', 'Entry'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setRange(v)}
              aria-pressed={range === v}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${range === v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              {label} <span className={range === v ? 'text-white/60' : 'text-slate-400'}>{v === 'all' ? parts.length : parts.filter((p) => p.category === 'frame' && p.range === v).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {rows.map(({ part, issues }) => (
          <PartCard
            key={part.id}
            part={part}
            current={current}
            selected={part.id === selection[category]}
            issues={issues}
            onSelect={() => onChoose(category, part.id)}
          />
        ))}
      </div>
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No {brand} parts fit this build. Turn off “Hide parts that won’t fit” to see them anyway.
        </p>
      )}
    </section>
  );
}
