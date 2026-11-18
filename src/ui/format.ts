export const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;
export const kmh = (ms: number) => `${(ms * 3.6).toFixed(1)} km/h`;
export const kg = (n: number) => `${n.toFixed(2)} kg`;
export function duration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
