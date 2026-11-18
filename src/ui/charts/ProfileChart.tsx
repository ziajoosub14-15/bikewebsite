import { useMemo, useState } from 'react';
import { buildGeometry } from '../../physics/route';
import type { Route, SimResult } from '../../physics/types';
import { useElementWidth } from '../common';
import { GRADE_BUCKETS, gradeColor } from './grade';

export interface SpeedSeries {
  name: string;
  color: string;
  sim: SimResult;
}

interface Props {
  route: Route;
  series?: SpeedSeries[];
  /** Mark braking zones from the first series. */
  showBraking?: boolean;
  /** Current position marker (m), e.g. from an animation. */
  markerM?: number;
  compact?: boolean;
}

const PAD = { l: 44, r: 12 };

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function speedAtDistance(sim: SimResult, d: number): number {
  const s = sim.samples;
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].distM < d) lo = mid;
    else hi = mid;
  }
  return s[hi].speedMs;
}

/** Elevation profile coloured by gradient, with an aligned speed panel underneath (shared distance axis). */
export function ProfileChart({ route, series = [], showBraking, markerM, compact }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hoverM, setHoverM] = useState<number | null>(null);
  const geo = useMemo(() => buildGeometry(route), [route]);
  const elevH = compact ? 110 : 170;
  const speedH = series.length ? (compact ? 100 : 150) : 0;
  const gap = series.length ? 26 : 0;
  const axisH = 22;
  const H = elevH + gap + speedH + axisH;
  const plotW = width - PAD.l - PAD.r;
  const total = geo.totalM;
  const x = (d: number) => PAD.l + (d / total) * plotW;

  const elevPts = useMemo(() => {
    const pts = route.segments.map((s, i) => ({ d: geo.segStartM[i], e: geo.segStartElevM[i], g: s.gradePct }));
    pts.push({ d: total, e: geo.elevationAt(total), g: pts[pts.length - 1]?.g ?? 0 });
    return pts;
  }, [route, geo, total]);
  const eMin = Math.min(...elevPts.map((p) => p.e));
  const eMax = Math.max(...elevPts.map((p) => p.e));
  const eRange = Math.max(eMax - eMin, 40);
  const e0 = eMin - eRange * 0.08;
  const e1 = eMin + eRange * 1.12;
  const ye = (e: number) => elevH - ((e - e0) / (e1 - e0)) * elevH;
  const eTicks = niceTicks(e0, e1, 3).filter((t) => t >= e0 && t <= e1);

  // Group consecutive segments of the same gradient colour into one filled shape that follows the profile.
  const runs = useMemo(() => {
    const out: { color: string; pts: { d: number; e: number }[] }[] = [];
    for (let i = 0; i < elevPts.length - 1; i++) {
      const a = elevPts[i];
      const b = elevPts[i + 1];
      const color = gradeColor(a.g);
      const last = out[out.length - 1];
      if (last && last.color === color) last.pts.push(b);
      else out.push({ color, pts: [a, b] });
    }
    return out;
  }, [elevPts]);

  const vMax = series.length ? Math.max(...series.map((s) => s.sim.maxSpeedMs * 3.6)) : 0;
  const vTop = Math.max(20, Math.ceil(vMax / 10) * 10);
  const sy0 = elevH + gap;
  const yv = (kmh: number) => sy0 + speedH - (kmh / vTop) * speedH;
  const vTicks = niceTicks(0, vTop, 3);

  const speedPaths = useMemo(
    () =>
      series.map((s) => {
        const step = Math.max(1, Math.floor(s.sim.samples.length / (plotW * 1.5)));
        let d = '';
        s.sim.samples.forEach((p, i) => {
          if (i % step && i !== s.sim.samples.length - 1) return;
          d += `${d ? 'L' : 'M'}${x(p.distM).toFixed(1)},${yv(p.speedMs * 3.6).toFixed(1)}`;
        });
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, plotW, vTop, speedH, sy0],
  );

  const kmTicks = niceTicks(0, total / 1000, Math.max(3, Math.floor(plotW / 90)));
  const hover = hoverM !== null ? hoverM : null;
  const hoverSeg = hover !== null ? route.segments[geo.segmentAt(Math.min(hover, total - 0.01))] : null;
  const braking = showBraking && series[0] ? series[0].sim.brakingPoints : [];

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - PAD.l;
    if (px < 0 || px > plotW) return setHoverM(null);
    setHoverM((px / plotW) * total);
  };

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={width}
        height={H}
        className="block touch-pan-y"
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setHoverM(null)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchEnd={() => setHoverM(null)}
        role="img"
        aria-label={`Elevation profile of ${route.name}${series.length ? ' with speed' : ''}`}
      >
        {/* Elevation grid */}
        {eTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={ye(t)} y2={ye(t)} stroke="#e7e5e0" />
            <text x={PAD.l - 6} y={ye(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b6a65">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={10} fontSize={11} fill="#6b6a65" fontWeight={600}>Elevation (m)</text>
        {runs.map((r, i) => (
          <path
            key={i}
            d={`${r.pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.d).toFixed(1)},${ye(p.e).toFixed(1)}`).join('')}L${x(r.pts[r.pts.length - 1].d).toFixed(1)},${elevH}L${x(r.pts[0].d).toFixed(1)},${elevH}Z`}
            fill={r.color}
            stroke={r.color}
            strokeWidth={0.6}
          />
        ))}
        <path d={elevPts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${ye(p.e).toFixed(1)}`).join('')} fill="none" stroke="#2b2a27" strokeWidth={1.5} />
        {braking.map((b, i) => (
          <g key={i}>
            <rect x={x(b.startDistM)} width={Math.max(2, x(b.endDistM) - x(b.startDistM))} y={0} height={elevH} fill="#e34948" opacity={0.18} />
            <line x1={x(b.startDistM)} x2={x(b.startDistM)} y1={0} y2={elevH} stroke="#e34948" strokeWidth={1} />
          </g>
        ))}

        {/* Speed panel */}
        {series.length > 0 && (
          <>
            <text x={PAD.l} y={sy0 - 8} fontSize={11} fill="#6b6a65" fontWeight={600}>Speed (km/h)</text>
            {vTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={width - PAD.r} y1={yv(t)} y2={yv(t)} stroke="#e7e5e0" />
                <text x={PAD.l - 6} y={yv(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b6a65">
                  {t}
                </text>
              </g>
            ))}
            {speedPaths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={series[i].color} strokeWidth={series.length > 1 ? 1.75 : 2} strokeLinejoin="round" opacity={0.95} />
            ))}
          </>
        )}

        {/* Distance axis */}
        {kmTicks.map((k) => (
          <text key={k} x={x(k * 1000)} y={H - 6} textAnchor="middle" fontSize={11} fill="#6b6a65">
            {k} km
          </text>
        ))}

        {markerM !== undefined && <line x1={x(markerM)} x2={x(markerM)} y1={0} y2={H - axisH} stroke="#0b0b0b" strokeWidth={1.5} strokeDasharray="3 3" />}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H - axisH} stroke="#0b0b0b" strokeWidth={1} />
            <circle cx={x(hover)} cy={ye(geo.elevationAt(hover))} r={4} fill="#fff" stroke="#0b0b0b" strokeWidth={2} />
            {series.map((s, i) => (
              <circle key={i} cx={x(hover)} cy={yv(speedAtDistance(s.sim, hover) * 3.6)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && hoverSeg && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) + 10, 0), width - 170) }}
        >
          <div className="font-semibold text-slate-900">{(hover / 1000).toFixed(2)} km</div>
          <div className="text-slate-600">
            {Math.round(geo.elevationAt(hover))} m · {hoverSeg.gradePct > 0 ? '+' : ''}
            {hoverSeg.gradePct.toFixed(1)}%{hoverSeg.surface !== 'smooth' ? ` · ${hoverSeg.surface}` : ''}
          </div>
          {series.map((s) => (
            <div key={s.name} className="mt-0.5 flex items-center gap-1.5 text-slate-700">
              <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto pl-2 font-semibold tabular-nums">{(speedAtDistance(s.sim, hover) * 3.6).toFixed(1)} km/h</span>
            </div>
          ))}
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600" aria-label="Gradient legend">
          {GRADE_BUCKETS.map((b) => (
            <span key={b.label} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: b.color }} />
              {b.label}
            </span>
          ))}
          {braking.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-3.5 rounded-sm border-l-2 border-[#e34948] bg-[#e34948]/20" />
              Braking zone
            </span>
          )}
        </div>
      )}
    </div>
  );
}
