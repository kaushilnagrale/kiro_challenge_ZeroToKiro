import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { tickBiosim, classifyRisk } from '../lib/biosim'
import { RiskBadge } from '../components/RiskBadge'
import type { BioMode, SafetyAlert } from '../types'

const AMBIENT_TEMP = 41
const ALERT_INTERVAL_MS = 18000

export function LiveTracking() {
  const {
    biosignal, setBiosignal, riskLevel, setRiskLevel,
    bioMode, setBioMode, alerts, addAlert, dismissAlert,
    setProvenanceModal, endRide, setScreen, addRideRecord,
    profile, selectedRoute, destination, origin,
  } = useStore()

  const [rideMin, setRideMin] = useState(0)
  const [showDebug, setShowDebug] = useState(false)
  const lastAlertRef = useRef(0)
  const startRef = useRef(Date.now())

  // Biosignal tick every second
  useEffect(() => {
    const id = setInterval(() => {
      const bio = tickBiosim(bioMode)
      setBiosignal(bio)
      const { level } = classifyRisk(bio, profile?.baseline_hr ?? 65, AMBIENT_TEMP, rideMin)
      setRiskLevel(level)
      setRideMin(Math.floor((Date.now() - startRef.current) / 60000))

      // Fire alert if risk elevated and enough time has passed
      const now = Date.now()
      if ((level === 'yellow' || level === 'red') && now - lastAlertRef.current > ALERT_INTERVAL_MS) {
        lastAlertRef.current = now
        const alert: SafetyAlert = {
          id: `a-${now}`,
          message: level === 'red'
            ? `Water fountain ahead in 280m. HR elevated for ${rideMin} min.`
            : `Upcoming heat zone. Consider stopping at next fountain.`,
          risk: level,
          timestamp: new Date().toISOString(),
          stop: { id: 's1', type: 'fountain', name: 'Mill Ave Fountain', lat: 33.4195, lng: -111.9440, distance_m: 280 },
          provenance: {
            biosignal_source: 'PulseRoute BioSim v1',
            biosignal_ts: new Date().toISOString(),
            env_source: 'Open-Meteo / NWS',
            env_ts: new Date(Date.now() - 5 * 60000).toISOString(),
            route_segment_id: `seg-${Math.floor(Math.random() * 100)}`,
          },
        }
        addAlert(alert)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [bioMode, rideMin])

  function handleEndRide() {
    endRide()
    addRideRecord({
      id: `r-${Date.now()}`,
      date: new Date().toISOString(),
      origin,
      destination,
      distance_km: selectedRoute === 'pulseroute' ? 5.1 : 4.2,
      duration_min: rideMin || 1,
      exposure_deg_min: Math.round(rideMin * AMBIENT_TEMP * 0.4),
      water_stops_taken: alerts.filter((a) => a.stop).length,
      peak_risk: riskLevel,
      route_type: selectedRoute,
    })
    setScreen('history')
  }

  const riskColor = { green: '#4ade80', yellow: '#facc15', red: '#f87171' }[riskLevel]

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Map placeholder */}
      <div className="flex-1 min-h-0 bg-surface flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #ffb693 0%, transparent 60%), radial-gradient(circle at 70% 70%, #60a5fa 0%, transparent 50%)' }}
        />
        <div className="text-center z-10">
          <div className="text-5xl mb-3">🗺️</div>
          <p className="text-white/30 text-sm">Live map · GPS active</p>
        </div>

        {/* Ride timer */}
        <div className="absolute top-4 left-4 bg-bg/80 backdrop-blur rounded-xl px-3 py-2">
          <p className="text-white font-mono text-sm">{String(Math.floor(rideMin / 60)).padStart(2,'0')}:{String(rideMin % 60).padStart(2,'0')}</p>
          <p className="text-white/40 text-xs">elapsed</p>
        </div>

        {/* Risk indicator */}
        <div className="absolute top-4 right-4 bg-bg/80 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: riskColor }} />
          <RiskBadge level={riskLevel} />
        </div>
      </div>

      {/* Biosignal panel — max 4 numbers */}
      <div className="bg-surface border-t border-border px-5 pt-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <BioStat label="HR" value={`${biosignal.hr}`} unit="bpm" color="text-red" />
          <BioStat label="HRV" value={`${biosignal.hrv}`} unit="ms" color="text-blue" />
          <BioStat label="Skin" value={`${biosignal.skin_temp}`} unit="°C" color="text-heat" />
          <BioStat label="Ambient" value={`${AMBIENT_TEMP}`} unit="°C" color="text-yellow" />
        </div>

        {/* Active alerts */}
        {alerts.slice(0, 2).map((alert) => (
          <div
            key={alert.id}
            className={`mb-3 rounded-xl p-3 border flex items-start gap-3 ${
              alert.risk === 'red' ? 'bg-red/10 border-red/30' : 'bg-yellow/10 border-yellow/30'
            }`}
          >
            <span className="text-xl mt-0.5">{alert.stop?.type === 'fountain' ? '💧' : '⚠️'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm leading-snug">{alert.message}</p>
              {alert.stop && (
                <p className="text-white/40 text-xs mt-0.5">{alert.stop.name} · {alert.stop.distance_m}m</p>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => setProvenanceModal(alert)}
                className="text-orange text-xs underline"
              >
                Why?
              </button>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-white/30 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Debug mode toggle */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-white/20 text-xs mb-2"
        >
          {showDebug ? '▲' : '▼'} Sim mode
        </button>
        {showDebug && (
          <div className="flex gap-2 mb-3">
            {(['baseline', 'moderate', 'dehydrating'] as BioMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setBioMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  bioMode === m ? 'bg-orange text-bg border-orange' : 'bg-bg text-white/50 border-border'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleEndRide}
          className="w-full py-3 rounded-xl bg-red/20 border border-red/40 text-red text-sm font-semibold mb-1"
        >
          End Ride
        </button>
      </div>
    </div>
  )
}

function BioStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-bg rounded-xl p-2.5 text-center">
      <p className={`font-bold text-lg leading-none ${color}`}>{value}</p>
      <p className="text-white/30 text-xs mt-0.5">{unit}</p>
      <p className="text-white/50 text-xs mt-0.5">{label}</p>
    </div>
  )
}
