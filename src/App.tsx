import { useEffect, useState } from 'react';
import { StoreProvider } from './state/store';
import { BuilderPage } from './ui/builder/BuilderPage';
import { RiderPage } from './ui/rider/RiderPage';
import { RidePage } from './ui/ride/RidePage';
import { RacePage } from './ui/race/RacePage';
import { BudgetPage } from './ui/budget/BudgetPage';
import { CatalogTable } from './ui/CatalogTable';

const TABS = [
  { id: 'build', label: 'Build', icon: 'M4 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M14 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M7 17l3-7h6l1 7M10 10l-2-3h-2M16 10l1-3h2' },
  { id: 'rider', label: 'Rider & fit', icon: 'M12 5a2 2 0 1 0 0.01 0M8 21l2-6l2-2l2 4v4M10 15l-2-4l4-2l3 3h3' },
  { id: 'ride', label: 'Ride sim', icon: 'M3 18l5-8l4 5l3-4l6 7z' },
  { id: 'race', label: 'Race', icon: 'M5 21V4M5 4h11l-2 4l2 4H5' },
  { id: 'budget', label: 'Budget', icon: 'M4 7h16v12H4zM4 11h16M8 15h3' },
  { id: 'parts', label: 'Parts', icon: 'M4 6h16M4 12h16M4 18h10' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const tabFromHash = (): Tab => {
  const h = location.hash.replace('#/', '');
  return (TABS.find((t) => t.id === h)?.id ?? 'build') as Tab;
};

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => {
    location.hash = `/${t}`;
    window.scrollTo({ top: 0 });
  };

  return (
    <StoreProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
            <h1 className="shrink-0 text-lg font-black tracking-tight">
              <span className="text-brand-600">Velo</span>lab
            </h1>
            <nav className="-mr-4 flex gap-1 overflow-x-auto pr-4 sm:mr-0 sm:pr-0" aria-label="Sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <svg viewBox="0 0 24 24" className="hidden size-4 sm:block" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={t.icon} />
                  </svg>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5">
          {tab === 'build' && <BuilderPage />}
          {tab === 'rider' && <RiderPage />}
          {tab === 'ride' && <RidePage />}
          {tab === 'race' && <RacePage />}
          {tab === 'budget' && <BudgetPage />}
          {tab === 'parts' && <CatalogTable />}
        </main>
      </div>
    </StoreProvider>
  );
}
