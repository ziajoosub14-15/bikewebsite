import { useStore } from '../../state/store';
import { airDensity } from '../../physics/atmosphere';
import { Segmented, Slider } from '../common';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassName = (deg: number) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

function WindDial({ deg, onChange }: { deg: number; onChange: (d: number) => void }) {
  const set = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    onChange(Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 / 5) * 5);
  };
  return (
    <svg
      viewBox="-50 -50 100 100"
      className="size-24 shrink-0 cursor-pointer touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e);
      }}
      onPointerMove={(e) => e.buttons && set(e)}
      role="slider"
      aria-label="Wind direction"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={deg}
      aria-valuetext={`From ${compassName(deg)}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((deg + 5) % 360);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((deg + 355) % 360);
      }}
    >
      <circle r="44" fill="#f8fafc" stroke="#cbd5e1" />
      {['N', 'E', 'S', 'W'].map((l, i) => (
        <text key={l} x={Math.sin((i * Math.PI) / 2) * 35} y={-Math.cos((i * Math.PI) / 2) * 35} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="#64748b">
          {l}
        </text>
      ))}
      {/* Arrow shows where the wind blows TO, starting from where it comes from */}
      <g transform={`rotate(${deg})`}>
        <line x1="0" y1="-26" x2="0" y2="18" stroke="#2a78d6" strokeWidth="4" strokeLinecap="round" />
        <path d="M0 26 L-8 12 L8 12 Z" fill="#2a78d6" />
      </g>
    </svg>
  );
}

export function ConditionsPanel() {
  const { state, route, setConditions } = useStore();
  const c = state.conditions;
  const altitude = c.altitudeM ?? route.startElevationM;
  const rho = airDensity(c.temperatureC, altitude);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <WindDial deg={c.windFromDeg} onChange={(d) => setConditions({ windFromDeg: d })} />
        <div className="min-w-0 flex-1 space-y-3">
          <Slider label="Wind speed" value={c.windKmh} min={0} max={60} step={1} unit="km/h" onChange={(v) => setConditions({ windKmh: v })} />
          <Slider label="Wind from" value={c.windFromDeg} min={0} max={355} step={5} format={(v) => `${v}° ${compassName(v)}`} onChange={(v) => setConditions({ windFromDeg: v })} />
        </div>
      </div>
      <Slider label="Temperature" value={c.temperatureC} min={0} max={48} step={1} unit="°C" onChange={(v) => setConditions({ temperatureC: v })} />
      <div>
        <Slider
          label="Start altitude"
          value={altitude}
          min={0}
          max={3000}
          step={50}
          unit="m"
          onChange={(v) => setConditions({ altitudeM: v })}
          hint={
            <>
              Air density at the start: <strong>{rho.toFixed(3)} kg/m³</strong> (sea level, 15 °C: 1.225).{' '}
              {c.altitudeM !== null && (
                <button className="font-medium text-brand-700 underline" onClick={() => setConditions({ altitudeM: null })}>
                  Use route’s altitude ({Math.round(route.startElevationM)} m)
                </button>
              )}
            </>
          }
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">Road surface</div>
        <Segmented
          size="sm"
          label="Road surface"
          value={c.surface}
          onChange={(v) => setConditions({ surface: v })}
          options={[
            { value: 'route', label: 'As route' },
            { value: 'smooth', label: 'Smooth' },
            { value: 'rough', label: 'Chip-seal' },
            { value: 'gravel', label: 'Gravel' },
          ]}
        />
      </div>
    </div>
  );
}
