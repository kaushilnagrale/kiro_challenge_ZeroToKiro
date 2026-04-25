# Spec: PulseRoute Mobile App

## Goal
React Native + Expo app that runs in Expo Go on iOS Simulator. Shows map,
two route options, live biosignal panel, and stop notifications.

## Screens
1. **Search** — destination input, recents, current location button
2. **RouteCompare** — two polylines on map, swipeable detail cards
3. **Ride** — live map, biosignal bottom sheet, alert cards
4. **Summary** — post-ride exposure stats and route comparison

## Components
- `<RouteCard type="fastest|pulse">` — distance, ETA, peak MRT, water stops
- `<BiosignalPanel>` — HR, HRV, skin temp, hydration score (Green/Yellow/Red)
- `<StopAlert>` — non-modal card with stop name, distance, reasoning
- `<ProvenanceModal>` — tap-to-expand citation list with source IDs and timestamps

## API contracts (from backend)
```
POST /route  → { fastest: Route, pulseroute: Route, weather: Weather, provenance: P }
POST /risk   → { score: "green"|"yellow"|"red", reasons: string[], risk_points: int, provenance: P }
GET  /stops  → { fountains: [...], cafes: [...], repair: [...], provenance: P }
GET  /weather → { ambient_temp_c, humidity_pct, heat_index_c, advisory }
POST /bio/session → { session_id, mode }
GET  /bio/:id → { hr, hrv, skin_temp_c, timestamp, mode }
```

## State (Zustand)
- `origin` / `destination` coordinates + labels
- `routes` — fastest + pulseroute RouteObj
- `activeRoute` — which route the rider is following
- `biosignalSession` — session_id, mode, latest reading
- `rideState` — "idle" | "comparing" | "riding" | "finished"
- `alerts` — queue of pending stop alerts
- `weather` — current weather data
- `stops` — fountains, cafes, repair stations

## Acceptance
- App boots in iOS Simulator via `npx expo start`
- Demo route (MU → Tempe Town Lake) renders both routes correctly
- Toggling biosignal sim mode visibly changes the hydration score
- Tap any safety alert opens the provenance modal
- Yellow/Red score triggers stop card with correct reasoning
