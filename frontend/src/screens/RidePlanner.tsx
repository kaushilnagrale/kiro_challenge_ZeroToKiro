import { useState } from 'react'
import { useStore } from '../store'
import { MOCK_ROUTES, MOCK_STOPS } from '../lib/mockData'

const RECENTS = ['Tempe Town Lake', 'Mill Ave & 5th St', 'ASU West Campus', 'Scottsdale Rd & Thomas']

export function RidePlanner() {
  const { origin, destination, setDestination, setRoutes, setStops, setScreen, profile } = useStore()
  const [query, setQuery] = useState(destination)
  const [loading, setLoading] = useState(false)

  const weather = { temp: 41, humidity: 18, advisory: true }

  function handleSearch(dest: string) {
    setQuery(dest)
    setDestination(dest)
    setLoading(true)
    setTimeout(() => {
      setRoutes(MOCK_ROUTES)
      setStops(MOCK_STOPS)
      setLoading(false)
      setScreen('preview')
    }, 1200)
  }

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <p className="text-white/40 text-sm">Hey {profile?.name ?? 'Rider'} 👋</p>
        <h2 className="text-2xl font-bold text-white mt-0.5">Where to?</h2>
      </div>

      {/* Heat advisory banner */}
      {weather.advisory && (
        <div className="mx-5 mb-4 bg-advisory/20 border border-advisory/40 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-advisory text-lg">⚠️</span>
          <div>
            <p className="text-advisory text-sm font-medium">NWS Heat Advisory Active</p>
            <p className="text-white/50 text-xs mt-0.5">{weather.temp}°C · {weather.humidity}% humidity · Feels like 47°C</p>
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

      {/* Destination input */}
      <div className="mx-5 mb-5">
        <div className="bg-surface border border-orange/60 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-orange text-sm">●</span>
          <input
            autoFocus
            placeholder="Enter destination…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && query && handleSearch(query)}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/30 text-lg leading-none">×</button>
          )}
        </div>
      </div>

      {/* Recents */}
      <div className="px-5 flex-1 overflow-y-auto scrollbar-hide">
        <p className="text-white/30 text-xs font-medium mb-3 uppercase tracking-wider">Recent</p>
        <div className="space-y-2">
          {RECENTS.map((r) => (
            <button
              key={r}
              onClick={() => handleSearch(r)}
              className="w-full flex items-center gap-3 bg-surface rounded-xl px-4 py-3 text-left"
            >
              <span className="text-white/30 text-base">🕐</span>
              <span className="text-white/80 text-sm">{r}</span>
            </button>
          ))}
        </div>

        {/* Weather widget */}
        <div className="mt-6 bg-surface rounded-2xl p-4">
          <p className="text-white/40 text-xs font-medium mb-3 uppercase tracking-wider">Current Conditions</p>
          <div className="grid grid-cols-3 gap-3">
            <WeatherStat icon="🌡️" label="Temp" value={`${weather.temp}°C`} />
            <WeatherStat icon="💧" label="Humidity" value={`${weather.humidity}%`} />
            <WeatherStat icon="☀️" label="UV Index" value="11" />
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-bg/80 flex flex-col items-center justify-center z-30">
          <div className="w-12 h-12 border-2 border-orange border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/60 text-sm">Computing cool route…</p>
        </div>
      )}
    </div>
  )
}

function WeatherStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl">{icon}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
      <span className="text-white/40 text-xs">{label}</span>
    </div>
  )
}
