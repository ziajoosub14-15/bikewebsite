import type { ComfortFactor } from '../../domain/comfort';

function Ring({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = score >= 7 ? '#0f9b7a' : score >= 5 ? '#c98500' : '#d1263b';
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(score / 10) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

/** Comfort out of 10 with a bar per factor, so you can see what drags the score down. */
export function ComfortPanel({ score, factors }: { score: number; factors: ComfortFactor[] }) {
  const worst = [...factors].sort((a, b) => a.score - b.score)[0];
  return (
    <div>
      <div className="flex items-center gap-3">
        <Ring score={score} />
        <div>
          <div className="text-sm font-semibold">Comfort {score.toFixed(1)} / 10</div>
          <div className="text-xs text-slate-500">
            {score >= 7.5 ? 'All-day comfortable.' : score >= 5.5 ? 'Fine for a few hours.' : 'Harsh: built for short, fast efforts.'} Biggest drag: <strong className="text-slate-700">{worst.label.toLowerCase()}</strong>.
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {factors.map((f) => (
          <li key={f.key} title={`${f.label}: ${f.score.toFixed(1)}/10 · weight ${Math.round(f.weight * 100)}%`}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-800">
                {f.label} <span className="font-normal text-slate-500">· {f.why}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">{f.score.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full transition-all duration-500 ${f === worst ? 'bg-rose-500' : 'bg-slate-700'}`} style={{ width: `${f.score * 10}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">Weights: frame 20%, tyres 20%, fit 20%, saddle 15%, position 15%, bars 10%.</p>
    </div>
  );
}
