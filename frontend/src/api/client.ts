import { BioMode, BioReading, RiskResponse, RouteResponse, StopsResponse, WeatherData } from '../types';

const BASE = '/api';

async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json();
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

export const api = {
  fetchRoutes: (origin: [number, number], destination: [number, number], sensitiveMode = false): Promise<RouteResponse> =>
    post('/route', { origin, destination, sensitive_mode: sensitiveMode }),

  fetchRisk: (p: { hr: number; hrv: number; skin_temp_c: number; ambient_temp_c: number; ride_minutes: number; baseline_hr?: number }): Promise<RiskResponse> =>
    post('/risk', p),

  fetchStops: (bbox?: { south: number; west: number; north: number; east: number }): Promise<StopsResponse> =>
    get('/stops', bbox),

  fetchWeather: (lat: number, lon: number): Promise<WeatherData> =>
    get('/weather', { lat, lon }),

  startBioSession: (mode: BioMode): Promise<{ session_id: string; mode: BioMode }> =>
    post('/bio/session', { mode }),

  readBio: (sessionId: string): Promise<BioReading> =>
    get(`/bio/${sessionId}`),
};
