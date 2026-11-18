import { useState } from 'react';
import { catalog } from '../data/catalog';
import { CATEGORIES, type Category } from '../types/components';
import { aed } from './format';

const LABELS: Record<Category, string> = {
  frame: 'Frames',
  wheels: 'Wheels',
  groupset: 'Groupsets',
  rearDerailleur: 'Rear derailleurs',
  handlebars: 'Handlebars',
  saddle: 'Saddles',
  tyres: 'Tyres',
};

export function CatalogTable() {
  const [cat, setCat] = useState<Category>('frame');
  const rows = catalog[cat];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              cat === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {LABELS[c]} <span className="opacity-60">{catalog[c].length}</span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Weight</th>
              <th className="px-4 py-3 text-right">CdA Δ</th>
              <th className="px-4 py-3 text-right">Comfort</th>
              <th className="px-4 py-3 text-right">Stiffness</th>
              <th className="px-4 py-3">Compatibility</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{r.brand}</div>
                  <div className="font-medium">{r.name}</div>
                  <div className="max-w-sm text-xs text-slate-500">{r.description}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{aed(r.price)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.weight} g</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.cdaDelta > 0 ? '+' : ''}
                  {r.cdaDelta.toFixed(3)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.comfort}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.stiffness}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {Object.entries(r.compat)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ') || '—'}
                  {'crr' in r && <div>Crr {r.crr} · {r.widthMm} mm · {r.recommendedPressureBar} bar</div>}
                  {'maxTyreWidthMm' in r && <div>tyres ≤ {r.maxTyreWidthMm} mm</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
