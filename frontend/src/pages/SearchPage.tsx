import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useStore } from '../store/useStore';

const QUICK_DESTINATIONS = [
  { label: 'Tempe Town Lake', coords: [33.4255, -111.9155] as [number, number] },
  { label: 'Old Town Scottsdale', coords: [33.4942, -111.9261] as [number, number] },
  { label: 'Papago Park', coords: [33.4563, -111.9466] as [number, number] },
  { label: 'Desert Botanical Garden', coords: [33.4616, -111.9444] as [number, number] },
];

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function SearchPage() {
  const { origin, originLabel, setDestination, setRouteResponse, setWeather, setPage } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sensitiveMode, setSensitiveMode] = useState(false);

  // Destination state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Geocode with Nominatim on input change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  function selectSuggestion(r: NominatimResult) {
    const coords: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
    // Shorten the display name to the first two comma-separated parts
    const short = r.display_name.split(',').slice(0, 2).join(', ');
    setQuery(short);
    setSelectedLabel(short);
    setDestCoords(coords);
    setDestination(coords, short);
    setSuggestions([]);
    setShowDropdown(false);
  }

  function selectQuick(label: string, coords: [number, number]) {
    setQuery(label);
    setSelectedLabel(label);
    setDestCoords(coords);
    setDestination(coords, label);
    setSuggestions([]);
    setShowDropdown(false);
  }

  async function handleGo() {
    if (!destCoords) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.fetchRoutes(origin, destCoords, sensitiveMode);
      setRouteResponse(response);
      if (response.weather) setWeather(response.weather);
      setPage('compare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 pt-6">
      {/* Origin */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Starting From</p>
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">📍</span>
          <p className="font-semibold text-slate-800">{originLabel}</p>
        </div>
      </div>

      {/* Destination search */}
      <div className="relative">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Destination</p>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedLabel(null);
              setDestCoords(null);
            }}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="Search any address or place…"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-sky-400 outline-none px-4 py-3 pr-10 text-slate-800 placeholder-slate-400 bg-white shadow-sm"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm animate-spin">⟳</span>
          )}
          {destCoords && !searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-lg overflow-hidden">
            {suggestions.map((r) => (
              <li key={r.place_id}>
                <button
                  onMouseDown={() => selectSuggestion(r)}
                  className="w-full text-left px-4 py-2.5 hover:bg-sky-50 text-sm text-slate-700 border-b border-slate-100 last:border-0"
                >
                  <span className="mr-2 text-slate-400">🏁</span>
                  {r.display_name.length > 70 ? r.display_name.slice(0, 70) + '…' : r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick destinations */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Quick Picks</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_DESTINATIONS.map((d) => (
            <button
              key={d.label}
              onClick={() => selectQuick(d.label, d.coords)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                selectedLabel === d.label
                  ? 'bg-sky-50 border-sky-500 shadow-md'
                  : 'bg-white border-slate-200 hover:border-sky-300'
              }`}
            >
              <span className="text-lg">🏁</span>
              <p className={`text-sm font-semibold mt-1 ${selectedLabel === d.label ? 'text-sky-700' : 'text-slate-700'}`}>
                {d.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Heat sensitivity toggle */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-amber-800 text-sm">Heat-Sensitive Mode</p>
          <p className="text-xs text-amber-600">Maximizes shade weight (α=0.9) for elderly/medical riders</p>
        </div>
        <button
          onClick={() => setSensitiveMode(!sensitiveMode)}
          className={`w-12 h-7 rounded-full transition-colors relative ${sensitiveMode ? 'bg-amber-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${sensitiveMode ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {/* Live weather hint */}
      <WeatherHint origin={origin} />

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-red-700 text-sm">{error}</div>
      )}

      <button
        onClick={handleGo}
        disabled={!destCoords || loading}
        className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-colors"
      >
        {loading ? '⏳ Calculating Cool Route…' : '🚴 Find PulseRoute'}
      </button>

      <p className="text-center text-xs text-slate-400">
        Geocoding via Nominatim · Routes via OSRM · Weather via Open-Meteo · No API key required
      </p>
    </div>
  );
}

function WeatherHint({ origin }: { origin: [number, number] }) {
  const weather = useStore((s) => s.weather);
  const setWeather = useStore((s) => s.setWeather);
  const [fetched, setFetched] = React.useState(false);

  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    api.fetchWeather(origin[0], origin[1]).then(setWeather).catch(() => {});
  }, []);

  if (!weather) return null;

  const color = weather.ambient_temp_c >= 40 ? 'bg-red-50 border-red-200 text-red-800'
    : weather.ambient_temp_c >= 35 ? 'bg-orange-50 border-orange-200 text-orange-800'
    : 'bg-green-50 border-green-200 text-green-800';

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${color}`}>
      <span className="text-2xl">🌡️</span>
      <div>
        <p className="font-bold text-sm">{weather.ambient_temp_c.toFixed(1)}°C · Feels {weather.heat_index_c.toFixed(1)}°C</p>
        <p className="text-xs opacity-80">{weather.advisory ?? `Humidity ${weather.humidity_pct}%`}</p>
      </div>
    </div>
  );
}
