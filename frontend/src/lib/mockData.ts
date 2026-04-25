import type { RouteOption, Stop, RideRecord } from '../types'

export const MOCK_ROUTES: RouteOption[] = [
  {
    id: 'fastest',
    label: 'Fastest',
    distance_km: 4.2,
    eta_min: 14,
    peak_mrt: 58,
    shade_pct: 12,
    water_stops: 1,
    color: '#60a5fa',
    polyline: [
      [33.4255, -111.9400],
      [33.4230, -111.9380],
      [33.4200, -111.9350],
      [33.4170, -111.9320],
      [33.4148, -111.9290],
    ],
  },
  {
    id: 'pulseroute',
    label: 'PulseRoute',
    distance_km: 5.1,
    eta_min: 17,
    peak_mrt: 34,
    shade_pct: 68,
    water_stops: 4,
    color: '#ffb693',
    polyline: [
      [33.4255, -111.9400],
      [33.4260, -111.9430],
      [33.4240, -111.9460],
      [33.4210, -111.9450],
      [33.4180, -111.9420],
      [33.4160, -111.9380],
      [33.4148, -111.9290],
    ],
  },
]

export const MOCK_STOPS: Stop[] = [
  { id: 's1', type: 'fountain', name: 'MU Courtyard Fountain', lat: 33.4248, lng: -111.9415, distance_m: 80 },
  { id: 's2', type: 'fountain', name: 'Hayden Library Fountain', lat: 33.4235, lng: -111.9445, distance_m: 210 },
  { id: 's3', type: 'cafe',    name: 'Cartel Coffee Lab',       lat: 33.4220, lng: -111.9460, distance_m: 450 },
  { id: 's4', type: 'fountain', name: 'Mill Ave Fountain',      lat: 33.4195, lng: -111.9440, distance_m: 680 },
  { id: 's5', type: 'repair',  name: 'ASU Bike Repair Station', lat: 33.4175, lng: -111.9410, distance_m: 920 },
  { id: 's6', type: 'fountain', name: 'Tempe Town Lake Kiosk',  lat: 33.4155, lng: -111.9310, distance_m: 1200 },
]

export const MOCK_HISTORY: RideRecord[] = [
  {
    id: 'r1',
    date: '2026-04-23T08:14:00Z',
    origin: 'Memorial Union, ASU',
    destination: 'Tempe Town Lake',
    distance_km: 5.1,
    duration_min: 19,
    exposure_deg_min: 312,
    water_stops_taken: 2,
    peak_risk: 'yellow',
    route_type: 'pulseroute',
  },
  {
    id: 'r2',
    date: '2026-04-22T17:30:00Z',
    origin: 'Tempe Town Lake',
    destination: 'ASU West Campus',
    distance_km: 12.4,
    duration_min: 41,
    exposure_deg_min: 890,
    water_stops_taken: 3,
    peak_risk: 'red',
    route_type: 'pulseroute',
  },
  {
    id: 'r3',
    date: '2026-04-21T07:00:00Z',
    origin: 'Memorial Union, ASU',
    destination: 'Mill Ave & 5th St',
    distance_km: 2.8,
    duration_min: 10,
    exposure_deg_min: 88,
    water_stops_taken: 0,
    peak_risk: 'green',
    route_type: 'fastest',
  },
]
