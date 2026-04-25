import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { RouteMap } from '../components/RouteMap';
import { BiosignalPanel } from '../components/BiosignalPanel';
import { StopAlert } from '../components/StopAlert';
import { api } from '../api/client';
import { RiskResponse } from '../types';

const POLL_MS = 3000;
const M_TO_MI = 0.000621371;
const M_TO_FT = 3.28084;

function fmtDist(m: number): string {
  if (m < 500) return `${Math.round(m * M_TO_FT)} ft`;
  return `${(m * M_TO_MI).toFixed(2)} mi`;
}

export function RidePage() {
  const {
    origin, destination, activeRoute, weather,
    bioSessionId, bioReading, setBioReading,
    riskResponse, setRiskResponse,
    alert, showAlert, dismissAlert,
    rideStartTime, endRide, setPage,
  } = useStore();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bioSessionId) return;

    async function tick() {
      try {
        const bio = await api.readBio(bioSessionId!);
        setBioReading(bio);

        if (weather) {
          const elapsed = rideStartTime ? (Date.now() - rideStartTime.getTime()) / 60000 : 0;
          const risk: RiskResponse = await api.fetchRisk({
            hr: bio.hr, hrv: bio.hrv, skin_temp_c: bio.skin_temp_c,
            ambient_temp_c: weather.ambient_temp_c, ride_minutes: elapsed,
          });
          setRiskResponse(risk);

          if (risk.score !== 'green' && !alert) {
            const nearestStop = activeRoute?.water_stops[0] ?? null;
            showAlert({
              message: risk.score === 'red' ? 'Stop soon — hydration risk' : 'Consider stopping for water',
              stop: nearestStop,
              reasons: risk.reasons,
            });
          }
        }
      } catch { /* continue polling */ }
      timerRef.current = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [bioSessionId]);

  function handleEndRide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    endRide(); setPage('summary');
  }

  const score = riskResponse?.score ?? 'green';
  const elapsedMin = rideStartTime ? Math.floor((Date.now() - rideStartTime.getTime()) / 60000) : 0;
  const dotColor = score === 'red' ? 'bg-red-500' : score === 'yellow' ? 'bg-yellow-400' : 'bg-green-500';

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      {/* Status bar */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${dotColor}`} />
          <span className="text-sm font-bold text-white">Ride in progress</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#7d8590]">
          <span>{elapsedMin} min</span>
          {activeRoute && <span>{fmtDist(activeRoute.distance_m)}</span>}
        </div>
      </div>

      {/* Map */}
      {destination && (
        <RouteMap
          origin={origin}
          destination={destination}
          activeRoute={activeRoute ?? undefined}
          stops={activeRoute?.water_stops ?? []}
          height="230px"
        />
      )}

      {/* Biosignal panel */}
      <BiosignalPanel reading={bioReading} score={score} />

      {/* Alert */}
      {alert && (
        <StopAlert
          message={alert.message}
          stop={alert.stop}
          reasons={alert.reasons}
          score={score}
          onDismiss={dismissAlert}
        />
      )}

      {/* Simulator mode switcher */}
      <BioModePanel />

      {/* End ride */}
      <button
        onClick={handleEndRide}
        className="w-full bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#e6edf3] font-bold py-3.5 rounded-xl transition-colors"
      >
        End Ride
      </button>
    </div>
  );
}

function BioModePanel() {
  const { bioMode, setBioMode, bioSessionId } = useStore();

  async function switchMode(mode: 'baseline' | 'moderate' | 'dehydrating') {
    setBioMode(mode);
    if (bioSessionId) {
      try { await api.startBioSession(mode); } catch { /* ignore */ }
    }
  }

  const modes = [
    { id: 'baseline'    as const, label: 'Hydrated',    icon: '😊' },
    { id: 'moderate'    as const, label: 'Warm',        icon: '🚴' },
    { id: 'dehydrating' as const, label: 'Dehydrating', icon: '🌡️' },
  ];

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
      <p className="text-[10px] font-bold text-[#7d8590] uppercase tracking-widest mb-2">Simulator Mode</p>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`rounded-xl py-2.5 text-center transition-all border ${
              bioMode === m.id
                ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                : 'bg-[#0d1117] border-[#30363d] text-[#7d8590] hover:border-[#4d5562]'
            }`}
          >
            <p className="text-xl">{m.icon}</p>
            <p className="text-[10px] font-bold mt-1">{m.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
