export interface ProvenanceObj {
  biosignal_source_id: string | null;
  biosignal_timestamp: string | null;
  environmental_source_id: string | null;
  environmental_timestamp: string | null;
  route_segment_id: string | null;
}

export interface StopPoint {
  id: string;
  type: 'fountain' | 'cafe' | 'repair' | 'bench';
  name: string;
  lat: number;
  lon: number;
  distance_m?: number;
}

export interface RouteObj {
  type: 'fastest' | 'pulseroute';
  polyline: [number, number][];   // [lat, lon][]
  distance_m: number;
  duration_s: number;
  peak_mrt_c: number;
  shade_pct: number;
  water_stops: StopPoint[];
  segment_id: string;
  mrt_differential?: number;
}

export interface RouteResponse {
  fastest: RouteObj;
  pulseroute: RouteObj;
  weather: WeatherData | null;
  provenance: ProvenanceObj;
}

export interface RiskResponse {
  score: 'green' | 'yellow' | 'red';
  risk_points: number;
  reasons: string[];
  provenance: ProvenanceObj;
}

export interface BioReading {
  session_id: string;
  hr: number;
  hrv: number;
  skin_temp_c: number;
  timestamp: string;
  mode: BioMode;
}

export type BioMode = 'baseline' | 'moderate' | 'dehydrating';

export interface WeatherData {
  ambient_temp_c: number;
  humidity_pct: number;
  heat_index_c: number;
  wind_speed_ms: number;
  source_id: string;
  timestamp: string;
  advisory: string | null;
}

export interface StopsResponse {
  fountains: StopPoint[];
  cafes: StopPoint[];
  repair: StopPoint[];
  provenance: ProvenanceObj;
}

export type AppPage = 'search' | 'compare' | 'ride' | 'summary';
