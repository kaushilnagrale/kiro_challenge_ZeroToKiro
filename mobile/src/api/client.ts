import {
  BioMode,
  BioReading,
  RiskResponse,
  RouteResponse,
  StopsResponse,
  WeatherData,
} from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

async function post<T>(path: string, body: object): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`POST ${path} → ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`GET ${path} → ${resp.status}`);
  return resp.json() as Promise<T>;
}

export const api = {
  fetchRoutes: (
    origin: [number, number],
    destination: [number, number],
    sensitiveMode = false,
  ): Promise<RouteResponse> =>
    post('/route', { origin, destination, sensitive_mode: sensitiveMode }),

  fetchRisk: (params: {
    hr: number;
    hrv: number;
    skin_temp_c: number;
    ambient_temp_c: number;
    ride_minutes: number;
    baseline_hr?: number;
  }): Promise<RiskResponse> => post('/risk', params),

  fetchStops: (bbox?: { south: number; west: number; north: number; east: number }): Promise<StopsResponse> =>
    get('/stops', bbox),

  fetchWeather: (lat: number, lon: number): Promise<WeatherData> =>
    get('/weather', { lat, lon }),

  startBioSession: (mode: BioMode): Promise<{ session_id: string; mode: BioMode }> =>
    post('/bio/session', { mode }),

  readBio: (sessionId: string): Promise<BioReading> =>
    get(`/bio/${sessionId}`),

  health: (): Promise<{ status: string }> =>
    get('/health'),
};
