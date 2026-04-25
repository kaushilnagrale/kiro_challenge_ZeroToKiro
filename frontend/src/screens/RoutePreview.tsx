import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import { useStore } from '../store'
import { RiskBadge } from '../components/RiskBadge'
import type { RouteOption } from '../types'

// SVG stop icons — no emoji
function StopIcon({ type }: { type: string }) {
  if (type === 'cafe') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
  if (type === 'repair') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
  // fountain / default
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
      <path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/>
    </svg>
  )
}

// Heat gradient bar — visual MRT indicator
function HeatBar({ mrtF }: { mrtF: number }) {
  // 80°F = cool, 140°F = very hot
  const pct = Math.min(100, Math.max(0, ((mrtF - 80) / 60) * 100))
  const color = pct > 70 ? '#f87171' : pct > 40 ? '#facc15' : '#4ade80'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-white/30 mb-1">
        <span>MRT</span>
        <span style={{ color }}>{mrtF}°F</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

const STOP_ICON_HTML: Record<string, string> = {
  fountain: `<div style="width:20px;height:20px;border-radius:50%;background:#1e3a5f;border:2px solid #60a5fa;display:flex;align-items:center;justify-content:center;font-size:10px">💧</div>`,
  cafe:     `<div style="width:20px;height:20px;border-radius:50%;background:#1e3a5f;border:2px solid #60a5fa;display:flex;align-items:center;justify-content:center;font-size:10px">☕</div>`,
  repair:   `<div style="width:20px;height:20px;border-radius:50%;background:#1e3a5f;border:2px solid #60a5fa;display:flex;align-items:center;justify-content:center;font-size:10px">🔧</div>`,
}

export function RoutePreview() {
  const { routes, stops, selectedRoute, setSelectedRoute, setScreen, startRide, destination } = useStore()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || routes.length === 0) return
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
    mapInstance.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    routes.forEach((r) => {
      L.polyline(r.polyline, {
        color: r.color,
        weight: r.id === selectedRoute ? 5 : 3,
        opacity: r.id === selectedRoute ? 1 : 0.35,
        dashArray: r.id === 'fastest' ? '8 6' : undefined,
      }).addTo(map)
    })

    // Only show water stops when PulseRoute is selected —
    // fastest route is what a standard maps user sees: no stop guidance
    if (selectedRoute === 'pulseroute') {
      stops.forEach((s) => {
        const html = STOP_ICON_HTML[s.type] ?? STOP_ICON_HTML.fountain
        const icon = L.divIcon({ html, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
        L.marker([s.lat, s.lng], { icon }).addTo(map)
      })
    }

    const allPoints = routes.flatMap((r) => r.polyline)
    map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] })

    return () => { map.remove(); mapInstance.current = null }
  }, [routes, stops, selectedRoute])

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 pb-20">
        <p className="text-white/40 text-sm">No route loaded.</p>
        <button onClick={() => setScreen('planner')} className="text-orange text-sm">← Back to Planner</button>
      </div>
    )
  }

  const active = routes.find((r) => r.id === selectedRoute)!
  const fastest = routes.find((r) => r.id === 'fastest')!
  const mrtSaved = Math.round(fastest.peak_mrt - active.peak_mrt)

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Map */}
      <div ref={mapRef} className="flex-1 min-h-0" />

      {/* Bottom sheet */}
      <div className="bg-surface border-t border-border/50 px-5 pt-4 pb-2">
        {/* Destination label */}
        <div className="flex items-center gap-2 mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
          <p className="text-white/40 text-xs truncate">{destination}</p>
        </div>

        {/* Route toggle */}
        <div className="flex gap-2 mb-4">
          {routes.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              active={selectedRoute === r.id}
              onClick={() => setSelectedRoute(r.id)}
            />
          ))}
        </div>

        {/* Why PulseRoute */}
        {selectedRoute === 'pulseroute' && (
          <div className="bg-orange/10 border border-orange/25 rounded-xl px-4 py-3 mb-4">
            <p className="text-orange text-xs font-semibold mb-2">Why PulseRoute?</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <WhyStat label="Shade" value={`${Math.round(active.shade_pct)}%`} />
              <WhyStat
                label="MRT saved"
                value={mrtSaved > 0 ? `-${mrtSaved}°F` : '—'}
                highlight={mrtSaved > 0}
              />
              <WhyStat label="Water stops" value={`${active.water_stops}`} />
            </div>
          </div>
        )}

        <button
          onClick={() => { startRide(); setScreen('live') }}
          className="w-full py-4 rounded-2xl bg-orange text-bg font-bold text-base flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
            <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 10l3-1 2 4h4"/>
          </svg>
          Start Ride
        </button>
      </div>
    </div>
  )
}

function RouteCard({ route, active, onClick }: { route: RouteOption; active: boolean; onClick: () => void }) {
  const mrt = route.peak_mrt
  const risk = mrt > 122 ? 'red' : mrt > 100 ? 'yellow' : 'green'
  const etaDisplay = route.eta_min >= 60
    ? `${Math.floor(route.eta_min / 60)}h ${route.eta_min % 60}m`
    : `${route.eta_min} min`

  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl p-3 border text-left transition-all ${
        active ? 'border-orange bg-orange/10' : 'border-border bg-bg'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white font-semibold text-sm">{route.label}</span>
        <RiskBadge level={risk} />
      </div>
      <div className="flex gap-3 text-xs text-white/50">
        <span>{route.distance_km} mi</span>
        <span>{etaDisplay}</span>
      </div>
      {route.id === 'pulseroute' && (
        <div className="mt-1.5 flex gap-3 text-xs">
          <span className="text-blue">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{display:'inline',marginRight:3}}>
              <path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/>
            </svg>
            {route.water_stops} stops
          </span>
          <span className="text-green">{Math.round(route.shade_pct)}% shade</span>
        </div>
      )}
      {route.id === 'fastest' && (
        <p className="mt-1.5 text-xs text-white/25">No stop guidance</p>
      )}
      <HeatBar mrtF={mrt} />
    </button>
  )
}

function WhyStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`font-bold text-base ${highlight ? 'text-green' : 'text-orange'}`}>{value}</p>
      <p className="text-white/50 text-xs">{label}</p>
    </div>
  )
}
