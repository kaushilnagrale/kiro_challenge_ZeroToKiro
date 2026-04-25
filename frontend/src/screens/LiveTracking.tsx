import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import { useStore } from '../store'
import { RiskBadge } from '../components/RiskBadge'
import { useBio } from '../hooks/useBio'
import { useRisk } from '../hooks/useRisk'
import { useWeather } from '../hooks/useWeather'
import type { BioMode, RideRecord, SafetyAlert, Stop } from '../types'
import type { SafetyAlert as ApiSafetyAlert, LookaheadWarning, RouteSegment } from '../lib/apiTypes'

const ALERT_INTERVAL_MS = 18000
const STOP_ICONS: Record<string, string> = { fountain: '💧', cafe: '☕', repair: '🔧' }

function deriveStopType(amenities: string[]): Stop['type'] {
  const first = amenities[0]
  if (first === 'water') return 'fountain'
  if (first === 'food') return 'cafe'
  if (first === 'bike_repair') return 'repair'
  return 'fountain'
}

function mapApiAlert(apiAlert: ApiSafetyAlert): SafetyAlert {
  const uiStop: Stop | undefined = apiAlert.suggested_stop
    ? {
        id: apiAlert.suggested_stop.id,
        type: deriveStopType(apiAlert.suggested_stop.amenities),
        name: apiAlert.suggested_stop.name,
        lat: apiAlert.suggested_stop.lat,
        lng: apiAlert.suggested_stop.lng,
      }
    : undefined
  return {
    id: `a-${Date.now()}`,
    message: apiAlert.message,
    risk: apiAlert.risk.level,
    timestamp: new Date().toISOString(),
    stop: uiStop,
    provenance: apiAlert.provenance,
    is_fallback: false,
  }
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ── Fake hot-zone segments for lookahead demo ─────────────────────────────────
// These simulate a route that passes through a 55°C MRT danger zone in ~4 minutes.
// Injected client-side so the demo works without a real route.
function makeDemoHotSegments(currentEtaSec: number): RouteSegment[] {
  return [
    {
      id: 'demo-seg-000',
      polyline: [[33.4255, -111.94]],
      mrt_mean_c: 38.0,
      length_m: 500,
      eta_seconds_into_ride: currentEtaSec + 60,
      forecasted_temp_c: 29,
    },
    {
      id: 'demo-seg-001',
      polyline: [[33.4195, -111.934]],
      mrt_mean_c: 44.0,
      length_m: 500,
      eta_seconds_into_ride: currentEtaSec + 180,
      forecasted_temp_c: 30,
    },
    {
      id: 'demo-seg-002',  // ASU Parking Lot 59 — +8°C hot zone
      polyline: [[33.4195, -111.934]],
      mrt_mean_c: 57.0,   // ambient ~29 + 8 solar + 8 zone delta + wind = ~57
      length_m: 500,
      eta_seconds_into_ride: currentEtaSec + 240,
      forecasted_temp_c: 30,
    },
    {
      id: 'demo-seg-003',
      polyline: [[33.415, -111.926]],
      mrt_mean_c: 52.0,
      length_m: 500,
      eta_seconds_into_ride: currentEtaSec + 360,
      forecasted_temp_c: 30,
    },
  ]
}

// ── Ride Summary Modal ────────────────────────────────────────────────────────
function RideSummaryModal({ record, onDone }: { record: RideRecord; onDone: () => void }) {
  const riskColor = { green: '#4ade80', yellow: '#facc15', red: '#f87171' }[record.peak_risk]
  return (
    <div className="absolute inset-0 z-50 bg-bg/95 backdrop-blur flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏁</div>
          <h2 className="text-2xl font-bold text-white">Ride Complete</h2>
          <p className="text-white/40 text-sm mt-1">{record.origin} → {record.destination}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <SummaryCard icon="📍" label="Distance" value={`${record.distance_km} km`} />
          <SummaryCard icon="⏱️" label="Duration" value={`${record.duration_min} min`} />
          <SummaryCard icon="💧" label="Water stops" value={`${record.water_stops_taken}`} />
          <SummaryCard icon="🌡️" label="Heat exposure" value={`${record.exposure_deg_min} °C·min`} />
        </div>
        <div
          className="rounded-2xl p-4 border mb-6 flex items-center justify-between"
          style={{ borderColor: `${riskColor}44`, background: `${riskColor}11` }}
        >
          <div>
            <p className="text-white/50 text-xs mb-1">Peak hydration risk</p>
            <RiskBadge level={record.peak_risk} />
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs mb-1">Route type</p>
            <span className={`text-sm font-semibold ${record.route_type === 'pulseroute' ? 'text-orange' : 'text-blue'}`}>
              {record.route_type === 'pulseroute' ? '🌿 PulseRoute' : '⚡ Fastest'}
            </span>
          </div>
        </div>
        <button onClick={onDone} className="w-full py-4 rounded-2xl bg-orange text-bg font-semibold text-base">
          View History →
        </button>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <span className="text-xl">{icon}</span>
      <p className="text-white font-bold text-lg mt-2">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  )
}

// ── Demo Panel ────────────────────────────────────────────────────────────────
function DemoPanel({
  bioMode,
  onSetMode,
  onSimulateLookahead,
  onClearLookahead,
  lookaheadActive,
  sensitiveMode,
  onToggleSensitive,
}: {
  bioMode: BioMode
  onSetMode: (m: BioMode) => void
  onSimulateLookahead: () => void
  onClearLookahead: () => void
  lookaheadActive: boolean
  sensitiveMode: boolean
  onToggleSensitive: () => void
}) {
  return (
    <div className="bg-bg rounded-2xl border border-border p-3 mb-3 space-y-3">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Demo Controls</p>

      {/* Biosignal mode */}
      <div>
        <p className="text-white/50 text-xs mb-1.5">Biosignal mode</p>
        <div className="flex gap-2">
          {(['baseline', 'moderate', 'dehydrating'] as BioMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onSetMode(m)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                bioMode === m ? 'bg-orange text-bg border-orange' : 'bg-surface text-white/50 border-border'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-white/30 text-xs mt-1">
          {bioMode === 'baseline' && 'HR ~72, HRV ~62 — green risk'}
          {bioMode === 'moderate' && 'HR ~145, HRV ~38 — yellow risk'}
          {bioMode === 'dehydrating' && 'HR ~168, HRV ~19 — red risk'}
        </p>
      </div>

      {/* Sensitive mode toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/70 text-xs font-medium">Sensitive mode</p>
          <p className="text-white/30 text-xs">Lowers all thresholds — watch risk go yellow sooner</p>
        </div>
        <button
          onClick={onToggleSensitive}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${sensitiveMode ? 'bg-orange' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sensitiveMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Lookahead demo */}
      <div>
        <p className="text-white/70 text-xs font-medium mb-1">Predictive lookahead</p>
        <p className="text-white/30 text-xs mb-2">
          Injects a 57°C MRT hot zone 4 min ahead — fires warning even at green risk
        </p>
        {!lookaheadActive ? (
          <button
            onClick={onSimulateLookahead}
            className="w-full py-2 rounded-xl bg-orange/20 border border-orange/40 text-orange text-xs font-semibold"
          >
            🔮 Simulate hot zone ahead
          </button>
        ) : (
          <button
            onClick={onClearLookahead}
            className="w-full py-2 rounded-xl bg-surface border border-border text-white/40 text-xs"
          >
            ✕ Clear lookahead demo
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main LiveTracking screen ──────────────────────────────────────────────────
export function LiveTracking() {
  const {
    biosignal, setBiosignal, riskLevel, setRiskLevel,
    bioMode, setBioMode, alerts, addAlert, dismissAlert,
    setProvenanceModal, endRide, setScreen, addRideRecord,
    profile, selectedRoute, destination, origin, routes, stops,
    rawRouteResponse,
  } = useStore()

  const [rideMin, setRideMin] = useState(0)
  const [showDebug, setShowDebug] = useState(false)
  const [summaryRecord, setSummaryRecord] = useState<RideRecord | null>(null)
  const [demoSensitive, setDemoSensitive] = useState(profile?.sensitive_mode ?? false)
  const [demoLookaheadActive, setDemoLookaheadActive] = useState(false)
  // Override lookahead: when demo is active, show this instead of backend response
  const [demoLookahead, setDemoLookahead] = useState<LookaheadWarning | null>(null)
  const lastAlertRef = useRef(0)
  const startRef = useRef(Date.now())

  // ── Leaflet map refs ──────────────────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const posMarkerRef = useRef<L.Marker | null>(null)

  const bio = useBio()
  const risk = useRisk()
  const weather = useWeather()

  // ── Bio session ───────────────────────────────────────────────────────────
  useEffect(() => {
    bio.startSession('moderate')
    return () => { bio.stopSession() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (bio.sessionId) {
      risk.startPolling(bio.sessionId, profile?.baseline_hr ?? 65, {
        sensitiveMode: demoSensitive,
        fitnessLevel: profile
          ? profile.baseline_hr <= 58 ? 'advanced'
            : profile.baseline_hr >= 72 ? 'beginner'
            : 'intermediate'
          : null,
      })
    }
    return () => { risk.stopPolling() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio.sessionId, demoSensitive])

  useEffect(() => {
    if (bio.data) setBiosignal(bio.data)
  }, [bio.data, setBiosignal])

  useEffect(() => {
    if (risk.data && !risk.data.fallback && risk.data.alert) {
      setRiskLevel(risk.data.alert.risk.level)
    }
  }, [risk.data, setRiskLevel])

  useEffect(() => {
    if (!risk.data || risk.data.fallback || !risk.data.alert) return
    const now = Date.now()
    if (now - lastAlertRef.current > ALERT_INTERVAL_MS) {
      lastAlertRef.current = now
      addAlert(mapApiAlert(risk.data.alert))
    }
  }, [risk.data, addAlert])

  // ── Ride timer + feed segments to lookahead ──────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 60000)
      setRideMin(elapsed)
      // Feed real route segments to lookahead every tick
      if (rawRouteResponse) {
        const rawRoute = selectedRoute === 'pulseroute'
          ? rawRouteResponse.pulseroute
          : rawRouteResponse.fastest
        const etaSec = elapsed * 60
        risk.setUpcomingSegments(rawRoute.segments, etaSec)
      }
    }, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRouteResponse, selectedRoute])

  // ── Leaflet map init ──────────────────────────────────────────────────────
  const activeRoute = routes.find((r) => r.id === selectedRoute)
  const polyline = activeRoute?.polyline ?? []

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
    mapInstance.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    // Draw both route polylines (dim the non-selected one)
    routes.forEach((r) => {
      L.polyline(r.polyline, {
        color: r.color,
        weight: r.id === selectedRoute ? 5 : 2,
        opacity: r.id === selectedRoute ? 0.9 : 0.3,
        dashArray: r.id === 'fastest' ? '8 6' : undefined,
      }).addTo(map)
    })

    // Water stop markers
    stops.forEach((s) => {
      const icon = L.divIcon({
        html: `<div style="font-size:15px;line-height:1;filter:drop-shadow(0 1px 2px #000)">${STOP_ICONS[s.type] ?? '📍'}</div>`,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
      L.marker([s.lat, s.lng], { icon }).addTo(map)
    })

    // Current position marker (start of route initially)
    const startPos = polyline[0] ?? [33.4255, -111.94]
    const posIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#ffb693;border:3px solid #fff;box-shadow:0 0 8px #ffb69388"></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
    const marker = L.marker(startPos as L.LatLngExpression, { icon: posIcon }).addTo(map)
    posMarkerRef.current = marker

    // Fit map to route
    if (polyline.length > 0) {
      map.fitBounds(L.latLngBounds(polyline as L.LatLngExpression[]), { padding: [40, 40] })
    } else if (routes.length > 0) {
      const allPts = routes.flatMap((r) => r.polyline)
      map.fitBounds(L.latLngBounds(allPts as L.LatLngExpression[]), { padding: [40, 40] })
    }

    return () => { map.remove(); mapInstance.current = null; posMarkerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, stops, selectedRoute])

  // ── Animate position marker along polyline ────────────────────────────────
  const etaMin = activeRoute?.eta_min ?? null
  const elapsedFraction = etaMin ? Math.min(rideMin / etaMin, 1) : 0
  const remainingMin = etaMin ? Math.max(0, etaMin - rideMin) : null

  useEffect(() => {
    if (!posMarkerRef.current || polyline.length === 0) return
    const idx = Math.min(
      Math.floor(elapsedFraction * (polyline.length - 1)),
      polyline.length - 1,
    )
    posMarkerRef.current.setLatLng(polyline[idx] as L.LatLngExpression)
  }, [elapsedFraction, polyline])

  // ── Derived display values ────────────────────────────────────────────────
  const ambientTempC = weather.data?.current.temp_c ?? null
  const ambientTempF = ambientTempC !== null ? Math.round(ambientTempC * 9 / 5 + 32) : '—'
  const skinTempF = Math.round((biosignal.skin_temp_c * 9 / 5 + 32) * 10) / 10
  const riskColor = { green: '#4ade80', yellow: '#facc15', red: '#f87171' }[riskLevel]
  const showFallbackBanner = risk.data?.fallback === true
  const riskScore = risk.data?.alert?.risk ?? null
  const nearestStop = risk.data?.alert?.suggested_stop ?? null
  const showNearestStop = (riskLevel === 'yellow' || riskLevel === 'red') && nearestStop !== null

  const currentPosIdx = polyline.length > 0
    ? Math.min(Math.floor(elapsedFraction * (polyline.length - 1)), polyline.length - 1)
    : 0
  const currentPos = polyline[currentPosIdx] ?? null

  const nextRouteStop = currentPos && stops.length > 0
    ? stops.reduce<{ stop: typeof stops[0]; dist: number } | null>((best, s) => {
        const d = haversineM(currentPos[0], currentPos[1], s.lat, s.lng)
        if (!best || d < best.dist) return { stop: s, dist: d }
        return best
      }, null)
    : null

  // ── End ride ──────────────────────────────────────────────────────────────
  function handleEndRide() {
    bio.stopSession()
    risk.stopPolling()
    endRide()
    const record: RideRecord = {
      id: `r-${Date.now()}`,
      date: new Date().toISOString(),
      origin,
      destination,
      distance_km: selectedRoute === 'pulseroute' ? 5.1 : 4.2,
      duration_min: rideMin || 1,
      exposure_deg_min: Math.round(rideMin * (ambientTempC ?? 41) * 0.4),
      water_stops_taken: alerts.filter((a) => a.stop).length,
      peak_risk: riskLevel,
      route_type: selectedRoute,
    }
    addRideRecord(record)
    setSummaryRecord(record)
  }

  function handleSetMode(mode: BioMode) {
    bio.setMode(mode)
    setBioMode(mode)
  }

  function handleToggleSensitive() {
    setDemoSensitive((v) => !v)
    // startPolling will restart via the demoSensitive dependency
  }

  function handleSimulateLookahead() {
    const etaSec = rideMin * 60
    const fakeSegments = makeDemoHotSegments(etaSec)
    risk.setUpcomingSegments(fakeSegments, etaSec)
    setDemoLookaheadActive(true)
    // Also set a local override so it shows immediately without waiting for next poll
    setDemoLookahead({
      projected_points: 25,
      reason: 'Approaching 57°C MRT danger zone in ~4 min (ASU Parking Lot 59). Projected risk: yellow (25 pts). Stop now — no water stops ahead in that zone.',
      seconds_until_hot_zone: 240,
      peak_mrt_c: 57.0,
    })
  }

  function handleClearLookahead() {
    risk.setUpcomingSegments([], 0)
    setDemoLookaheadActive(false)
    setDemoLookahead(null)
  }

  // Use demo lookahead override if active, otherwise use backend response
  const activeLookahead = demoLookahead ?? risk.data?.lookahead ?? null

  return (
    <div className="flex flex-col h-full pb-20 relative">
      {/* ── Live Leaflet map ── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Ride timer overlay */}
        <div className="absolute top-4 left-4 z-10 bg-bg/80 backdrop-blur rounded-xl px-3 py-2">
          <p className="text-white font-mono text-sm">
            {String(Math.floor(rideMin / 60)).padStart(2, '0')}:
            {String(rideMin % 60).padStart(2, '0')}
          </p>
          <p className="text-white/40 text-xs">elapsed</p>
        </div>

        {/* Risk indicator overlay */}
        <div className="absolute top-4 right-4 z-10 bg-bg/80 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: riskColor }} />
          <RiskBadge level={riskLevel} />
        </div>

        {/* Route progress bar — bottom of map */}
        {activeRoute && remainingMin !== null && (
          <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-3 bg-gradient-to-t from-bg/70 to-transparent pt-6">
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>→ {destination || 'Destination'}</span>
              <span>{remainingMin} min left</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange rounded-full transition-all duration-1000"
                style={{ width: `${Math.round(elapsedFraction * 100)}%` }}
              />
            </div>
            {nextRouteStop && (
              <p className="text-white/40 text-xs mt-1">
                Next stop: {nextRouteStop.stop.name}
                {nextRouteStop.dist < 2000
                  ? ` · ${Math.round(nextRouteStop.dist)}m`
                  : ` · ${(nextRouteStop.dist / 1000).toFixed(1)}km`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Biosignal + decision panel ── */}
      <div className="bg-surface border-t border-border px-5 pt-4">
        {/* 4 biosignal stats */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <BioStat label="HR" value={`${Math.round(biosignal.hr)}`} unit="bpm" color="text-red" />
          <BioStat label="HRV" value={`${Math.round(biosignal.hrv_ms * 10) / 10}`} unit="ms" color="text-blue" />
          <BioStat label="Skin" value={`${skinTempF}`} unit="°F" color="text-heat" />
          <BioStat label="Ambient" value={`${ambientTempF}`} unit="°F" color="text-yellow" />
        </div>

        {/* Risk score breakdown — always visible */}
        {riskScore && (
          <div
            className={`mb-3 rounded-xl px-3 py-2 border flex items-center gap-3 ${
              riskScore.level === 'red'
                ? 'bg-red/10 border-red/20'
                : riskScore.level === 'yellow'
                ? 'bg-yellow/10 border-yellow/20'
                : 'bg-green/10 border-green/20'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs leading-snug truncate">{riskScore.top_reason}</p>
            </div>
            <span
              className={`text-xs font-bold shrink-0 ${
                riskScore.level === 'red' ? 'text-red'
                  : riskScore.level === 'yellow' ? 'text-yellow'
                  : 'text-green'
              }`}
            >
              {riskScore.points} pts
            </span>
            <button
              onClick={() => risk.data?.alert && setProvenanceModal(mapApiAlert(risk.data.alert))}
              className="text-orange text-xs underline shrink-0"
            >
              Why?
            </button>
          </div>
        )}

        {/* Persistent nearest stop card — shown when risk ≥ yellow, uses recommender reason */}
        {showNearestStop && nearestStop && (
          <div className="mb-3 rounded-xl p-3 border border-blue/40 bg-blue/10 flex items-center gap-3">
            <span className="text-xl shrink-0">💧</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium leading-snug truncate">{nearestStop.name}</p>
              <p className="text-white/40 text-xs mt-0.5 leading-snug">
                {risk.data?.stop_reason
                  ? risk.data.stop_reason
                  : nearestStop.amenities.includes('water') ? 'Water stop' : 'Rest stop'}
              </p>
            </div>
            <span className="text-blue text-xs font-semibold shrink-0">Go →</span>
          </div>
        )}

        {/* Lookahead warning — predictive heat alert */}
        {activeLookahead && (
          <div className="mb-3 rounded-xl p-3 border border-orange/40 bg-orange/10 flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">🔮</span>
            <div className="flex-1 min-w-0">
              <p className="text-orange text-xs font-semibold mb-0.5">
                Heat zone in {Math.round(activeLookahead.seconds_until_hot_zone / 60)} min
                · {activeLookahead.peak_mrt_c}°C MRT ahead
              </p>
              <p className="text-white/60 text-xs leading-snug">
                {activeLookahead.reason}
              </p>
            </div>
          </div>
        )}

        {/* Logic Gate fallback banner */}
        {showFallbackBanner && (
          <div className="mb-3 rounded-xl p-3 border bg-yellow/10 border-yellow/30 flex items-start gap-3">
            <span className="text-xl mt-0.5">⚠️</span>
            <p className="text-white text-sm leading-snug">
              {risk.data?.fallback_message ?? 'Sensor data unavailable — using conservative defaults.'}
            </p>
          </div>
        )}

        {/* Dismissible alerts */}
        {!showFallbackBanner &&
          alerts.slice(0, 2).map((alert) => (
            <div
              key={alert.id}
              className={`mb-3 rounded-xl p-3 border flex items-start gap-3 ${
                alert.risk === 'red' ? 'bg-red/10 border-red/30' : 'bg-yellow/10 border-yellow/30'
              }`}
            >
              <span className="text-xl mt-0.5">
                {alert.stop?.type === 'fountain' ? '💧' : '⚠️'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm leading-snug">{alert.message}</p>
                {alert.stop && (
                  <p className="text-white/40 text-xs mt-0.5">
                    {alert.stop.name}
                    {alert.stop.distance_m != null ? ` · ${alert.stop.distance_m}m` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => setProvenanceModal(alert)} className="text-orange text-xs underline">
                  Why?
                </button>
                <button onClick={() => dismissAlert(alert.id)} className="text-white/30 text-xs">
                  ✕
                </button>
              </div>
            </div>
          ))}

        {/* Demo panel */}
        <button onClick={() => setShowDebug(!showDebug)} className="text-white/20 text-xs mb-2">
          {showDebug ? '▲' : '▼'} Demo controls
        </button>
        {showDebug && (
          <DemoPanel
            bioMode={bioMode}
            onSetMode={(m) => { bio.setMode(m); setBioMode(m) }}
            onSimulateLookahead={handleSimulateLookahead}
            onClearLookahead={handleClearLookahead}
            lookaheadActive={demoLookaheadActive}
            sensitiveMode={demoSensitive}
            onToggleSensitive={handleToggleSensitive}
          />
        )}

        <button
          onClick={handleEndRide}
          className="w-full py-3 rounded-xl bg-red/20 border border-red/40 text-red text-sm font-semibold mb-1"
        >
          End Ride
        </button>
      </div>

      {/* ── Ride summary modal (shown after End Ride) ── */}
      {summaryRecord && (
        <RideSummaryModal
          record={summaryRecord}
          onDone={() => {
            setSummaryRecord(null)
            setScreen('history')
          }}
        />
      )}
    </div>
  )
}

function BioStat({
  label, value, unit, color,
}: {
  label: string; value: string | number; unit: string; color: string
}) {
  return (
    <div className="bg-bg rounded-xl p-2.5 text-center">
      <p className={`font-bold text-lg leading-none ${color}`}>{value}</p>
      <p className="text-white/30 text-xs mt-0.5">{unit}</p>
      <p className="text-white/50 text-xs mt-0.5">{label}</p>
    </div>
  )
}
