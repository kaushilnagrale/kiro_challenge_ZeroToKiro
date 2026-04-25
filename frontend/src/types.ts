export type RiskLevel = 'green' | 'yellow' | 'red'
export type BioMode = 'baseline' | 'moderate' | 'dehydrating'

export interface Provenance {
  biosignal_source: string
  biosignal_ts: string
  env_source: string
  env_ts: string
  route_segment_id: string
}

export interface BioSignal {
  hr: number
  hrv: number
  skin_temp: number
  timestamp: string
}

export interface Stop {
  id: string
  type: 'fountain' | 'cafe' | 'repair'
  name: string
  lat: number
  lng: number
  distance_m?: number
}

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

export interface SafetyAlert {
  id: string
  message: string
  stop?: Stop
  risk: RiskLevel
  provenance: Provenance
  timestamp: string
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
