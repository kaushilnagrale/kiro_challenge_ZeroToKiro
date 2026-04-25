import { useState, useEffect, useCallback } from 'react'
import { getWeather } from '../lib/api'
import type { WeatherResponse } from '../lib/apiTypes'

const ASU_TEMPE_LAT = 33.4255
const ASU_TEMPE_LNG = -111.9400
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

interface UseWeatherResult {
  data: WeatherResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useWeather(): UseWeatherResult {
  const [data, setData] = useState<WeatherResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getWeather(ASU_TEMPE_LAT, ASU_TEMPE_LNG)
      setData(result)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching weather'
      console.warn('[useWeather] Failed to fetch weather data:', message)
      setError(message)
      // Keep previous data if any — do not clear it
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWeather()

    const interval = setInterval(fetchWeather, REFRESH_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [fetchWeather])

  return { data, loading, error, refetch: fetchWeather }
}
