import type { Colourway, Frame } from '../../types/components';
import { PAINTS } from '../labels';

/** A round swatch showing a colourway's base, accent and stripes. */
export function Swatch({ cw, size = 28 }: { cw: Colourway; size?: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <defs>
        <clipPath id={`clip-${cw.id}-${size}`}>
          <circle cx={r} cy={r} r={r - 1} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${cw.id}-${size})`}>
        <rect width={size} height={size} fill={cw.base} />
        {cw.accent && cw.pattern === 'fade' && (
          <>
            <linearGradient id={`g-${cw.id}-${size}`} x1="0" x2="1">
              <stop offset="0" stopColor={cw.base} />
              <stop offset="1" stopColor={cw.accent} />
            </linearGradient>
            <rect width={size} height={size} fill={`url(#g-${cw.id}-${size})`} />
          </>
        )}
        {cw.accent && cw.pattern !== 'fade' && <path d={`M${size} 0 L${size} ${size} L0 ${size} Z`} fill={cw.accent} />}
        {cw.stripes?.map((c, i) => <rect key={i} x={0} y={r - 5 + i * 2} width={size} height={2} fill={c} />)}
        {cw.detail && <circle cx={r * 1.35} cy={r * 0.65} r={r * 0.2} fill={cw.detail} />}
        {cw.finish !== 'matte' && <ellipse cx={r * 0.7} cy={r * 0.55} rx={r * 0.45} ry={r * 0.2} fill="#fff" opacity={cw.finish === 'pearl' ? 0.55 : 0.3} />}
      </g>
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke="rgba(0,0,0,0.2)" />
    </svg>
  );
}

export function ColourwayPicker({ frame, colourwayId, paint, onChange }: { frame: Frame; colourwayId: string; paint: string; onChange: (id: string, paint?: string) => void }) {
  const current = frame.colourways.find((c) => c.id === colourwayId);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colourway">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Colourway</span>
        {frame.colourways.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={colourwayId === c.id}
            aria-label={c.name}
            title={`${c.name}${c.official ? '' : ' (approximate)'}`}
            onClick={() => onChange(c.id)}
            className={`rounded-full transition hover:scale-110 ${colourwayId === c.id ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
          >
            <Swatch cw={c} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />
        <button
          role="radio"
          aria-checked={colourwayId === 'custom'}
          onClick={() => onChange('custom')}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${colourwayId === 'custom' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
        >
          Custom
        </button>
        {colourwayId === 'custom' &&
          PAINTS.map((p) => (
            <button
              key={p.hex}
              aria-label={p.name}
              title={p.name}
              onClick={() => onChange('custom', p.hex)}
              className={`size-6 rounded-full border border-black/15 transition hover:scale-110 ${paint === p.hex ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
              style={{ background: p.hex }}
            />
          ))}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {current ? (
          <>
            <span className="font-medium text-slate-700">{current.name}</span> · {current.finish}
            {current.official ? <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Official colourway</span> : <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Approximate</span>}
          </>
        ) : (
          'Your own paint colour'
        )}
      </div>
    </div>
  );
}
