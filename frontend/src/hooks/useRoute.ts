/**
 * useRoute.ts — one-shot route fetch hook for PulseRoute.
 *
 * Calls POST /route via postRoute() from lib/api.ts.
 * Maps RouteResponse → RouteOption[] / Stop[] for the Zustand store.
 * Falls back to MOCK_ROUTES / MOCK_STOPS on any error — never crashes.
 */

import { useState, useCallback } from 'react'
import { postRoute } from '../lib/api'
import type { RouteResponse, Route, Stop as BackendStop } from '../lib/apiTypes'
import type { RouteOption, Stop as UIStop } from '../types'
import { MOCK_ROUTES, MOCK_STOPS } from '../lib/mockData'
import { useStore } from '../store'

// ─────────── Geocoder lookup table ───────────

const GEOCODE_TABLE: Record<string, [number, number]> = {
  'Memorial Union, ASU Tempe': [33.4255, -111.9400],
  'Memorial Union, ASU':       [33.4255, -111.9400],
  'Tempe Town Lake':           [33.4148, -111.9290],
  'Mill Ave & 5th St':         [33.4260, -111.9410],
  'ASU West Campus':           [33.3528, -112.0609],
  'Scottsdale Rd & Thomas':    [33.4942, -111.9261],
  'Mill Ave':                  [33.4260, -111.9410],
}

const DEFAULT_ORIGIN_COORDS: [number, number]      = [33.4255, -111.9400]
const DEFAULT_DESTINATION_COORDS: [number, number] = [33.4148, -111.9290]

function geocode(place: string, isOrigin: boolean): [number, number] {
  return GEOCODE_TABLE[place] ?? (isOrigin ? DEFAULT_ORIGIN_COORDS : DEFAULT_DESTINATION_COORDS)
}

// ─────────── Unit helpers ───────────
const KM_TO_MI = 0.621371
const C_TO_F = (c: number) => Math.round((c * 9/5 + 32) * 10) / 10

function mapRoute(r: Route, id: 'fastest' | 'pulseroute'): RouteOption {
  const distance_km = Math.round(r.distance_m / 10) / 100
  return {
    id,
    label: id === 'fastest' ? 'Fastest' : 'PulseRoute',
    distance_km: Math.round(distance_km * KM_TO_MI * 10) / 10,  // stored as miles
    eta_min: Math.round(r.eta_seconds / 60),
    peak_mrt: C_TO_F(r.peak_mrt_c),                              // °F
    shade_pct: Math.round(r.shade_pct * 10) / 10,
    water_stops: r.stops.length,
    polyline: r.polyline,
    color: id === 'fastest' ? '#60a5fa' : '#ffb693',
  }
}

const AMENITY_MAP: Record<string, UIStop['type']> = {
  water:       'fountain',
  food:        'cafe',
  bike_repair: 'repair',
}

function mapStop(s: BackendStop): UIStop {
  const type = AMENITY_MAP[s.amenities[0]] ?? 'fountain'
  return { id: s.id, type, name: s.name, lat: s.lat, lng: s.lng }
}

/** Merge stops from both routes, deduplicated by id. */
function collectStops(fastest: Route, pulseroute: Route): UIStop[] {
  const seen = new Set<string>()
  const result: UIStop[] = []
  for (const s of [...fastest.stops, ...pulseroute.stops]) {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      result.push(mapStop(s))
    }
  }
  return result
}

// ─────────── Public API ───────────

export interface UseRouteReturn {
  data: RouteResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
  fetchRoute: (params: {
    origin: string
    destination: string
    destinationCoords?: [number, number]   // pre-resolved from geocoder
    sensitive_mode: boolean
    bio_session_id: string | null
  }) => Promise<void>
  /** Mapped RouteOption[] — populated after a successful fetch */
  routeOptions: RouteOption[]
  /** Mapped UI Stop[] — populated after a successful fetch */
  mappedStops: UIStop[]
}

export function useRoute(): UseRouteReturn {
  const [data, setData]               = useState<RouteResponse | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
  const [mappedStops, setMappedStops]   = useState<UIStop[]>([])

  const setRawRouteResponse = useStore((s) => s.setRawRouteResponse)

  // Holds the last params so refetch() can replay them
  const [lastParams, setLastParams] = useState<Parameters<UseRouteReturn['fetchRoute']>[0] | null>(null)

  const fetchRoute = useCallback(async (params: {
    origin: string
    destination: string
    destinationCoords?: [number, number]
    sensitive_mode: boolean
    bio_session_id: string | null
  }) => {
    setLastParams(params)
    setLoading(true)
    setError(null)

    const originCoords      = geocode(params.origin, true)
    const destinationCoords = params.destinationCoords ?? geocode(params.destination, false)

    try {
      const response = await postRoute({
        origin:         originCoords,
        destination:    destinationCoords,
        depart_time:    new Date().toISOString(),
        sensitive_mode: params.sensitive_mode,
        bio_session_id: params.bio_session_id,
        amenity_prefs:  ['water'],
      })

      const options = [
        mapRoute(response.fastest,    'fastest'),
        mapRoute(response.pulseroute, 'pulseroute'),
      ]
      const stops = collectStops(response.fastest, response.pulseroute)

      setData(response)
      setRouteOptions(options)
      setMappedStops(stops)
      // Store raw response so LiveTracking can access segments for lookahead
      setRawRouteResponse(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[useRoute] fetch failed, falling back to mock data:', message)
      setError(message)
      setData(null)
      setRouteOptions(MOCK_ROUTES)
      setMappedStops(MOCK_STOPS)
      setRawRouteResponse(null)
    } finally {
      setLoading(false)
    }
  }, [setRawRouteResponse])

  const refetch = useCallback(() => {
    if (lastParams) {
      fetchRoute(lastParams)
    }
  }, [lastParams, fetchRoute])

  return { data, loading, error, refetch, fetchRoute, routeOptions, mappedStops }
}
