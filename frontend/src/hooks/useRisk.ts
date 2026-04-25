/**
 * useRisk.ts — Risk polling hook for PulseRoute.
 *
 * POSTs to /risk every 15 seconds during a ride.
 * Falls back gracefully on error — never crashes the screen.
 *
 * Fix 2: passes sensitive_mode + fitness_level for personalized thresholds.
 * Fix 3: passes upcoming_segments + current_eta_seconds for lookahead.
 */

import { useState, useRef, useCallback } from 'react'
import { postRisk } from '../lib/api'
import type { RiskResponse, RouteSegment } from '../lib/apiTypes'

const POLL_INTERVAL_MS = 15000

const CURRENT_LAT = 33.4255
const CURRENT_LNG = -111.9400

export interface UseRiskOptions {
  sensitiveMode?: boolean
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced' | null
}

export interface UseRiskReturn {
  data: RiskResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
  startPolling: (
    sessionId: string,
    baselineHr: number,
    options?: UseRiskOptions,
  ) => void
  stopPolling: () => void
  /** Call this each tick to update the segments used for lookahead */
  setUpcomingSegments: (segments: RouteSegment[], etaSeconds: number) => void
}

export function useRisk(): UseRiskReturn {
  const [data, setData] = useState<RiskResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const baselineHrRef = useRef<number>(65)
  const pollStartRef = useRef<number>(Date.now())
  const optionsRef = useRef<UseRiskOptions>({})
  const upcomingSegmentsRef = useRef<RouteSegment[]>([])
  const currentEtaRef = useRef<number>(0)

  const setUpcomingSegments = useCallback((segments: RouteSegment[], etaSeconds: number) => {
    upcomingSegmentsRef.current = segments
    currentEtaRef.current = etaSeconds
  }, [])

  const fireRiskCall = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return

    const rideMinutes = (Date.now() - pollStartRef.current) / 60000
    const opts = optionsRef.current

    try {
      const result = await postRisk({
        bio_session_id: sid,
        current_lat: CURRENT_LAT,
        current_lng: CURRENT_LNG,
        ride_minutes: rideMinutes,
        baseline_hr: baselineHrRef.current,
        sensitive_mode: opts.sensitiveMode ?? false,
        fitness_level: opts.fitnessLevel ?? null,
        upcoming_segments: upcomingSegmentsRef.current,
        current_eta_seconds: currentEtaRef.current,
      })
      setData(result)
      setError(null)
    } catch (err) {
      console.warn('[useRisk] postRisk failed, keeping previous data:', err)
      setError((err as Error).message ?? 'Risk fetch failed')
    }
  }, [])

  const startPolling = useCallback((
    sessionId: string,
    baselineHr: number,
    options: UseRiskOptions = {},
  ) => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current)
    sessionIdRef.current = sessionId
    baselineHrRef.current = baselineHr
    optionsRef.current = options
    pollStartRef.current = Date.now()
    setLoading(true)

    fireRiskCall().finally(() => setLoading(false))
    intervalRef.current = setInterval(fireRiskCall, POLL_INTERVAL_MS)
  }, [fireRiskCall])

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    sessionIdRef.current = null
  }, [])

  const refetch = useCallback(() => { fireRiskCall() }, [fireRiskCall])

  return {
    data, loading, error, refetch,
    startPolling, stopPolling, setUpcomingSegments,
  }
}
