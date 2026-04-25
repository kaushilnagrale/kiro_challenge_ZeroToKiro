import { useState, useEffect, useRef, useCallback } from 'react'
import type React from 'react'
import { useStore } from '../store'
import { MOCK_ROUTES, MOCK_STOPS } from '../lib/mockData'
import { useWeather } from '../hooks/useWeather'
import { useRoute } from '../hooks/useRoute'
import { geocodeSearch, type GeocodeSuggestion } from '../lib/api'

const RECENTS = ['Tempe Town Lake', 'Mill Ave & 5th St', 'ASU West Campus', 'Scottsdale Rd & Thomas']

// Fallback mock values used when the weather API fails and no cached data exists
const WEATHER_FALLBACK = { temp: 41, humidity: 18, advisory: true }

export function RidePlanner() {
  const { origin, destination, setDestination, setRoutes, setStops, setScreen, profile } = useStore()
  const [query, setQuery] = useState(destination)
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const route = useRoute()
  const { data: weatherData, loading: weatherLoading, error: weatherError } = useWeather()

  // Track the last route data we've already acted on to avoid double-navigation
  const lastHandledRouteRef = useRef<typeof route.data>(null)

  useEffect(() => {
    if (route.data && route.data !== lastHandledRouteRef.current) {
      lastHandledRouteRef.current = route.data
      setRoutes(route.routeOptions)
      setStops(route.mappedStops)
      setScreen('preview')
    }
  })

  const lastHandledErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (route.error && !route.data && !route.loading && route.error !== lastHandledErrorRef.current) {
      lastHandledErrorRef.current = route.error
      console.warn('[RidePlanner] Route fetch failed, using mock fallback:', route.error)
      setRoutes(MOCK_ROUTES)
      setStops(MOCK_STOPS)
      setScreen('preview')
    }
  })

  // Debounced geocode search as user types
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setSelectedCoords(null)  // clear any previously selected coords

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const results = await geocodeSearch(value)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 300)
  }, [])

  // User picks a suggestion
  function handleSelectSuggestion(s: GeocodeSuggestion) {
    setQuery(s.place_name)
    setSelectedCoords(s.coords)
    setSuggestions([])
    setShowSuggestions(false)
    setDestination(s.place_name)
    route.fetchRoute({
      origin,
      destination: s.place_name,
      destinationCoords: s.coords,
      sensitive_mode: profile?.sensitive_mode ?? false,
      bio_session_id: null,
    })
  }

  // User presses Enter — use selected coords if available, else geocode first
  async function handleEnter() {
    if (!query.trim()) return
    setShowSuggestions(false)
    setDestination(query)

    if (selectedCoords) {
      route.fetchRoute({
        origin,
        destination: query,
        destinationCoords: selectedCoords,
        sensitive_mode: profile?.sensitive_mode ?? false,
        bio_session_id: null,
      })
    } else {
      // Geocode on the fly then route
      const results = await geocodeSearch(query)
      const coords = results[0]?.coords ?? undefined
      route.fetchRoute({
        origin,
        destination: query,
        destinationCoords: coords,
        sensitive_mode: profile?.sensitive_mode ?? false,
        bio_session_id: null,
      })
    }
  }

  // User taps a recent
  function handleRecent(dest: string) {
    setQuery(dest)
    setSelectedCoords(null)
    setSuggestions([])
    setShowSuggestions(false)
    setDestination(dest)
    route.fetchRoute({
      origin,
      destination: dest,
      sensitive_mode: profile?.sensitive_mode ?? false,
      bio_session_id: null,
    })
  }

  const useFallback = weatherError !== null && weatherData === null
  if (useFallback) console.warn('[RidePlanner] Weather unavailable, using mock fallback values')

  const tempC = weatherData ? weatherData.current.temp_c : WEATHER_FALLBACK.temp
  const tempF = Math.round(tempC * 9 / 5 + 32)
  const humidity = weatherData ? Math.round(weatherData.current.humidity_pct) : WEATHER_FALLBACK.humidity
  const uvIndex = weatherData ? (weatherData.current.uv_index != null ? Math.round(weatherData.current.uv_index) : '—') : '11'
  const apparentTempC = weatherData?.current.apparent_temp_c ?? null
  const apparentTempF = apparentTempC !== null ? Math.round(apparentTempC * 9 / 5 + 32) : null
  const windKmh = weatherData?.current.wind_kmh ?? null

  const hasAdvisory = weatherData ? weatherData.advisories.length > 0 : WEATHER_FALLBACK.advisory
  const advisoryHeadline = weatherData?.advisories[0]?.headline ?? 'NWS Heat Advisory Active'

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Greeting — no duplicate logo, App header handles branding */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-white/40 text-sm">Hey {profile?.name ?? 'Rider'} 👋</p>
        <h2 className="text-2xl font-bold text-white mt-0.5">Where to?</h2>
      </div>

      {/* Heat advisory banner */}
      {hasAdvisory && (
        <div className="mx-5 mb-4 bg-advisory/20 border border-advisory/40 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-advisory text-sm font-medium">{advisoryHeadline}</p>
            <p className="text-white/50 text-xs mt-0.5">
              {tempF}°F · {humidity}% humidity
              {apparentTempF !== null ? ` · Feels like ${apparentTempF}°F` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Origin */}
      <div className="mx-5 mb-3">
        <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-green text-sm">●</span>
          <span className="text-white/70 text-sm">{origin}</span>
        </div>
      </div>

      {/* Destination input + autocomplete */}
      <div className="mx-5 mb-5 relative">
        <div className="bg-surface border border-orange/60 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-orange text-sm">●</span>
          <input
            autoFocus
            placeholder="Search any destination…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false) }}
              className="text-white/30 text-lg leading-none"
            >×</button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl overflow-hidden z-40 shadow-xl">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => handleSelectSuggestion(s)}
                className="w-full px-4 py-3 text-left text-sm text-white/80 hover:bg-white/5 border-b border-border/50 last:border-0 flex items-center gap-3"
              >
                <span className="text-orange/60 text-xs">📍</span>
                <span className="truncate">{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recents */}
      <div className="px-5 flex-1 overflow-y-auto scrollbar-hide">
        <p className="text-white/30 text-xs font-medium mb-3 uppercase tracking-wider">Recent</p>
        <div className="space-y-2">
          {RECENTS.map((r) => (
            <button
              key={r}
              onClick={() => handleRecent(r)}
              className="w-full flex items-center gap-3 bg-surface rounded-xl px-4 py-3 text-left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-white/80 text-sm">{r}</span>
            </button>
          ))}
        </div>

        {/* Weather widget */}
        <div className="mt-6 bg-surface rounded-2xl p-4 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Current Conditions</p>
            {weatherData && (
              <span className="text-white/30 text-xs">Tempe, AZ</span>
            )}
          </div>

          {weatherLoading && !weatherData ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Big temp */}
              <div className="flex items-end gap-3 mb-4">
                <span className="text-4xl font-bold text-white">{tempF}°</span>
                <div className="pb-1">
                  <p className="text-white/40 text-xs">Feels like {apparentTempF ?? tempF}°F</p>
                  {windKmh !== null && (
                    <p className="text-white/30 text-xs">{Math.round(windKmh)} km/h wind</p>
                  )}
                </div>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <WeatherStat
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><path d="M12 2v10M12 22v-4M4.93 4.93l7.07 7.07M19.07 4.93l-7.07 7.07"/></svg>}
                  label="Humidity"
                  value={`${humidity}%`}
                />
                <WeatherStat
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
                  label="UV Index"
                  value={`${uvIndex}`}
                />
                <WeatherStat
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>}
                  label="Feels like"
                  value={`${apparentTempF ?? tempF}°F`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {route.loading && (
        <div className="absolute inset-0 bg-bg/80 flex flex-col items-center justify-center z-30">
          <div className="w-12 h-12 border-2 border-orange border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/60 text-sm">Computing cool route…</p>
        </div>
      )}
    </div>
  )
}

function WeatherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg rounded-xl p-2.5 flex flex-col items-center gap-1">
      {icon}
      <span className="text-white font-semibold text-sm">{value}</span>
      <span className="text-white/40 text-xs">{label}</span>
    </div>
  )
}
