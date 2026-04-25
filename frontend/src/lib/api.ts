/**
 * api.ts — single API client for PulseRoute frontend.
 *
 * All fetch() calls live here. No other file may call fetch() directly.
 *
 * API_BASE_URL is read from the Vite env variable VITE_API_URL.
 * Set it in .env.local:
 *   VITE_API_URL=http://<YOUR_LAN_IP>:8000
 * Falls back to http://localhost:8000 for local dev / iOS simulator.
 */

import type {
  BioModeRequest,
  BioModeResponse,
  Biosignal,
  RiskRequest,
  RiskResponse,
  RouteRequest,
  RouteResponse,
  WeatherResponse,
  StopsResponse,
} from './apiTypes'

// ─────────── Config ───────────

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const DEFAULT_TIMEOUT_MS = 10_000

// ─────────── Generic helper ───────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string,
  ) {
    super(`[${status}] ${path}: ${message}`)
    this.name = 'ApiError'
  }
}

async function apiCall<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const url = `${API_BASE_URL}${path}`

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    })

    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = body?.detail ?? detail
      } catch {
        // ignore parse error — use statusText
      }
      throw new ApiError(res.status, path, detail)
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, path, `Request timed out after ${timeoutMs}ms`)
    }
    throw new ApiError(0, path, (err as Error).message ?? 'Network error')
  } finally {
    clearTimeout(timer)
  }
}

// ─────────── Typed endpoint wrappers ───────────

/**
 * GET /weather?lat=&lng=
 * Returns current conditions, hourly forecast, NWS advisories, and provenance.
 */
export async function getWeather(lat: number, lng: number): Promise<WeatherResponse> {
  return apiCall<WeatherResponse>(`/weather?lat=${lat}&lng=${lng}`)
}

/**
 * POST /bio/mode
 * Registers or updates the simulation mode for a bio session.
 */
export async function setBioMode(req: BioModeRequest): Promise<BioModeResponse> {
  return apiCall<BioModeResponse>('/bio/mode', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/**
 * GET /bio/current?session_id=
 * Returns the latest biosignal reading for a session.
 */
export async function getBioCurrent(session_id: string): Promise<Biosignal> {
  return apiCall<Biosignal>(`/bio/current?session_id=${encodeURIComponent(session_id)}`)
}

/**
 * POST /risk
 * Classifies hydration risk and returns a validated SafetyAlert or fallback.
 */
export async function postRisk(req: RiskRequest): Promise<RiskResponse> {
  return apiCall<RiskResponse>('/risk', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/**
 * POST /route
 * Computes fastest and pulseroute cycling routes.
 */
export async function postRoute(req: RouteRequest): Promise<RouteResponse> {
  return apiCall<RouteResponse>('/route', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/**
 * GET /stops?bbox=&amenity=
 * Returns stops filtered by bounding box and optional amenity.
 * bbox format: "lat_min,lng_min,lat_max,lng_max"
 */
export async function getStops(
  bbox: [number, number, number, number],
  amenity?: string,
): Promise<StopsResponse> {
  const bboxStr = bbox.join(',')
  const query = amenity ? `?bbox=${bboxStr}&amenity=${amenity}` : `?bbox=${bboxStr}`
  return apiCall<StopsResponse>(`/stops${query}`)
}

// ─────────── Mapbox Geocoding ───────────

export interface GeocodeSuggestion {
  place_name: string
  coords: [number, number]  // [lat, lng]
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

/**
 * Geocode a free-text query using Mapbox Geocoding API.
 * Returns up to 5 suggestions with place name and [lat, lng].
 * Biased toward the Phoenix/Tempe area.
 */
export async function geocodeSearch(query: string): Promise<GeocodeSuggestion[]> {
  if (!query.trim()) return []
  const encoded = encodeURIComponent(query)
  // proximity biased to ASU Tempe
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&proximity=-111.9400,33.4255&limit=5&types=place,address,poi`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.features ?? []).map((f: { place_name: string; center: [number, number] }) => ({
    place_name: f.place_name,
    coords: [f.center[1], f.center[0]] as [number, number],  // Mapbox returns [lng, lat]
  }))
}
