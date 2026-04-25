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

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  function selectSuggestion(r: NominatimResult) {
    const coords: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
    const short = r.display_name.split(',').slice(0, 2).join(', ');
    setQuery(short); setSelectedLabel(short); setDestCoords(coords);
    setDestination(coords, short); setSuggestions([]); setShowDropdown(false);
  }

  function selectQuick(label: string, coords: [number, number]) {
    setQuery(label); setSelectedLabel(label); setDestCoords(coords);
    setDestination(coords, label); setSuggestions([]); setShowDropdown(false);
  }

  async function handleGo() {
    if (!destCoords) return;
    setLoading(true); setError(null);
    try {
      const response = await api.fetchRoutes(origin, destCoords, sensitiveMode);
      setRouteResponse(response);
      if (response.weather) setWeather(response.weather);
      setPage('compare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch routes');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 pt-6">
      {/* Origin card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <p className="text-[10px] font-bold text-[#7d8590] uppercase tracking-widest mb-1.5">Starting From</p>
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-sm">📍</span>
          <p className="font-semibold text-white">{originLabel}</p>
        </div>
      </div>

      {/* Destination search */}
      <div className="relative">
        <p className="text-[10px] font-bold text-[#7d8590] uppercase tracking-widest mb-2 px-1">Destination</p>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedLabel(null); setDestCoords(null); }}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="Search any address or place…"
            className="w-full bg-[#161b22] border-2 border-[#30363d] focus:border-sky-500 outline-none rounded-xl px-4 py-3 pr-10 text-white placeholder-[#4d5562] transition-colors"
          />
          {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d8590] text-sm animate-spin">⟳</span>}
          {destCoords && !searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-50 w-full bg-[#161b22] border border-[#30363d] rounded-xl mt-1 shadow-2xl overflow-hidden">
            {suggestions.map((r) => (
              <li key={r.place_id}>
                <button
                  onMouseDown={() => selectSuggestion(r)}
                  className="w-full text-left px-4 py-3 hover:bg-[#21262d] text-sm text-[#e6edf3] border-b border-[#21262d] last:border-0 transition-colors"
                >
                  <span className="mr-2 text-[#7d8590]">🏁</span>
                  {r.display_name.length > 70 ? r.display_name.slice(0, 70) + '…' : r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick picks */}
      <div>
        <p className="text-[10px] font-bold text-[#7d8590] uppercase tracking-widest mb-2 px-1">Quick Picks</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_DESTINATIONS.map((d) => (
            <button
              key={d.label}
              onClick={() => selectQuick(d.label, d.coords)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                selectedLabel === d.label
                  ? 'bg-sky-500/10 border-sky-500 shadow-lg shadow-sky-500/10'
                  : 'bg-[#161b22] border-[#30363d] hover:border-[#4d5562]'
              }`}
            >
              <span className="text-base">🏁</span>
              <p className={`text-sm font-semibold mt-1 ${selectedLabel === d.label ? 'text-sky-400' : 'text-[#e6edf3]'}`}>
                {d.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Heat sensitivity */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-[#e6edf3] text-sm">Heat-Sensitive Mode</p>
          <p className="text-xs text-[#7d8590] mt-0.5">Max shade priority — for elderly or medical riders</p>
        </div>
        <button
          onClick={() => setSensitiveMode(!sensitiveMode)}
          className={`relative w-12 h-7 rounded-full transition-colors ${sensitiveMode ? 'bg-sky-500' : 'bg-[#30363d]'}`}
        >
          <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${sensitiveMode ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {/* Live weather */}
      <WeatherHint origin={origin} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>
      )}

      <button
        onClick={handleGo}
        disabled={!destCoords || loading}
        className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-[#21262d] disabled:text-[#4d5562] text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-sky-500/20 transition-all"
      >
        {loading ? '⏳ Calculating Route…' : '🚴 Find PulseRoute'}
      </button>

      <p className="text-center text-xs text-[#4d5562]">
        Geocoding · OSRM routing · Open-Meteo weather · No API key required
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

  const hot = weather.ambient_temp_c >= 38;
  const warm = weather.ambient_temp_c >= 30;

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${
      hot  ? 'bg-red-500/10 border-red-500/30' :
      warm ? 'bg-orange-500/10 border-orange-500/30' :
             'bg-green-500/10 border-green-500/30'
    }`}>
      <span className="text-2xl">🌡️</span>
      <div>
        <p className={`font-bold text-sm ${hot ? 'text-red-400' : warm ? 'text-orange-400' : 'text-green-400'}`}>
          {((weather.ambient_temp_c * 9/5) + 32).toFixed(0)}°F · Feels {((weather.heat_index_c * 9/5) + 32).toFixed(0)}°F
        </p>
        <p className="text-xs text-[#7d8590]">{weather.advisory ?? `Humidity ${weather.humidity_pct}%`}</p>
      </div>
    </div>
  );
}
