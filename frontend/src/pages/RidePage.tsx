import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { RouteMap } from '../components/RouteMap';
import { BiosignalPanel } from '../components/BiosignalPanel';
import { StopAlert } from '../components/StopAlert';
import { ProvenanceModal } from '../components/ProvenanceModal';
import { api } from '../api/client';
import { RiskResponse } from '../types';

const POLL_MS = 3000;

export function RidePage() {
  const {
    origin, destination, activeRoute, weather,
    bioSessionId, bioReading, setBioReading,
    riskResponse, setRiskResponse,
    alert, showAlert, dismissAlert,
    provenanceOpen, setProvenanceOpen,
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
            hr: bio.hr,
            hrv: bio.hrv,
            skin_temp_c: bio.skin_temp_c,
            ambient_temp_c: weather.ambient_temp_c,
            ride_minutes: elapsed,
          });
          setRiskResponse(risk);

          if (risk.score !== 'green' && !alert) {
            const nearestStop = activeRoute?.water_stops[0] ?? null;
            showAlert({
              message: risk.score === 'red'
                ? '🚨 Stop soon — hydration risk detected'
                : '⚠️ Consider stopping for water',
              stop: nearestStop,
              reasons: risk.reasons,
            });
          }
        }
      } catch {
        // silently continue polling
      }
      timerRef.current = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [bioSessionId]);

  function handleEndRide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    endRide();
    setPage('summary');
  }

  const score = riskResponse?.score ?? 'green';
  const elapsedMin = rideStartTime ? Math.floor((Date.now() - rideStartTime.getTime()) / 60000) : 0;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      {/* Ride status bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            score === 'red' ? 'bg-red-500' : score === 'yellow' ? 'bg-yellow-400' : 'bg-green-500'
          }`} />
          <span className="text-sm font-bold text-slate-700">Ride in progress</span>
        </div>
        <span className="text-sm text-slate-500">{elapsedMin} min</span>
      </div>

      {/* Map */}
      {destination && (
        <RouteMap
          origin={origin}
          destination={destination}
          activeRoute={activeRoute ?? undefined}
          stops={activeRoute?.water_stops ?? []}
          height="240px"
        />
      )}

      {/* Biosignal panel */}
      <BiosignalPanel
        reading={bioReading}
        score={score}
        onProvenanceTap={() => setProvenanceOpen(true)}
      />

      {/* Alert */}
      {alert && riskResponse && (
        <StopAlert
          message={alert.message}
          stop={alert.stop}
          reasons={alert.reasons}
          score={score}
          onDismiss={dismissAlert}
          onProvenance={() => setProvenanceOpen(true)}
        />
      )}

      {/* Mode switcher (demo only) */}
      <BioModePanel />

      {/* End ride */}
      <button
        onClick={handleEndRide}
        className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors"
      >
        End Ride
      </button>

      <ProvenanceModal
        open={provenanceOpen}
        provenance={riskResponse?.provenance ?? null}
        onClose={() => setProvenanceOpen(false)}
      />
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
    { id: 'baseline' as const, label: 'Hydrated', icon: '😊' },
    { id: 'moderate' as const, label: 'Warm', icon: '🚴' },
    { id: 'dehydrating' as const, label: 'Dehydrating', icon: '🌡️' },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Simulator Mode</p>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`rounded-lg py-2 text-center transition-all ${
              bioMode === m.id
                ? 'bg-sky-100 border-2 border-sky-400 text-sky-800'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <p className="text-lg">{m.icon}</p>
            <p className="text-[10px] font-bold mt-0.5">{m.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
