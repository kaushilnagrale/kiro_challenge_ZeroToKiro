import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import { useStore } from '../store'
import { RiskBadge } from '../components/RiskBadge'
import type { RouteOption } from '../types'

const STOP_ICONS: Record<string, string> = { fountain: '💧', cafe: '☕', repair: '🔧' }

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
        opacity: r.id === selectedRoute ? 1 : 0.4,
        dashArray: r.id === 'fastest' ? '8 6' : undefined,
      }).addTo(map)
    })

    stops.forEach((s) => {
      const icon = L.divIcon({
        html: `<div style="font-size:16px;line-height:1">${STOP_ICONS[s.type]}</div>`,
        className: '',
        iconSize: [20, 20],
      })
      L.marker([s.lat, s.lng], { icon }).addTo(map)
    })

    const allPoints = routes.flatMap((r) => r.polyline)
    map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] })

    return () => { map.remove(); mapInstance.current = null }
  }, [routes, stops, selectedRoute])

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-white/40">No route loaded.</p>
        <button onClick={() => setScreen('planner')} className="text-orange text-sm">← Back to Planner</button>
      </div>
    )
  }

  const active = routes.find((r) => r.id === selectedRoute)!
  const fastest = routes.find((r) => r.id === 'fastest')!

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Map */}
      <div ref={mapRef} className="flex-1 min-h-0" />

      {/* Bottom sheet */}
      <div className="bg-surface border-t border-border px-5 pt-4 pb-2">
        <p className="text-white/40 text-xs mb-3">→ {destination}</p>

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

        {/* Why this route */}
        {selectedRoute === 'pulseroute' && (
          <div className="bg-orange/10 border border-orange/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-orange text-xs font-semibold mb-1">Why PulseRoute?</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <WhyStat label="Shade" value={`${active.shade_pct}%`} />
              <WhyStat label="MRT saved" value={`${fastest.peak_mrt - active.peak_mrt}°C`} />
              <WhyStat label="Water stops" value={`${active.water_stops}`} />
            </div>
          </div>
        )}

        <button
          onClick={() => { startRide(); setScreen('live') }}
          className="w-full py-4 rounded-2xl bg-orange text-bg font-bold text-base"
        >
          Start Ride →
        </button>
      </div>
    </div>
  )
}

function RouteCard({ route, active, onClick }: { route: RouteOption; active: boolean; onClick: () => void }) {
  const mrt = route.peak_mrt
  const risk = mrt > 50 ? 'red' : mrt > 38 ? 'yellow' : 'green'
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl p-3 border text-left transition-all ${
        active ? 'border-orange bg-orange/10' : 'border-border bg-bg'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold text-sm">{route.label}</span>
        <RiskBadge level={risk} />
      </div>
      <div className="flex gap-3 text-xs text-white/60">
        <span>{route.distance_km} km</span>
        <span>{route.eta_min} min</span>
        <span>MRT {route.peak_mrt}°C</span>
      </div>
      {route.id === 'pulseroute' && (
        <div className="mt-1.5 flex gap-2 text-xs">
          <span className="text-blue">💧 {route.water_stops} stops</span>
          <span className="text-green">🌿 {route.shade_pct}% shade</span>
        </div>
      )}
    </button>
  )
}

function WhyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-orange font-bold text-base">{value}</p>
      <p className="text-white/50 text-xs">{label}</p>
    </div>
  )
}
