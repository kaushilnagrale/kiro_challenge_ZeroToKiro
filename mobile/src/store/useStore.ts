import { create } from 'zustand';
import {
  BioMode,
  BioReading,
  Coordinate,
  RideState,
  RideStats,
  RiskResponse,
  RouteObj,
  RouteResponse,
  StopPoint,
  StopsResponse,
  WeatherData,
} from '../types';

interface PulseRouteStore {
  // ── Location ──────────────────────────────────────────────────────────────
  origin: Coordinate | null;
  originLabel: string;
  destination: Coordinate | null;
  destinationLabel: string;
  setOrigin: (coord: Coordinate, label: string) => void;
  setDestination: (coord: Coordinate, label: string) => void;

  // ── Routes ────────────────────────────────────────────────────────────────
  routeResponse: RouteResponse | null;
  activeRoute: RouteObj | null;
  setRouteResponse: (r: RouteResponse) => void;
  setActiveRoute: (r: RouteObj) => void;

  // ── Stops ─────────────────────────────────────────────────────────────────
  stops: StopsResponse | null;
  setStops: (s: StopsResponse) => void;

  // ── Weather ───────────────────────────────────────────────────────────────
  weather: WeatherData | null;
  setWeather: (w: WeatherData) => void;

  // ── Biosignal simulator ───────────────────────────────────────────────────
  bioSessionId: string | null;
  bioMode: BioMode;
  bioReading: BioReading | null;
  setBioSession: (id: string, mode: BioMode) => void;
  setBioReading: (r: BioReading) => void;
  setBioMode: (mode: BioMode) => void;

  // ── Risk ──────────────────────────────────────────────────────────────────
  riskResponse: RiskResponse | null;
  setRiskResponse: (r: RiskResponse) => void;

  // ── Ride state ────────────────────────────────────────────────────────────
  rideState: RideState;
  rideStats: RideStats | null;
  setRideState: (s: RideState) => void;
  startRide: () => void;
  endRide: () => void;

  // ── Alerts ────────────────────────────────────────────────────────────────
  pendingAlert: { message: string; stop: StopPoint | null; reasons: string[] } | null;
  showAlert: (alert: { message: string; stop: StopPoint | null; reasons: string[] }) => void;
  dismissAlert: () => void;

  // ── Provenance modal ──────────────────────────────────────────────────────
  provenanceTarget: RiskResponse | RouteResponse | null;
  setProvenanceTarget: (t: RiskResponse | RouteResponse | null) => void;

  // ── Reset ─────────────────────────────────────────────────────────────────
  reset: () => void;
}

export const useStore = create<PulseRouteStore>((set, get) => ({
  // ── Location ──────────────────────────────────────────────────────────────
  origin: { latitude: 33.4176, longitude: -111.9341 },
  originLabel: 'ASU Memorial Union',
  destination: null,
  destinationLabel: '',
  setOrigin: (coord, label) => set({ origin: coord, originLabel: label }),
  setDestination: (coord, label) => set({ destination: coord, destinationLabel: label }),

  // ── Routes ────────────────────────────────────────────────────────────────
  routeResponse: null,
  activeRoute: null,
  setRouteResponse: (r) => set({ routeResponse: r, rideState: 'comparing' }),
  setActiveRoute: (r) => set({ activeRoute: r }),

  // ── Stops ─────────────────────────────────────────────────────────────────
  stops: null,
  setStops: (s) => set({ stops: s }),

  // ── Weather ───────────────────────────────────────────────────────────────
  weather: null,
  setWeather: (w) => set({ weather: w }),

  // ── Biosignal simulator ───────────────────────────────────────────────────
  bioSessionId: null,
  bioMode: 'baseline',
  bioReading: null,
  setBioSession: (id, mode) => set({ bioSessionId: id, bioMode: mode }),
  setBioReading: (r) => set({ bioReading: r }),
  setBioMode: (mode) => set({ bioMode: mode }),

  // ── Risk ──────────────────────────────────────────────────────────────────
  riskResponse: null,
  setRiskResponse: (r) => set({ riskResponse: r }),

  // ── Ride state ────────────────────────────────────────────────────────────
  rideState: 'idle',
  rideStats: null,
  setRideState: (s) => set({ rideState: s }),
  startRide: () =>
    set({
      rideState: 'riding',
      rideStats: {
        startTime: new Date(),
        stopsVisited: [],
        peakRiskScore: 'green',
        exposureDegreesMin: 0,
      },
    }),
  endRide: () => {
    const current = get().rideStats;
    set({
      rideState: 'finished',
      rideStats: current ? { ...current, endTime: new Date() } : null,
    });
  },

  // ── Alerts ────────────────────────────────────────────────────────────────
  pendingAlert: null,
  showAlert: (alert) => set({ pendingAlert: alert }),
  dismissAlert: () => set({ pendingAlert: null }),

  // ── Provenance modal ──────────────────────────────────────────────────────
  provenanceTarget: null,
  setProvenanceTarget: (t) => set({ provenanceTarget: t }),

  // ── Reset ─────────────────────────────────────────────────────────────────
  reset: () =>
    set({
      destination: null,
      destinationLabel: '',
      routeResponse: null,
      activeRoute: null,
      rideState: 'idle',
      rideStats: null,
      pendingAlert: null,
      riskResponse: null,
      bioSessionId: null,
      bioReading: null,
    }),
}));
