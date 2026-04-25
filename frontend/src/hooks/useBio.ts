/**
 * useBio.ts — Bio session lifecycle hook for PulseRoute.
 *
 * Manages session registration, polling, and mode switching via the backend.
 * Falls back to tickBiosim() on getBioCurrent errors — never crashes the screen.
 */

import { useState, useRef, useCallback } from 'react'
import { setBioMode as apiBioMode, getBioCurrent } from '../lib/api'
import { tickBiosim } from '../lib/biosim'
import type { BioMode } from '../lib/apiTypes'
import type { BioSignal } from '../types'

const POLL_INTERVAL_MS = 2000

export interface UseBioReturn {
  sessionId: string | null
  data: BioSignal | null
  loading: boolean
  error: string | null
  refetch: () => void
  startSession: (mode: BioMode) => Promise<void>
  stopSession: () => void
  setMode: (mode: BioMode) => Promise<void>
}

export function useBio(): UseBioReturn {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [data, setData] = useState<BioSignal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the current mode so the fallback tickBiosim call uses the right mode
  const currentModeRef = useRef<BioMode>('moderate')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const fetchCurrent = useCallback(async (sid: string) => {
    try {
      const biosignal = await getBioCurrent(sid)
      // Map backend Biosignal → UI BioSignal (fields are identical after Wave 0 renames)
      const uiBio: BioSignal = {
        hr: biosignal.hr,
        hrv_ms: biosignal.hrv_ms,
        skin_temp_c: biosignal.skin_temp_c,
        timestamp: biosignal.timestamp,
        source: biosignal.source,
      }
      setData(uiBio)
      setError(null)
    } catch (err) {
      console.warn('[useBio] getBioCurrent failed, falling back to biosim:', err)
      // Keep previous data; supplement with a biosim tick
      const fallback = tickBiosim(currentModeRef.current)
      setData(fallback)
      setError((err as Error).message ?? 'Bio fetch failed')
    }
  }, [])

  const startPolling = useCallback((sid: string) => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
    }
    // Immediate first fetch
    fetchCurrent(sid)
    intervalRef.current = setInterval(() => {
      fetchCurrent(sid)
    }, POLL_INTERVAL_MS)
  }, [fetchCurrent])

  const startSession = useCallback(async (mode: BioMode) => {
    setLoading(true)
    setError(null)
    const uuid = crypto.randomUUID()
    currentModeRef.current = mode
    try {
      await apiBioMode({ session_id: uuid, mode })
      sessionIdRef.current = uuid
      setSessionId(uuid)
      startPolling(uuid)
    } catch (err) {
      console.warn('[useBio] setBioMode (startSession) failed:', err)
      setError((err as Error).message ?? 'Session start failed')
      // Still store the session ID and start polling with biosim fallback
      sessionIdRef.current = uuid
      setSessionId(uuid)
      startPolling(uuid)
    } finally {
      setLoading(false)
    }
  }, [startPolling])

  const stopSession = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    sessionIdRef.current = null
    setSessionId(null)
  }, [])

  const setMode = useCallback(async (mode: BioMode) => {
    currentModeRef.current = mode
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      await apiBioMode({ session_id: sid, mode })
    } catch (err) {
      console.warn('[useBio] setBioMode (setMode) failed:', err)
    }
  }, [])

  const refetch = useCallback(() => {
    const sid = sessionIdRef.current
    if (sid) {
      fetchCurrent(sid)
    }
  }, [fetchCurrent])

  return {
    sessionId,
    data,
    loading,
    error,
    refetch,
    startSession,
    stopSession,
    setMode,
  }
}
