import React from 'react';
import { useStore } from './store/useStore';
import { SearchPage } from './pages/SearchPage';
import { RouteComparePage } from './pages/RouteComparePage';
import { RidePage } from './pages/RidePage';
import { SummaryPage } from './pages/SummaryPage';

export function App() {
  const page = useStore((s) => s.page);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Brand header */}
      <header className="bg-sky-700 text-white px-4 py-3 flex items-center gap-2 shadow-md">
        <span className="text-xl">🚴</span>
        <span className="font-black text-lg tracking-tight">PulseRoute</span>
        <span className="text-sky-300 text-xs ml-1">Phoenix Heat Co-pilot</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        {page === 'search'  && <SearchPage />}
        {page === 'compare' && <RouteComparePage />}
        {page === 'ride'    && <RidePage />}
        {page === 'summary' && <SummaryPage />}
      </main>
    </div>
  );
}
