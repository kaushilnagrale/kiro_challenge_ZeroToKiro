import React from 'react';
import { useStore } from '../store/useStore';

const M_TO_MI = 0.000621371;
const M_TO_FT = 3.28084;

function fmtDist(m: number): string {
  if (m < 500) return `${Math.round(m * M_TO_FT)} ft`;
  return `${(m * M_TO_MI).toFixed(2)} mi`;
}
function fmtTime(s: number): string {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function SummaryPage() {
  const { activeRoute, rideStartTime, rideEndTime, bioReading, weather, reset } = useStore();

  const rideDurationMs = rideStartTime && rideEndTime
    ? rideEndTime.getTime() - rideStartTime.getTime() : null;
  const rideDurationMin = rideDurationMs ? Math.round(rideDurationMs / 60000) : null;

  const isPulse  = activeRoute?.type === 'pulseroute';
  const mrtSaved = activeRoute?.mrt_differential ?? null;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 pt-6">
      {/* Hero */}
      <div className="relative bg-[#161b22] border border-[#30363d] rounded-2xl p-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent" />
        <p className="text-5xl mb-3">🏁</p>
        <h1 className="font-black text-2xl text-white">Ride Complete</h1>
        {isPulse && (
          <p className="text-sky-400 text-sm mt-1.5">Heat-safe PulseRoute</p>
        )}
        {mrtSaved !== null && mrtSaved > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 rounded-full px-3 py-1">
            <span className="text-green-400 text-sm font-bold">{(mrtSaved * 9/5).toFixed(1)}°F cooler than fastest route</span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {activeRoute && (
          <>
            <StatCard icon="📏" value={fmtDist(activeRoute.distance_m)} label="Distance" />
            <StatCard icon="⏱️" value={rideDurationMin ? `${rideDurationMin} min` : fmtTime(activeRoute.duration_s)} label="Ride time" />
          </>
        )}
        {mrtSaved !== null && mrtSaved > 0 && (
          <StatCard icon="🌡️" value={`${(mrtSaved * 9/5).toFixed(1)}°F`} label="MRT saved" accent="sky" />
        )}
        {activeRoute?.shade_pct != null && (
          <StatCard icon="🌳" value={`${activeRoute.shade_pct}%`} label="Shade cover" accent="green" />
        )}
        {bioReading && (
          <>
            <StatCard icon="💓" value={`${bioReading.hr.toFixed(0)} bpm`} label="Avg heart rate" />
            <StatCard icon="📊" value={`${bioReading.hrv.toFixed(0)} ms`} label="HRV" />
          </>
        )}
        {weather && (
          <StatCard icon="☀️" value={`${((weather.ambient_temp_c * 9/5) + 32).toFixed(0)}°F`} label="Ambient temp" />
        )}
        {activeRoute && (
          <StatCard icon="💧" value={String(activeRoute.water_stops.length)} label="Water stops" />
        )}
      </div>

      {/* MRT impact */}
      {isPulse && mrtSaved !== null && mrtSaved > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="font-bold text-green-400 text-sm mb-1.5">🌱 Heat Exposure Reduced</p>
          <p className="text-sm text-[#7d8590] leading-relaxed">
            By riding PulseRoute you experienced{' '}
            <span className="text-white font-semibold">{(mrtSaved * 9/5).toFixed(1)}°F lower peak radiant temperature</span>{' '}
            than the direct route — reducing core heat load during your ride.
          </p>
        </div>
      )}

      {/* Data sources */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <p className="text-[10px] font-bold text-[#7d8590] uppercase tracking-widest mb-2">Data Sources</p>
        <div className="space-y-1 text-xs text-[#4d5562]">
          <p>🌤️ Weather — Open-Meteo (open-meteo.com)</p>
          <p>🗺️ Stops — OpenStreetMap / Overpass API</p>
          <p>🚴 Routes — OSRM public API</p>
          <p>💓 Biosignals — calibrated simulator</p>
        </div>
      </div>

      <button
        onClick={reset}
        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all"
      >
        🚴 Plan Another Ride
      </button>
    </div>
  );
}

function StatCard({
  icon, value, label, accent = 'default',
}: {
  icon: string; value: string; label: string; accent?: 'default' | 'sky' | 'green';
}) {
  const bg   = accent === 'sky'   ? 'bg-sky-500/10 border-sky-500/20'
             : accent === 'green' ? 'bg-green-500/10 border-green-500/20'
             : 'bg-[#161b22] border-[#30363d]';
  const text = accent === 'sky'   ? 'text-sky-400'
             : accent === 'green' ? 'text-green-400'
             : 'text-white';
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-2xl">{icon}</p>
      <p className={`font-black text-xl mt-1 ${text}`}>{value}</p>
      <p className="text-xs text-[#7d8590] mt-0.5">{label}</p>
    </div>
  );
}
