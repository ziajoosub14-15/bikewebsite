import { useState } from 'react';
import type { WeightAeroResult } from '../../domain/weightVsAero';
import { useElementWidth } from '../common';

/** One line: seconds per km the aero bike is ahead (below zero) or behind (above zero) the light bike, by gradient. */
export function WeightAeroChart({ data }: { data: WeightAeroResult }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240;
  const pad = { l: 48, r: 14, t: 16, b: 30 };
  const pw = width - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const pts = data.points;
  const gMax = pts[pts.length - 1].gradePct;
  const vals = pts.map((p) => p.diffSPerKm);
  const lim = Math.max(2, Math.ceil(Math.max(...vals.map(Math.abs)) / 2) * 2);
  const x = (g: number) => pad.l + (g / gMax) * pw;
  const y = (v: number) => pad.t + ph / 2 - (v / lim) * (ph / 2);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.gradePct).toFixed(1)},${y(p.diffSPerKm).toFixed(1)}`).join('');
  const hp = hover !== null ? pts[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={H}
        className="block"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const g = ((e.clientX - r.left - pad.l) / pw) * gMax;
          if (g < 0 || g > gMax) return setHover(null);
          setHover(Math.round(g / 0.5));
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Time difference between the aero and the light bike by gradient. Crossover at ${data.crossoverPct ?? 'none'}%.`}
      >
        <rect x={pad.l} y={pad.t} width={pw} height={ph / 2} fill="#eb6834" opacity={0.06} />
        <rect x={pad.l} y={pad.t + ph / 2} width={pw} height={ph / 2} fill="#2a78d6" opacity={0.06} />
        <text x={pad.l + 8} y={pad.t + 14} fontSize={11} fill="#52514e" fontWeight={600}>Light bike faster ↑</text>
        <text x={pad.l + 8} y={pad.t + ph - 6} fontSize={11} fill="#52514e" fontWeight={600}>Aero bike faster ↓</text>
        {[-lim, -lim / 2, 0, lim / 2, lim].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#52514e' : '#e7e5e0'} strokeWidth={v === 0 ? 1.2 : 1} />
            <text x={pad.l - 6} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b6a65">
              {v > 0 ? '+' : ''}
              {v}s
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(gMax / 2) + 1 }, (_, i) => i * 2).map((g) => (
          <text key={g} x={x(g)} y={H - 10} textAnchor="middle" fontSize={11} fill="#6b6a65">
            {g}%
          </text>
        ))}
        {data.crossoverPct !== null && (
          <g>
            <line x1={x(data.crossoverPct)} x2={x(data.crossoverPct)} y1={pad.t} y2={pad.t + ph} stroke="#0b0b0b" strokeDasharray="4 3" />
            <circle cx={x(data.crossoverPct)} cy={y(0)} r={5} fill="#0b0b0b" stroke="#fff" strokeWidth={2} />
            <text x={x(data.crossoverPct) + 8} y={y(0) - 10} fontSize={12} fontWeight={700} fill="#0b0b0b">
              {data.crossoverPct}%
            </text>
          </g>
        )}
        <path d={line} fill="none" stroke="#2b2a27" strokeWidth={2} />
        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.gradePct)} x2={x(hp.gradePct)} y1={pad.t} y2={pad.t + ph} stroke="#0b0b0b" strokeWidth={1} />
            <circle cx={x(hp.gradePct)} cy={y(hp.diffSPerKm)} r={4.5} fill="#2b2a27" stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg" style={{ left: Math.min(x(hp.gradePct) + 10, width - 190) }}>
          <div className="font-semibold">{hp.gradePct.toFixed(1)}% gradient</div>
          <div className="text-slate-600">Light: {Math.floor(hp.lightSPerKm / 60)}:{String(Math.round(hp.lightSPerKm % 60)).padStart(2, '0')} per km</div>
          <div className="text-slate-600">Aero: {Math.floor(hp.aeroSPerKm / 60)}:{String(Math.round(hp.aeroSPerKm % 60)).padStart(2, '0')} per km</div>
          <div className="mt-0.5 font-semibold">{hp.diffSPerKm < 0 ? `Aero ${Math.abs(hp.diffSPerKm).toFixed(1)} s/km faster` : `Light ${hp.diffSPerKm.toFixed(1)} s/km faster`}</div>
        </div>
      )}
    </div>
  );
}
