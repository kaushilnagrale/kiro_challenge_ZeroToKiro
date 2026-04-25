/**
 * apiTypes.ts — TypeScript mirrors of shared/schema.py
 *
 * Field names are IDENTICAL to the backend (snake_case).
 * This file is the frontend contract. Do not rename fields here;
 * rename them in shared/schema.py and regenerate this file instead.
 *
 * Models included: every type consumed by Tier 1 + Tier 2 endpoints.
 */

// ─────────── Provenance ───────────

export interface SourceRef {
  source_id: string
  timestamp: string   // ISO 8601
  age_seconds: number
}

export interface Provenance {
  bio_source: SourceRef | null
  env_source: SourceRef | null
  route_segment_id: string | null
}

// ─────────── Biosignal ───────────

export type BioMode = 'baseline' | 'moderate' | 'dehydrating'
export type BioSource = 'sim_baseline' | 'sim_moderate' | 'sim_dehydrating' | 'healthkit'

export interface Biosignal {
  hr: number
  hrv_ms: number        // was hrv in old frontend type
  skin_temp_c: number   // was skin_temp in old frontend type
  timestamp: string     // ISO 8601
  source: BioSource
}

// ─────────── Bio mode request ───────────

export interface BioModeRequest {
  session_id: string
  mode: BioMode
}

export interface BioModeResponse {
  session_id: string
  mode: string
  provenance: Provenance
}

// ─────────── Weather ───────────

export interface WeatherSnapshot {
  temp_c: number
  humidity_pct: number
  heat_index_c: number | null
  uv_index: number | null
  apparent_temp_c: number | null
  wind_kmh: number | null
}

export interface WeatherHourly {
  at: string            // ISO 8601
  temp_c: number
  humidity_pct: number
  uv_index: number | null
}

export interface Advisory {
  id: string
  headline: string
  severity: string
  effective: string     // ISO 8601
  expires: string       // ISO 8601
  source: string
}

export interface AirQuality {
  aqi: number
  dominant_pollutant: string
}

export interface WeatherResponse {
  current: WeatherSnapshot
  forecast_hourly: WeatherHourly[]
  advisories: Advisory[]
  air_quality: AirQuality | null
  provenance: Provenance
}

// ─────────── Stops ───────────

export type Amenity = 'water' | 'shade' | 'food' | 'restroom' | 'ac' | 'bike_repair'

export interface Stop {
  id: string
  name: string
  lat: number
  lng: number
  amenities: Amenity[]
  open_now: boolean | null
  source: string
  source_ref: string
}

export interface StopsResponse {
  fountains: Stop[]
  cafes: Stop[]
  repair: Stop[]
  shade_zones: Stop[]
  provenance: Provenance
}

// ─────────── Route ───────────

export interface RouteSegment {
  id: string
  polyline: [number, number][]
  mrt_mean_c: number
  length_m: number
  eta_seconds_into_ride: number
  forecasted_temp_c: number | null
}

export interface Route {
  polyline: [number, number][]
  distance_m: number
  eta_seconds: number
  peak_mrt_c: number
  mean_mrt_c: number
  shade_pct: number
  stops: Stop[]
  segments: RouteSegment[]
  provenance: Provenance
}

export interface RouteRequest {
  origin: [number, number]
  destination: [number, number]
  depart_time: string   // ISO 8601
  sensitive_mode: boolean
  bio_session_id: string | null
  amenity_prefs: Amenity[]
}

export interface RouteResponse {
  fastest: Route
  pulseroute: Route
  provenance: Provenance
}

// ─────────── Risk & Safety ───────────

export type RiskLevel = 'green' | 'yellow' | 'red'

export interface RiskScore {
  level: RiskLevel
  points: number
  top_reason: string
  all_reasons: string[]
  provenance: Provenance
}

export interface SafetyAlert {
  risk: RiskScore
  suggested_stop: Stop | null
  message: string
  provenance: Provenance
}

export interface RiskRequest {
  bio_session_id: string
  current_lat: number
  current_lng: number
  ride_minutes: number
  baseline_hr: number | null
  // Fix 2: personalized thresholds
  sensitive_mode: boolean
  fitness_level: 'beginner' | 'intermediate' | 'advanced' | null
  // Fix 3: upcoming segments for lookahead
  upcoming_segments: RouteSegment[]
  current_eta_seconds: number
}

export interface LookaheadWarning {
  projected_points: number
  reason: string
  seconds_until_hot_zone: number
  peak_mrt_c: number
}

export interface RiskResponse {
  alert: SafetyAlert | null
  fallback: boolean
  fallback_message: string | null
  lookahead: LookaheadWarning | null
  stop_reason: string | null
}
