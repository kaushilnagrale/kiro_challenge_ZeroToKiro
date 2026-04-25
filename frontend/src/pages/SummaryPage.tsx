import React from 'react';
import { useStore } from '../store/useStore';

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(0)} m`;
}
function fmtTime(s: number) {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function SummaryPage() {
  const { activeRoute, rideStartTime, rideEndTime, bioReading, weather, reset } = useStore();

  const rideDurationMs = rideStartTime && rideEndTime
    ? rideEndTime.getTime() - rideStartTime.getTime()
    : null;
  const rideDurationMin = rideDurationMs ? Math.round(rideDurationMs / 60000) : null;

  const isPulse = activeRoute?.type === 'pulseroute';
  const mrtSaved = activeRoute?.mrt_differential ?? null;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 pt-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-sky-600 to-sky-800 rounded-2xl p-6 text-white text-center shadow-xl">
        <p className="text-4xl mb-2">🏁</p>
        <h1 className="font-black text-2xl">Ride Complete!</h1>
        {isPulse && (
          <p className="text-sky-200 text-sm mt-1">You rode the heat-safe PulseRoute</p>
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
          <StatCard icon="🌡️" value={`${mrtSaved}°C`} label="MRT saved vs fastest" color="sky" />
        )}
        {activeRoute?.shade_pct && (
          <StatCard icon="🌳" value={`${activeRoute.shade_pct}%`} label="Shade cover" color="green" />
        )}
        {bioReading && (
          <>
            <StatCard icon="💓" value={`${bioReading.hr.toFixed(0)} bpm`} label="Avg HR" />
            <StatCard icon="💧" value={`${bioReading.hrv.toFixed(0)} ms`} label="HRV" />
          </>
        )}
        {weather && (
          <StatCard icon="☀️" value={`${weather.ambient_temp_c.toFixed(0)}°C`} label="Ambient temp" />
        )}
        {activeRoute && (
          <StatCard icon="💧" value={`${activeRoute.water_stops.length}`} label="Water stops passed" />
        )}
      </div>

      {/* PulseRoute impact */}
      {isPulse && mrtSaved !== null && mrtSaved > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-black text-green-800 text-sm mb-1">🌱 Environmental Impact</p>
          <p className="text-sm text-green-700">
            By choosing PulseRoute you experienced <strong>{mrtSaved}°C lower peak MRT</strong> than
            the fastest route — reducing your heat stress and extending safe cycling range in Phoenix's extreme heat.
          </p>
          <p className="text-xs text-green-600 mt-2">
            MRT: Buo, Khan, Middel et al. (2026) "Cool Routes", Building &amp; Environment, ASU
          </p>
        </div>
      )}

      {/* Science notes */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-slate-700 mb-1">Data Sources Used This Ride</p>
        <p>🌤️ Weather: Open-Meteo (open-meteo.com) — real-time, no API key</p>
        <p>🗺️ Map & stops: OpenStreetMap via Overpass API — ODbL license</p>
        <p>🚴 Routing: OSRM public API (router.project-osrm.org) — free</p>
        <p>💓 Biosignals: calibrated simulator · Phase 2 → Apple HealthKit</p>
      </div>

      {/* New ride */}
      <button
        onClick={reset}
        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-colors"
      >
        🚴 Plan Another Ride
      </button>
    </div>
  );
}

function StatCard({
  icon, value, label, color = 'default',
}: {
  icon: string;
  value: string;
  label: string;
  color?: 'default' | 'sky' | 'green';
}) {
  const bg = color === 'sky' ? 'bg-sky-50 border-sky-200'
    : color === 'green' ? 'bg-green-50 border-green-200'
    : 'bg-white border-slate-200';
  const text = color === 'sky' ? 'text-sky-800'
    : color === 'green' ? 'text-green-800'
    : 'text-slate-800';

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-2xl">{icon}</p>
      <p className={`font-black text-xl mt-1 ${text}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
