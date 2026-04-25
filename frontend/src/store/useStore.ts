import { create } from 'zustand';
import { AppPage, BioMode, BioReading, RiskResponse, RouteObj, RouteResponse, StopPoint, StopsResponse, WeatherData } from '../types';

interface Store {
  page: AppPage;
  setPage: (p: AppPage) => void;

  origin: [number, number];
  originLabel: string;
  destination: [number, number] | null;
  destinationLabel: string;
  setOrigin: (c: [number, number], label: string) => void;
  setDestination: (c: [number, number], label: string) => void;

  routeResponse: RouteResponse | null;
  activeRoute: RouteObj | null;
  setRouteResponse: (r: RouteResponse) => void;
  setActiveRoute: (r: RouteObj) => void;

  stops: StopsResponse | null;
  setStops: (s: StopsResponse) => void;

  weather: WeatherData | null;
  setWeather: (w: WeatherData) => void;

  bioSessionId: string | null;
  bioMode: BioMode;
  bioReading: BioReading | null;
  setBioSession: (id: string, mode: BioMode) => void;
  setBioReading: (r: BioReading) => void;
  setBioMode: (m: BioMode) => void;

  riskResponse: RiskResponse | null;
  setRiskResponse: (r: RiskResponse) => void;

  rideStartTime: Date | null;
  rideEndTime: Date | null;
  startRide: () => void;
  endRide: () => void;

  alert: { message: string; stop: StopPoint | null; reasons: string[] } | null;
  showAlert: (a: { message: string; stop: StopPoint | null; reasons: string[] }) => void;
  dismissAlert: () => void;

  provenanceOpen: boolean;
  setProvenanceOpen: (v: boolean) => void;

  reset: () => void;
}

export const useStore = create<Store>((set) => ({
  page: 'search',
  setPage: (page) => set({ page }),

  origin: [33.4176, -111.9341],
  originLabel: 'ASU Memorial Union',
  destination: null,
  destinationLabel: '',
  setOrigin: (origin, originLabel) => set({ origin, originLabel }),
  setDestination: (destination, destinationLabel) => set({ destination, destinationLabel }),

  routeResponse: null,
  activeRoute: null,
  setRouteResponse: (routeResponse) => set({ routeResponse }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),

  stops: null,
  setStops: (stops) => set({ stops }),

  weather: null,
  setWeather: (weather) => set({ weather }),

  bioSessionId: null,
  bioMode: 'baseline',
  bioReading: null,
  setBioSession: (bioSessionId, bioMode) => set({ bioSessionId, bioMode }),
  setBioReading: (bioReading) => set({ bioReading }),
  setBioMode: (bioMode) => set({ bioMode }),

  riskResponse: null,
  setRiskResponse: (riskResponse) => set({ riskResponse }),

  rideStartTime: null,
  rideEndTime: null,
  startRide: () => set({ rideStartTime: new Date(), rideEndTime: null }),
  endRide: () => set({ rideEndTime: new Date() }),

  alert: null,
  showAlert: (alert) => set({ alert }),
  dismissAlert: () => set({ alert: null }),

  provenanceOpen: false,
  setProvenanceOpen: (provenanceOpen) => set({ provenanceOpen }),

  reset: () => set({
    page: 'search', destination: null, destinationLabel: '',
    routeResponse: null, activeRoute: null, rideStartTime: null, rideEndTime: null,
    alert: null, riskResponse: null, bioSessionId: null, bioReading: null,
  }),
}));
