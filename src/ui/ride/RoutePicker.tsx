import { useRef, useState } from 'react';
import { buildGeometry, totalClimbM } from '../../physics/route';
import type { Route } from '../../physics/types';
import { gpxToRoute } from '../../routes/gpx';
import { PRESET_ROUTES } from '../../routes/presets';
import { useStore } from '../../state/store';
import { gradeColor } from '../charts/grade';

function MiniProfile({ route }: { route: Route }) {
  const g = buildGeometry(route);
  const W = 160;
  const H = 34;
  const n = 60;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const d = (i / n) * g.totalM;
    return { d, e: g.elevationAt(d), gr: route.segments[g.segmentAt(Math.min(d, g.totalM - 0.01))].gradePct };
  });
  const min = Math.min(...pts.map((p) => p.e));
  const max = Math.max(...pts.map((p) => p.e), min + 30);
  const y = (e: number) => H - 2 - ((e - min) / (max - min)) * (H - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" aria-hidden preserveAspectRatio="none">
      {pts.slice(0, -1).map((p, i) => (
        <path key={i} d={`M${(i / n) * W},${y(p.e)} L${((i + 1) / n) * W},${y(pts[i + 1].e)} L${((i + 1) / n) * W},${H} L${(i / n) * W},${H}Z`} fill={gradeColor(p.gr)} />
      ))}
    </svg>
  );
}

export function routeStats(route: Route) {
  const g = buildGeometry(route);
  return { km: g.totalM / 1000, climb: totalClimbM(route), corners: route.segments.filter((s) => s.cornerRadiusM).length };
}

/** Route cards (presets + uploaded GPX) with a GPX upload button. */
export function RoutePicker({ compact }: { compact?: boolean }) {
  const { state, route, setRoute, addRoute, removeRoute, allRoutes } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    try {
      const text = await f.text();
      const r = gpxToRoute(text, `gpx-${Date.now().toString(36)}`, f.name.replace(/\.gpx$/i, ''));
      addRoute(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const upload = (
    <>
      <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Upload GPX file" />
      <button onClick={() => fileRef.current?.click()} className="rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-600">
        Upload GPX…
      </button>
    </>
  );

  if (compact)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select value={state.routeId} onChange={(e) => setRoute(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Route">
          {allRoutes.map((r) => {
            const s = routeStats(r);
            return (
              <option key={r.id} value={r.id}>
                {r.name} · {s.km.toFixed(1)} km · {Math.round(s.climb)} m up
              </option>
            );
          })}
        </select>
        {upload}
        {error && <p className="w-full text-sm text-rose-700">{error}</p>}
      </div>
    );

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {allRoutes.map((r) => {
          const s = routeStats(r);
          const custom = !PRESET_ROUTES.includes(r);
          return (
            <div key={r.id} className="relative">
              <button
                onClick={() => setRoute(r.id)}
                aria-pressed={route.id === r.id}
                className={`w-full rounded-xl border p-3 text-left transition ${route.id === r.id ? 'border-slate-900 bg-white shadow-[0_0_0_1px_#0f172a]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-baseline justify-between gap-2 pr-5">
                  <span className="truncate font-semibold">{r.name}</span>
                  {custom && <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">GPX</span>}
                </div>
                <div className="text-xs tabular-nums text-slate-500">
                  {s.km.toFixed(1)} km · {Math.round(s.climb)} m climbing{s.corners ? ` · ${s.corners} corner${s.corners === 1 ? '' : 's'}` : ''}
                </div>
                <div className="mt-2 overflow-hidden rounded-md">
                  <MiniProfile route={r} />
                </div>
              </button>
              {custom && (
                <button onClick={() => removeRoute(r.id)} className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-700" aria-label={`Remove ${r.name}`} title="Remove">
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {upload}
        <span className="text-xs text-slate-500">GPS route files exported from Strava, Garmin, Komoot and others. Elevation is smoothed; corners are detected from the GPS track.</span>
      </div>
      {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {route.description && <p className="mt-3 text-sm text-slate-600">{route.description}</p>}
    </div>
  );
}
