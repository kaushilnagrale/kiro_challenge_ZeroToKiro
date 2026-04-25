import React from 'react';
import { useStore } from '../store/useStore';
import { RouteMap } from '../components/RouteMap';
import { ProvenanceModal } from '../components/ProvenanceModal';
import { api } from '../api/client';

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(0)} m`;
}
function fmtTime(s: number) {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function RouteComparePage() {
  const {
    origin, destination, destinationLabel,
    routeResponse, setActiveRoute, weather,
    provenanceOpen, setProvenanceOpen,
    setBioSession, setPage, startRide,
  } = useStore();

  const [selectedType, setSelectedType] = React.useState<'fastest' | 'pulseroute'>('pulseroute');

  if (!routeResponse || !destination) return null;

  const { fastest, pulseroute, provenance } = routeResponse;
  const selected = selectedType === 'pulseroute' ? pulseroute : fastest;

  async function handleStartRide() {
    setActiveRoute(selected);
    try {
      const { session_id, mode } = await api.startBioSession('baseline');
      setBioSession(session_id, mode);
    } catch {
      setBioSession(`local-${Date.now()}`, 'baseline');
    }
    startRide();
    setPage('ride');
  }

  const mrtSave = pulseroute.peak_mrt_c && fastest.peak_mrt_c
    ? (fastest.peak_mrt_c - pulseroute.peak_mrt_c).toFixed(1)
    : null;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Map */}
      <RouteMap
        origin={origin}
        destination={destination}
        fastest={fastest}
        pulseroute={pulseroute}
        selectedType={selectedType}
        stops={pulseroute.water_stops}
        height="280px"
      />

      {/* Weather bar */}
      {weather && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-amber-800">🌡️ {weather.ambient_temp_c.toFixed(0)}°C now</span>
          <span className="text-xs text-amber-600">{weather.advisory ?? `Heat index ${weather.heat_index_c.toFixed(0)}°C`}</span>
        </div>
      )}

      {/* Route cards */}
      <div className="grid grid-cols-2 gap-3">
        <RouteCard
          route={fastest}
          label="Fastest"
          color="red"
          selected={selectedType === 'fastest'}
          onSelect={() => setSelectedType('fastest')}
        />
        <RouteCard
          route={pulseroute}
          label="PulseRoute"
          color="sky"
          selected={selectedType === 'pulseroute'}
          onSelect={() => setSelectedType('pulseroute')}
          badge={mrtSave ? `${mrtSave}°C cooler` : undefined}
        />
      </div>

      {/* Why panel */}
      {selectedType === 'pulseroute' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-black text-sky-700 uppercase tracking-wider">Why PulseRoute?</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat icon="🌡️" value={`${pulseroute.peak_mrt_c}°C`} label="Peak MRT" />
            <Stat icon="🌳" value={`${pulseroute.shade_pct}%`} label="Shade cover" />
            <Stat icon="💧" value={`${pulseroute.water_stops.length}`} label="Water stops" />
            <Stat icon="⏱️" value={`+${fmtTime(pulseroute.duration_s - fastest.duration_s)}`} label="Extra time" />
          </div>
          <p className="text-xs text-sky-600 text-center">
            MRT methodology: Buo, Khan, Middel et al. (2026) "Cool Routes", ASU
          </p>
        </div>
      )}

      {/* Destination label */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-3">
        <span className="text-red-500">🏁</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">Destination</p>
          <p className="font-semibold text-slate-800 truncate">{destinationLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{fmtDist(selected.distance_m)}</p>
          <p className="text-xs text-slate-500">{fmtTime(selected.duration_s)}</p>
        </div>
      </div>

      {/* Provenance */}
      <button
        onClick={() => setProvenanceOpen(true)}
        className="w-full text-xs text-sky-600 font-bold underline text-center py-1"
      >
        Data sources &amp; accountability logic gate →
      </button>

      {/* Start ride */}
      <button
        onClick={handleStartRide}
        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-colors"
      >
        🚴 Start Ride on {selectedType === 'pulseroute' ? 'PulseRoute' : 'Fastest Route'}
      </button>

      <ProvenanceModal
        open={provenanceOpen}
        provenance={provenance}
        onClose={() => setProvenanceOpen(false)}
      />
    </div>
  );
}

function RouteCard({
  route, label, color, selected, onSelect, badge,
}: {
  route: { distance_m: number; duration_s: number; peak_mrt_c: number; shade_pct: number };
  label: string;
  color: 'red' | 'sky';
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}) {
  const ring = color === 'sky' ? 'border-sky-500 bg-sky-50' : 'border-red-400 bg-red-50';
  const inactive = 'border-slate-200 bg-white';
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border-2 p-3 text-left transition-all w-full ${selected ? ring : inactive}`}
    >
      {badge && (
        <span className="inline-block bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">
          {badge}
        </span>
      )}
      <p className={`font-black text-sm ${selected ? (color === 'sky' ? 'text-sky-700' : 'text-red-700') : 'text-slate-700'}`}>
        {label}
      </p>
      <p className="text-xs text-slate-500 mt-1">{fmtDist(route.distance_m)}</p>
      <p className="text-xs text-slate-500">{fmtTime(route.duration_s)}</p>
      <p className="text-xs font-bold mt-1" style={{ color: route.peak_mrt_c > 50 ? '#ef4444' : '#f97316' }}>
        MRT {route.peak_mrt_c}°C
      </p>
    </button>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-white rounded-lg p-2">
      <p className="text-lg">{icon}</p>
      <p className="font-black text-sky-800 text-sm">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
