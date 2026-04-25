import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BioSignal, BioMode, RiskLevel, RouteOption, SafetyAlert, RideRecord, RiderProfile, Stop } from './types'

interface AppState {
  // Profile
  profile: RiderProfile | null
  setProfile: (p: RiderProfile) => void

  // Route planning
  origin: string
  destination: string
  setOrigin: (v: string) => void
  setDestination: (v: string) => void
  routes: RouteOption[]
  setRoutes: (r: RouteOption[]) => void
  selectedRoute: 'fastest' | 'pulseroute'
  setSelectedRoute: (r: 'fastest' | 'pulseroute') => void
  stops: Stop[]
  setStops: (s: Stop[]) => void

  // Live ride
  isRiding: boolean
  startRide: () => void
  endRide: () => void
  bioMode: BioMode
  setBioMode: (m: BioMode) => void
  biosignal: BioSignal
  setBiosignal: (b: BioSignal) => void
  riskLevel: RiskLevel
  setRiskLevel: (r: RiskLevel) => void
  alerts: SafetyAlert[]
  addAlert: (a: SafetyAlert) => void
  dismissAlert: (id: string) => void
  activeAlert: SafetyAlert | null
  setActiveAlert: (a: SafetyAlert | null) => void

  // History
  rideHistory: RideRecord[]
  addRideRecord: (r: RideRecord) => void

  // UI
  screen: 'onboarding' | 'planner' | 'preview' | 'live' | 'history'
  setScreen: (s: AppState['screen']) => void
  provenanceModal: SafetyAlert | null
  setProvenanceModal: (a: SafetyAlert | null) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (p) => set({ profile: p }),

      origin: 'Memorial Union, ASU Tempe',
      destination: '',
      setOrigin: (v) => set({ origin: v }),
      setDestination: (v) => set({ destination: v }),
      routes: [],
      setRoutes: (r) => set({ routes: r }),
      selectedRoute: 'pulseroute',
      setSelectedRoute: (r) => set({ selectedRoute: r }),
      stops: [],
      setStops: (s) => set({ stops: s }),

      isRiding: false,
      startRide: () => set({ isRiding: true, alerts: [] }),
      endRide: () => set({ isRiding: false }),
      bioMode: 'baseline',
      setBioMode: (m) => set({ bioMode: m }),
      biosignal: { hr: 65, hrv: 50, skin_temp: 33.0, timestamp: new Date().toISOString() },
      setBiosignal: (b) => set({ biosignal: b }),
      riskLevel: 'green',
      setRiskLevel: (r) => set({ riskLevel: r }),
      alerts: [],
      addAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts].slice(0, 10) })),
      dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      activeAlert: null,
      setActiveAlert: (a) => set({ activeAlert: a }),

      rideHistory: [],
      addRideRecord: (r) => set((s) => ({ rideHistory: [r, ...s.rideHistory] })),

      screen: 'onboarding',
      setScreen: (s) => set({ screen: s }),
      provenanceModal: null,
      setProvenanceModal: (a) => set({ provenanceModal: a }),
    }),
    {
      name: 'pulseroute-store',
      partialize: (s) => ({ profile: s.profile, rideHistory: s.rideHistory }),
    }
  )
)
