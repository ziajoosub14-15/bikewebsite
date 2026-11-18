import { useEffect, useMemo, useRef, useState } from 'react';
import { buildGeometry } from '../../physics/route';
import type { Route, SimResult } from '../../physics/types';
import { sampleAtTime } from '../../domain/ride';
import { useElementWidth } from '../common';
import { duration } from '../format';
import { gradeColor } from './grade';

export interface AnimRider {
  name: string;
  color: string;
  sim: SimResult;
}

interface Props {
  route: Route;
  riders: AnimRider[];
  /** Called with the leader's distance, so a chart can show a marker. */
  onPosition?: (distM: number) => void;
  height?: number;
}

const SPEEDS = [1, 5, 15, 30, 60, 120, 300];
/** Metres of road shown in the follow camera. */
const WINDOW_M = 260;
/** Vertical exaggeration in the follow camera so gradients are visible. */
const VEXAG = 2.5;

function drawRider(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, crank: number, scale: number, label?: string, labelRow = 0) {
  const R = 11 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const rear = { x: -19 * scale, y: -R };
  const front = { x: 19 * scale, y: -R };
  const bb = { x: -2 * scale, y: -R + 2 * scale };
  const seat = { x: -8 * scale, y: -R - 17 * scale };
  const head = { x: 15 * scale, y: -R - 17 * scale };
  // wheels
  ctx.lineWidth = 2.6 * scale;
  ctx.strokeStyle = '#1d232b';
  for (const c of [rear, front]) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.stroke();
  }
  // frame
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(rear.x, rear.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.lineTo(seat.x, seat.y);
  ctx.lineTo(rear.x, rear.y);
  ctx.moveTo(bb.x, bb.y);
  ctx.lineTo(head.x - 1 * scale, head.y + 3 * scale);
  ctx.lineTo(seat.x + 1 * scale, seat.y + 2 * scale);
  ctx.moveTo(head.x - 1 * scale, head.y + 3 * scale);
  ctx.lineTo(front.x, front.y);
  ctx.stroke();
  // rider
  const hip = { x: seat.x, y: seat.y - 3 * scale };
  const shoulder = { x: head.x - 7 * scale, y: head.y - 10 * scale };
  const pedal = { x: bb.x + Math.cos(crank) * 6 * scale, y: bb.y + Math.sin(crank) * 6 * scale };
  // knee via simple two-link IK
  const thigh = 13 * scale;
  const shin = 13 * scale;
  const dx = pedal.x - hip.x;
  const dy = pedal.y - hip.y;
  const dist = Math.min(Math.hypot(dx, dy), thigh + shin - 0.01);
  const a = Math.atan2(dy, dx) - Math.acos((thigh * thigh + dist * dist - shin * shin) / (2 * thigh * dist));
  const knee = { x: hip.x + Math.cos(a) * thigh, y: hip.y + Math.sin(a) * thigh };
  ctx.strokeStyle = '#2b2a27';
  ctx.lineWidth = 3.4 * scale;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(knee.x, knee.y);
  ctx.lineTo(pedal.x, pedal.y);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.lineTo(head.x + 1 * scale, head.y + 1 * scale);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(shoulder.x + 4 * scale, shoulder.y - 4 * scale, 3.6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (label) {
    const fs = 11 * Math.min(scale, 1.2);
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const ly = y - (R * 2 + 30 * scale) - labelRow * (fs + 6);
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, ly - fs, w, fs + 6, 4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, ly - fs, 3, fs + 6);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillText(label, x + 1, ly);
  }
}

export function RideAnimation({ route, riders, onPosition, height = 300 }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geo = useMemo(() => buildGeometry(route), [route]);
  const endT = Math.max(...riders.map((r) => r.sim.totalTimeS));
  const autoSpeed = SPEEDS.find((s) => endT / s <= 70) ?? SPEEDS[SPEEDS.length - 1];
  const [speed, setSpeed] = useState(autoSpeed);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);

  // Reset only when the ride itself changes (not on every parent re-render).
  const resetKey = `${route.id}|${riders.map((r) => `${r.name}:${r.sim.totalTimeS.toFixed(3)}`).join('|')}`;
  useEffect(() => {
    tRef.current = 0;
    setT(0);
    setPlaying(false);
    setSpeed(autoSpeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current = Math.min(endT, tRef.current + dt * speed);
      setT(tRef.current);
      if (tRef.current >= endT) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, endT]);

  const states = riders.map((r) => {
    const s = sampleAtTime(r.sim, t);
    const finished = t >= r.sim.totalTimeS;
    return { r, s, finished };
  });
  const leader = states.reduce((a, b) => (b.s.distM > a.s.distM ? b : a), states[0]);

  useEffect(() => {
    onPosition?.(leader?.s.distM ?? 0);
  }, [leader?.s.distM, onPosition]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !leader) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const miniH = 46;
    const camH = height - miniH - 8;
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, camH);
    sky.addColorStop(0, '#e9f3fb');
    sky.addColorStop(1, '#f8fafc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, camH);

    // Follow camera: centre on the leader (or the pack when it fits).
    const ds = states.map((s) => s.s.distM);
    const spread = Math.max(...ds) - Math.min(...ds);
    const windowM = Math.max(WINDOW_M, Math.min(spread * 1.25 + 60, 2000));
    const centre = spread * 1.25 + 60 <= 2000 ? (Math.max(...ds) + Math.min(...ds)) / 2 : leader.s.distM;
    const pxPerM = width / windowM;
    const m0 = centre - windowM / 2;
    const camElev = geo.elevationAt(Math.max(0, Math.min(geo.totalM, centre)));
    const yOf = (d: number) => camH * 0.68 - (geo.elevationAt(Math.max(0, Math.min(geo.totalM, d))) - camElev) * pxPerM * VEXAG;
    const scale = Math.max(0.7, Math.min(1.5, width / 700)) * (windowM > 600 ? 0.85 : 1);

    // Distant hills for depth
    ctx.fillStyle = '#dbe7ef';
    ctx.beginPath();
    ctx.moveTo(0, camH);
    for (let px = 0; px <= width; px += 8) ctx.lineTo(px, camH * 0.55 + Math.sin((px + m0 * 0.3) / 90) * 14 + Math.sin((px + m0 * 0.2) / 37) * 6);
    ctx.lineTo(width, camH);
    ctx.fill();

    // Road and ground, coloured by gradient
    const step = Math.max(2, windowM / width) * 2;
    for (let d = m0; d < m0 + windowM; d += step) {
      if (d < 0 || d > geo.totalM) continue;
      const seg = route.segments[geo.segmentAt(Math.min(d, geo.totalM - 0.01))];
      const x0 = (d - m0) * pxPerM;
      const x1 = (d + step - m0) * pxPerM + 0.5;
      const y0 = yOf(d);
      const y1 = yOf(d + step);
      ctx.fillStyle = gradeColor(seg.gradePct);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1, camH);
      ctx.lineTo(x0, camH);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#3a3936';
    ctx.lineWidth = 4;
    ctx.beginPath();
    let started = false;
    for (let d = Math.max(0, m0); d <= Math.min(geo.totalM, m0 + windowM); d += step / 2) {
      const px = (d - m0) * pxPerM;
      if (!started) ctx.moveTo(px, yOf(d));
      else ctx.lineTo(px, yOf(d));
      started = true;
    }
    ctx.stroke();
    // Start/finish lines
    for (const [d, label] of [[0, 'START'], [geo.totalM, 'FINISH']] as const) {
      if (d < m0 || d > m0 + windowM) continue;
      const px = (d - m0) * pxPerM;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(px - 2, yOf(d) - 60, 4, 60);
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, px, yOf(d) - 66);
    }
    // Distance markers
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#6b6a65';
    ctx.textAlign = 'center';
    const markEvery = windowM > 800 ? 500 : 100;
    for (let d = Math.ceil(m0 / markEvery) * markEvery; d < m0 + windowM; d += markEvery) {
      if (d < 0 || d > geo.totalM) continue;
      const px = (d - m0) * pxPerM;
      ctx.fillRect(px - 0.5, yOf(d) + 4, 1, 6);
      ctx.fillText(`${(d / 1000).toFixed(1)} km`, px, Math.min(camH - 4, yOf(d) + 22));
    }

    // Riders (back to front so the leader is on top). Labels stack when riders are close together.
    const sorted = [...states].sort((a, b) => a.s.distM - b.s.distM);
    const placed: { x: number; row: number }[] = [];
    sorted.forEach(({ r, s }) => {
      const px = (s.distM - m0) * pxPerM;
      const ahead = s.distM + 5;
      const behind = s.distM - 5;
      const ang = Math.atan2(yOf(ahead) - yOf(behind), 10 * pxPerM);
      const crank = s.coasting ? 0.6 : s.distM / 1.2;
      let row = 0;
      while (placed.some((p) => p.row === row && Math.abs(p.x - px) < 150)) row++;
      placed.push({ x: px, row });
      drawRider(ctx, px, yOf(s.distM) - 2, ang, r.color, crank, scale, riders.length > 1 ? r.name : undefined, row);
    });

    // Mini map
    const my = camH + 8;
    ctx.fillStyle = '#f5f4f1';
    ctx.fillRect(0, my, width, miniH);
    const eMin = Math.min(...geo.segStartElevM, geo.elevationAt(geo.totalM));
    const eMax = Math.max(...geo.segStartElevM, geo.elevationAt(geo.totalM));
    const myOf = (d: number) => my + miniH - 6 - ((geo.elevationAt(d) - eMin) / Math.max(eMax - eMin, 1)) * (miniH - 14);
    ctx.beginPath();
    ctx.moveTo(0, my + miniH);
    for (let px = 0; px <= width; px += 2) ctx.lineTo(px, myOf((px / width) * geo.totalM));
    ctx.lineTo(width, my + miniH);
    ctx.fillStyle = '#d9d7d0';
    ctx.fill();
    ctx.fillStyle = 'rgba(11,11,11,0.08)';
    ctx.fillRect((Math.max(0, m0) / geo.totalM) * width, my, (windowM / geo.totalM) * width, miniH);
    for (const { r, s } of states) {
      const px = (s.distM / geo.totalM) * width;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, myOf(s.distM), 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(px, myOf(s.distM), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [t, width, height, states, leader, geo, route, riders.length, riders]);

  return (
    <div>
      <div ref={wrapRef} className="overflow-hidden rounded-xl border border-slate-200">
        <canvas ref={canvasRef} style={{ width, height, display: 'block' }} role="img" aria-label="Side-view animation of the ride" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            if (tRef.current >= endT) {
              tRef.current = 0;
              setT(0);
            }
            setPlaying((p) => !p);
          }}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {playing ? (
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          )}
          {playing ? 'Pause' : t >= endT ? 'Replay' : t > 0 ? 'Resume' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={endT}
          step={1}
          value={t}
          onChange={(e) => {
            tRef.current = Number(e.target.value);
            setT(tRef.current);
          }}
          className="min-w-32 flex-1 accent-brand-600"
          aria-label="Ride time"
        />
        <span className="w-16 text-right text-sm tabular-nums text-slate-600">{duration(t)}</span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}× speed
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-semibold">{riders.length > 1 ? 'Rider' : 'Live'}</th>
              <th className="py-1 pr-2 text-right font-semibold">Speed</th>
              <th className="py-1 pr-2 text-right font-semibold">Power</th>
              <th className="py-1 pr-2 text-right font-semibold">Gradient</th>
              <th className="py-1 pr-2 text-right font-semibold">Distance</th>
              {riders.length > 1 && <th className="py-1 text-right font-semibold">Gap</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...states]
              .sort((a, b) => b.s.distM - a.s.distM || a.r.sim.totalTimeS - b.r.sim.totalTimeS)
              .map(({ r, s, finished }, idx) => {
                const gapM = leader.s.distM - s.distM;
                const gapS = finished ? r.sim.totalTimeS - Math.min(...riders.map((x) => x.sim.totalTimeS)) : s.speedMs > 0 ? gapM / s.speedMs : 0;
                return (
                  <tr key={r.name} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="truncate font-medium">{r.name}</span>
                        {finished && <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">FINISHED</span>}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold">{finished ? '–' : `${(s.speedMs * 3.6).toFixed(1)} km/h`}</td>
                    <td className="py-1.5 pr-2 text-right">{finished ? '–' : s.braking ? <span className="font-semibold text-rose-600">Braking</span> : s.coasting ? <span className="text-slate-500">Coasting</span> : `${Math.round(s.powerW)} W`}</td>
                    <td className="py-1.5 pr-2 text-right">{s.gradePct > 0 ? '+' : ''}{s.gradePct.toFixed(1)}%</td>
                    <td className="py-1.5 pr-2 text-right">{(s.distM / 1000).toFixed(2)} km</td>
                    {riders.length > 1 && <td className="py-1.5 text-right">{finished && gapS < 0.5 ? duration(r.sim.totalTimeS) : idx === 0 ? 'Leader' : `+${duration(gapS)}`}</td>}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
