/**
 * biosim.ts — local biosignal simulator (fallback / offline mode).
 *
 * Used by Wave 1 Subagent B as the fallback when the backend is unreachable.
 * Field names match BioSignal in types.ts (and Biosignal in shared/schema.py).
 */

import type { BioSignal, BioMode, RiskLevel } from '../types'

interface SimState {
  hr: number
  hrv_ms: number
  skin_temp_c: number
  t: number
}

const noise = (sigma: number) => (Math.random() - 0.5) * 2 * sigma

const targets: Record<BioMode, { hr: number; hrv_ms: number; skin_temp_c: number }> = {
  baseline:    { hr: 65,  hrv_ms: 50, skin_temp_c: 33.0 },
  moderate:    { hr: 110, hrv_ms: 28, skin_temp_c: 35.2 },
  dehydrating: { hr: 148, hrv_ms: 14, skin_temp_c: 36.8 },
}

let state: SimState = { hr: 65, hrv_ms: 50, skin_temp_c: 33.0, t: 0 }

export function tickBiosim(mode: BioMode): BioSignal {
  const tgt = targets[mode]
  const alpha = 0.04 // smoothing factor — slow drift

  state.hr        = state.hr        + alpha * (tgt.hr        - state.hr)        + noise(1.2)
  state.hrv_ms    = state.hrv_ms    + alpha * (tgt.hrv_ms    - state.hrv_ms)    + noise(0.8)
  state.skin_temp_c = state.skin_temp_c + alpha * (tgt.skin_temp_c - state.skin_temp_c) + noise(0.05)
  state.t++

  return {
    hr:          Math.round(state.hr),
    hrv_ms:      Math.round(state.hrv_ms * 10) / 10,
    skin_temp_c: Math.round(state.skin_temp_c * 10) / 10,
    timestamp:   new Date().toISOString(),
    source:      `sim_${mode}`,
  }
}

export function resetSim(): void {
  state = { hr: 65, hrv_ms: 50, skin_temp_c: 33.0, t: 0 }
}

/**
 * classifyRisk — local fallback classifier.
 * Used when POST /risk is unavailable. Mirrors the backend's hydration_service logic.
 */
export function classifyRisk(
  bio: BioSignal,
  baseline_hr: number,
  ambient_temp: number,
  ride_minutes: number,
): { level: RiskLevel; reasons: string[] } {
  let points = 0
  const reasons: string[] = []

  const hr_delta = bio.hr - baseline_hr
  if (hr_delta > 30)       { points += 2; reasons.push(`HR +${hr_delta} above baseline`) }
  if (bio.hrv_ms < 20)     { points += 2; reasons.push(`Low HRV: ${bio.hrv_ms} ms`) }
  if (bio.skin_temp_c > 36){ points += 1; reasons.push(`Skin temp ${bio.skin_temp_c}°C`) }
  if (ambient_temp > 38)   { points += 1; reasons.push(`Ambient ${ambient_temp}°C`) }
  if (ride_minutes > 30)   { points += 1; reasons.push(`${ride_minutes} min on bike`) }

  const level: RiskLevel = points <= 2 ? 'green' : points <= 4 ? 'yellow' : 'red'
  return { level, reasons }
}
