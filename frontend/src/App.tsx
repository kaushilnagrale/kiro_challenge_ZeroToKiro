import React from 'react';
import { useStore } from './store/useStore';
import { SearchPage } from './pages/SearchPage';
import { RouteComparePage } from './pages/RouteComparePage';
import { RidePage } from './pages/RidePage';
import { SummaryPage } from './pages/SummaryPage';

export function App() {
  const page = useStore((s) => s.page);

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <header className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-lg">🚴</div>
        <div>
          <span className="font-black text-white tracking-tight">PulseRoute</span>
          <span className="text-[#7d8590] text-xs ml-2">Heat-Safe Cycling</span>
        </div>
        <div className="ml-auto">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            page === 'ride'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-[#21262d] text-[#7d8590] border border-[#30363d]'
          }`}>
            {page === 'search' ? 'Plan' : page === 'compare' ? 'Compare' : page === 'ride' ? '● Live' : 'Summary'}
          </span>
        </div>
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
