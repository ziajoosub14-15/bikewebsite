import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { PRESET_BUILDS } from '../../domain/presets';
import { summarize } from '../../domain/summary';
import { makeBuild, useActiveBuild, useStore } from '../../state/store';
import { CATEGORIES, type Category } from '../../types/components';
import { aed } from '../format';
import { CATEGORY_LABEL, PAINTS } from '../labels';
import { FitPanel } from '../rider/FitPanel';
import { BikeIllustration } from './BikeIllustration';
import { ColourwayPicker } from './ColourwayPicker';
import { resolveColourway } from '../bike/paint';
import { Segmented } from '../common';

const Bike3D = lazy(() => import('../bike/Bike3D'));
import { PartPicker } from './PartPicker';
import { SummaryPanel } from './SummaryPanel';

/** Saved builds: switch, add, duplicate, delete. */
export function GarageBar() {
  const { state, activate, addBuild, duplicate, remove, active } = useStore();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">My builds</span>
      <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-0.5">
        {state.builds.map((b) => (
          <button
            key={b.id}
            onClick={() => activate(b.id)}
            aria-pressed={b.id === state.activeId}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              b.id === state.activeId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="size-3 rounded-full border border-black/20" style={{ background: b.paint }} />
            <span className="max-w-44 truncate">{b.name}</span>
          </button>
        ))}
      </div>
      <div className="relative flex gap-1.5">
        <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-600" aria-expanded={adding}>
          + New
        </button>
        <button onClick={() => duplicate(active.id)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-300">
          Duplicate
        </button>
        <button
          onClick={() => {
            if (state.builds.length > 1 && confirm(`Delete “${active.name}”?`)) remove(active.id);
          }}
          disabled={state.builds.length <= 1}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-40"
        >
          Delete
        </button>
        {adding && (
          <div className="absolute left-0 top-10 z-30 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Start a new build from</div>
            {Object.entries(PRESET_BUILDS).map(([k, p], i) => (
              <button
                key={k}
                onClick={() => {
                  addBuild(makeBuild(p.name, p.selection, PAINTS[(state.builds.length + i) % PAINTS.length].hex));
                  setAdding(false);
                }}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BuilderPage() {
  const { state, choose } = useStore();
  const { build, update } = useActiveBuild();
  const summary = useMemo(() => summarize(build, state.rider), [build, state.rider]);
  const colourway = resolveColourway(summary.parts.frame, build.colourwayId, build.paint);
  const [active, setActive] = useState<Category>('frame');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const pickerRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const issueCats = new Map<Category, 'error' | 'warning'>();
  for (const i of summary.issues) for (const c of i.categories) if (issueCats.get(c) !== 'error') issueCats.set(c, i.severity);
  const errorCount = summary.issues.filter((i) => i.severity === 'error').length;

  const jump = (c: Category) => {
    setActive(c);
    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-4">
      <GarageBar />
      <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_0%,#f1f5f9_60%,#e2e8f0_100%)] shadow-sm">
            <div className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
              <input
                value={build.name}
                onChange={(e) => update({ name: e.target.value })}
                aria-label="Build name"
                className="min-w-0 basis-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xl font-extrabold tracking-tight hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:outline-none sm:flex-1 sm:basis-auto sm:text-2xl"
              />
              <select
                value=""
                onChange={(e) => {
                  const p = PRESET_BUILDS[e.target.value];
                  if (p) update({ name: p.name, selection: { ...p.selection }, frameSizeCm: undefined, tyrePressureBar: undefined });
                }}
                className="w-full rounded-lg border border-slate-300 bg-white/80 px-2.5 py-1.5 text-sm sm:w-auto"
                aria-label="Replace this build with a preset"
              >
                <option value="">Load a preset into this build…</option>
                {Object.entries(PRESET_BUILDS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end px-4 pt-2 sm:px-6">
              <div className="w-32">
                <Segmented size="sm" label="View" value={viewMode} onChange={setViewMode} options={[{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }]} />
              </div>
            </div>
            {viewMode === '2d' ? (
              <div className="px-1 sm:px-4">
                <BikeIllustration build={summary.parts} colourway={colourway} highlight={active} />
              </div>
            ) : (
              <Suspense fallback={<div className="flex h-80 items-center justify-center text-sm text-slate-500">Loading 3D…</div>}>
                <Bike3D parts={summary.parts} colourway={colourway} />
              </Suspense>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-white/60 px-4 py-3 backdrop-blur sm:px-6">
              <ColourwayPicker frame={summary.parts.frame} colourwayId={colourway.id} paint={build.paint} onChange={(colourwayId, paint) => update({ colourwayId, ...(paint ? { paint } : {}) })} />
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{summary.parts.frame.brand}</span> {summary.parts.frame.name} · size {summary.fit.sizeCm} ·{' '}
                {summary.parts.groupset.brand} {summary.parts.groupset.name.split(' ').slice(0, 2).join(' ')}
              </div>
            </div>
          </section>

          <nav aria-label="Part categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex w-max gap-2 sm:grid sm:w-auto sm:grid-cols-4 xl:grid-cols-7">
              {CATEGORIES.map((c) => {
                const part = summary.parts[c];
                const sev = issueCats.get(c);
                return (
                  <button
                    key={c}
                    onClick={() => setActive(c)}
                    aria-current={active === c}
                    className={`relative w-40 rounded-xl border px-3 py-2 text-left transition sm:w-auto ${active === c ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${active === c ? 'text-white/60' : 'text-slate-500'}`}>{CATEGORY_LABEL[c]}</div>
                    <div className="truncate text-sm font-semibold">{part.brand}</div>
                    <div className={`truncate text-xs ${active === c ? 'text-white/70' : 'text-slate-500'}`}>{part.name}</div>
                    {sev && (
                      <span
                        className={`absolute right-2 top-2 size-2.5 rounded-full ring-2 ${active === c ? 'ring-slate-900' : 'ring-white'} ${sev === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`}
                        aria-label={sev === 'error' ? 'Has a compatibility problem' : 'Has a warning'}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          <div ref={pickerRef} className="scroll-mt-20">
            <PartPicker category={active} selection={build.selection} onChoose={choose} />
          </div>
        </div>

        <aside ref={summaryRef} id="summary" className="scroll-mt-20 space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <SummaryPanel summary={summary} onJump={jump} />
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Fit</h2>
            <FitPanel fit={summary.fit} frame={summary.parts.frame} chosen={build.frameSizeCm} onChoose={(s) => update({ frameSizeCm: s })} compact />
          </section>
        </aside>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <button onClick={() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center justify-between gap-3 text-left">
            <div>
              <div className="text-base font-extrabold tabular-nums">{aed(summary.priceAed)}</div>
              <div className="text-xs tabular-nums text-slate-500">
                {summary.weightKg.toFixed(2)} kg · {(summary.flatSpeedMs * 3.6).toFixed(1)} km/h · comfort {summary.comfort.score.toFixed(1)}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${errorCount ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {errorCount ? `${errorCount} won’t fit` : 'All fits'} ›
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
