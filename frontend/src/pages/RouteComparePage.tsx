import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { RouteMap } from '../components/RouteMap';
import { api } from '../api/client';

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
const toF = (c: number): string => `${((c * 9 / 5) + 32).toFixed(0)}°F`;
const toFnum = (c: number): number => (c * 9 / 5) + 32;

export function RouteComparePage() {
  const {
    origin, destination, destinationLabel,
    routeResponse, setActiveRoute, weather,
    setBioSession, setPage, startRide,
  } = useStore();

  const [selectedType, setSelectedType] = useState<'fastest' | 'pulseroute'>('pulseroute');
  const [showMrtInfo, setShowMrtInfo] = useState(false);

  if (!routeResponse || !destination) return null;

  const { fastest, pulseroute } = routeResponse;
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

  const mrtSaveC  = fastest.peak_mrt_c - pulseroute.peak_mrt_c;
  const mrtSaveF  = (mrtSaveC * 9 / 5).toFixed(1);   // difference, not absolute → just scale by 9/5
  const timeDiff  = pulseroute.duration_s - fastest.duration_s;

  // Solar inputs for MRT explainer
  const iDir   = weather?.direct_radiation  ?? 0;
  const iDif   = weather?.diffuse_radiation ?? 0;
  const cloud  = weather?.cloud_cover       ?? 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Map */}
      <RouteMap
        origin={origin}
        destination={destination}
        fastest={fastest}
        pulseroute={pulseroute}
        selectedType={selectedType}
        stops={selected.water_stops}
        height="280px"
      />

      {/* Weather bar */}
      {weather && (
        <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between ${
          weather.ambient_temp_c >= 38
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <span className={`text-sm font-bold ${weather.ambient_temp_c >= 38 ? 'text-red-400' : 'text-orange-400'}`}>
            🌡️ {toF(weather.ambient_temp_c)} now
          </span>
          <span className="text-xs text-[#7d8590]">
            {weather.advisory ?? `Feels like ${toF(weather.heat_index_c)}`}
          </span>
        </div>
      )}

      {/* Route cards */}
      <div className="grid grid-cols-2 gap-3">
        <RouteCard
          route={fastest}
          label="Fastest"
          accent="red"
          selected={selectedType === 'fastest'}
          onSelect={() => setSelectedType('fastest')}
        />
        <RouteCard
          route={pulseroute}
          label="PulseRoute"
          accent="sky"
          selected={selectedType === 'pulseroute'}
          onSelect={() => setSelectedType('pulseroute')}
          badge={mrtSaveC > 0 ? `${mrtSaveF}°F cooler` : undefined}
        />
      </div>

      {/* PulseRoute stats + MRT info */}
      {selectedType === 'pulseroute' && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">PulseRoute Advantage</p>
            <button
              onClick={() => setShowMrtInfo(!showMrtInfo)}
              className="text-[10px] text-[#7d8590] hover:text-sky-400 font-semibold transition-colors"
            >
              {showMrtInfo ? 'Hide' : 'How is MRT calculated? →'}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat icon="🌡️" value={toF(pulseroute.peak_mrt_c)} label="Peak MRT" hot={pulseroute.peak_mrt_c > 46} />
            <Stat icon="🌳" value={`${pulseroute.shade_pct}%`} label="Shade" />
            <Stat icon="💧" value={`${pulseroute.water_stops.length}`} label="Stops" />
            <Stat icon="⏱️" value={timeDiff > 0 ? `+${fmtTime(timeDiff)}` : fmtTime(pulseroute.duration_s)} label="Extra" />
          </div>

          {/* MRT formula explainer */}
          {showMrtInfo && (
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-3 text-xs">
              <p className="font-bold text-sky-400 uppercase tracking-wider text-[10px]">MRT Calculation — Live Data</p>

              {/* Solar inputs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#161b22] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-[#7d8590]">Direct Solar</p>
                  <p className="font-bold text-yellow-400">{iDir.toFixed(0)} W/m²</p>
                </div>
                <div className="bg-[#161b22] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-[#7d8590]">Diffuse Solar</p>
                  <p className="font-bold text-sky-400">{iDif.toFixed(0)} W/m²</p>
                </div>
                <div className="bg-[#161b22] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-[#7d8590]">Cloud Cover</p>
                  <p className="font-bold text-gray-400">{cloud.toFixed(0)}%</p>
                </div>
              </div>

              {/* Formula */}
              <div className="border border-[#30363d] rounded-lg p-3 space-y-1.5">
                <p className="text-[#7d8590] font-semibold">Formula (Fanger 1972, outdoor form):</p>
                <p className="font-mono text-[#e6edf3]">Tmrt⁴ = Tair⁴ + (α / ε·σ) × S_absorbed</p>
                <div className="text-[#4d5562] space-y-0.5 mt-1">
                  <p>α = 0.70 — body shortwave absorptivity</p>
                  <p>ε = 0.97 — body longwave emissivity</p>
                  <p>σ = 5.67×10⁻⁸ — Stefan-Boltzmann constant</p>
                  <p>S_absorbed = body_area_factor × (I_direct + I_diffuse + I_reflected)</p>
                </div>
              </div>

              {/* Per-route result */}
              <div className="space-y-1.5">
                <RouteCalcRow
                  label="Fastest"
                  shade={fastest.shade_pct}
                  mrt_c={fastest.peak_mrt_c}
                  iDir={iDir}
                  color="text-red-400"
                />
                <RouteCalcRow
                  label="PulseRoute"
                  shade={pulseroute.shade_pct}
                  mrt_c={pulseroute.peak_mrt_c}
                  iDir={iDir}
                  color="text-sky-400"
                />
              </div>

              <p className="text-[#4d5562] text-[10px]">
                Shade % = structural shade (road type) + cloud cover bonus.
                Direct radiation reduced by shade fraction; diffuse partially available in shade.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Destination row */}
      <div className="flex items-center gap-3 bg-[#161b22] border border-[#30363d] rounded-xl p-3">
        <span className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-sm">🏁</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-[#7d8590]">Destination</p>
          <p className="font-semibold text-white truncate">{destinationLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-white">{fmtDist(selected.distance_m)}</p>
          <p className="text-xs text-[#7d8590]">{fmtTime(selected.duration_s)}</p>
        </div>
      </div>

      <button
        onClick={handleStartRide}
        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all"
      >
        🚴 Start on {selectedType === 'pulseroute' ? 'PulseRoute' : 'Fastest Route'}
      </button>
    </div>
  );
}

function RouteCalcRow({
  label, shade, mrt_c, iDir, color,
}: {
  label: string; shade: number; mrt_c: number; iDir: number; color: string;
}) {
  const directUsed = (iDir * (1 - shade / 100)).toFixed(0);
  return (
    <div className="flex items-center gap-2 bg-[#161b22] rounded-lg px-3 py-2">
      <span className={`font-bold text-xs w-20 shrink-0 ${color}`}>{label}</span>
      <span className="text-[#4d5562] text-[10px]">
        {shade}% shade → Direct used: {directUsed} W/m²
      </span>
      <span className={`ml-auto font-black text-sm shrink-0 ${color}`}>{toF(mrt_c)}</span>
    </div>
  );
}

function RouteCard({
  route, label, accent, selected, onSelect, badge,
}: {
  route: { distance_m: number; duration_s: number; peak_mrt_c: number; shade_pct: number };
  label: string;
  accent: 'red' | 'sky';
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}) {
  const activeBorder = accent === 'sky' ? 'border-sky-500 bg-sky-500/10' : 'border-red-500 bg-red-500/10';
  const activeText   = accent === 'sky' ? 'text-sky-400' : 'text-red-400';
  const mrtF = toFnum(route.peak_mrt_c);
  const mrtColor = mrtF > 131 ? 'text-red-400' : mrtF > 113 ? 'text-orange-400' : 'text-yellow-400';

  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border-2 p-3 text-left transition-all w-full ${
        selected ? activeBorder : 'border-[#30363d] bg-[#161b22] hover:border-[#4d5562]'
      }`}
    >
      {badge && (
        <span className="inline-block bg-green-500/15 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1.5 border border-green-500/30">
          {badge}
        </span>
      )}
      <p className={`font-black text-sm ${selected ? activeText : 'text-[#e6edf3]'}`}>{label}</p>
      <p className="text-xs text-[#7d8590] mt-1">{fmtDist(route.distance_m)}</p>
      <p className="text-xs text-[#7d8590]">{fmtTime(route.duration_s)}</p>
      <p className={`text-xs font-bold mt-1.5 ${mrtColor}`}>MRT {toF(route.peak_mrt_c)}</p>
      <p className="text-[10px] text-[#4d5562] mt-0.5">🌳 {route.shade_pct}% shade</p>
    </button>
  );
}

function Stat({ icon, value, label, hot }: { icon: string; value: string; label: string; hot?: boolean }) {
  return (
    <div className="bg-[#0d1117] rounded-lg p-2">
      <p className="text-base">{icon}</p>
      <p className={`font-black text-sm mt-0.5 ${hot ? 'text-orange-400' : 'text-sky-400'}`}>{value}</p>
      <p className="text-[10px] text-[#7d8590]">{label}</p>
    </div>
  );
}
