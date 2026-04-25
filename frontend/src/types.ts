/**
 * types.ts — UI-layer types for PulseRoute frontend.
 *
 * Field names on BioSignal and Provenance now match shared/schema.py exactly.
 * API wire types live in lib/apiTypes.ts; these are the Zustand/screen types.
 */

import type { SourceRef } from './lib/apiTypes'

export type RiskLevel = 'green' | 'yellow' | 'red'
export type BioMode = 'baseline' | 'moderate' | 'dehydrating'

// Re-export SourceRef so screens can import it from one place
export type { SourceRef }

/**
 * Provenance — matches backend Provenance schema exactly.
 * Replaces the old flat { biosignal_source, biosignal_ts, env_source, env_ts } shape.
 */
export interface Provenance {
  bio_source: SourceRef | null
  env_source: SourceRef | null
  route_segment_id: string | null
}

/**
 * BioSignal — field names now match backend Biosignal schema.
 * hrv_ms (was hrv), skin_temp_c (was skin_temp). source added.
 */
export interface BioSignal {
  hr: number
  hrv_ms: number       // renamed from hrv
  skin_temp_c: number  // renamed from skin_temp
  timestamp: string
  source?: string      // optional for locally-generated signals
}

/**
 * Stop — UI-layer stop type used by map and alert cards.
 * Kept separate from api Stop (which has amenities[], source, source_ref).
 */
export interface Stop {
  id: string
  type: 'fountain' | 'cafe' | 'repair'
  name: string
  lat: number
  lng: number
  distance_m?: number
}

/**
 * RouteOption — UI-layer route card type.
 * Wave 1 Subagent C will map RouteResponse → RouteOption[].
 */
export interface RouteOption {
  id: 'fastest' | 'pulseroute'
  label: string
  distance_km: number
  eta_min: number
  peak_mrt: number
  shade_pct: number
  water_stops: number
  polyline: [number, number][]
  color: string
}

/**
 * SafetyAlert — UI-layer alert type used by Zustand store and alert cards.
 * Wave 1 Subagent B will map backend RiskResponse → SafetyAlert.
 */
export interface SafetyAlert {
  id: string
  message: string
  stop?: Stop
  risk: RiskLevel
  provenance: Provenance
  timestamp: string
  /** True when the backend Logic Gate returned fallback=true */
  is_fallback?: boolean
}

export interface RideRecord {
  id: string
  date: string
  origin: string
  destination: string
  distance_km: number
  duration_min: number
  exposure_deg_min: number
  water_stops_taken: number
  peak_risk: RiskLevel
  route_type: 'fastest' | 'pulseroute'
}

export interface RiderProfile {
  name: string
  age: number
  weight_kg: number
  sensitive_mode: boolean
  baseline_hr: number
}
