import type { BioSignal, BioMode, RiskLevel } from '../types'

interface SimState {
  hr: number
  hrv: number
  skin_temp: number
  t: number
}

const noise = (sigma: number) => (Math.random() - 0.5) * 2 * sigma

const targets: Record<BioMode, { hr: number; hrv: number; skin_temp: number }> = {
  baseline:     { hr: 65,  hrv: 50, skin_temp: 33.0 },
  moderate:     { hr: 110, hrv: 28, skin_temp: 35.2 },
  dehydrating:  { hr: 148, hrv: 14, skin_temp: 36.8 },
}

let state: SimState = { hr: 65, hrv: 50, skin_temp: 33.0, t: 0 }

export function tickBiosim(mode: BioMode): BioSignal {
  const tgt = targets[mode]
  const alpha = 0.04 // smoothing factor — slow drift

  state.hr       = state.hr       + alpha * (tgt.hr       - state.hr)       + noise(1.2)
  state.hrv      = state.hrv      + alpha * (tgt.hrv      - state.hrv)      + noise(0.8)
  state.skin_temp = state.skin_temp + alpha * (tgt.skin_temp - state.skin_temp) + noise(0.05)
  state.t++

  return {
    hr:        Math.round(state.hr),
    hrv:       Math.round(state.hrv * 10) / 10,
    skin_temp: Math.round(state.skin_temp * 10) / 10,
    timestamp: new Date().toISOString(),
  }
}

export function resetSim(): void {
  state = { hr: 65, hrv: 50, skin_temp: 33.0, t: 0 }
}

export function classifyRisk(
  bio: BioSignal,
  baseline_hr: number,
  ambient_temp: number,
  ride_minutes: number
): { level: RiskLevel; reasons: string[] } {
  let points = 0
  const reasons: string[] = []

  const hr_delta = bio.hr - baseline_hr
  if (hr_delta > 30) { points += 2; reasons.push(`HR +${hr_delta} above baseline`) }
  if (bio.hrv < 20)  { points += 2; reasons.push(`Low HRV: ${bio.hrv} ms`) }
  if (bio.skin_temp > 36) { points += 1; reasons.push(`Skin temp ${bio.skin_temp}°C`) }
  if (ambient_temp > 38)  { points += 1; reasons.push(`Ambient ${ambient_temp}°C`) }
  if (ride_minutes > 30)  { points += 1; reasons.push(`${ride_minutes} min on bike`) }

  const level: RiskLevel = points <= 2 ? 'green' : points <= 4 ? 'yellow' : 'red'
  return { level, reasons }
}
