# PulseRoute — Product Requirements Document
**Kiro Spark Challenge · Environment Frame · April 24, 2026**

---

## TL;DR

PulseRoute is a mobile co-pilot for cyclists in hot cities. It plans the **coolest, safest route** from A to B, monitors smartwatch biosignals for **dehydration and heat stress**, and proactively suggests stops — water fountains, shaded benches, cafes, bike-repair stations — *before* the rider hits trouble. Think **Waze + Tesla driver-attention monitoring + Cool Routes (Buo, Khan, Middel — ASU, 2026)**, purpose-built for the bicycle.

The Accountability Guardrail is built into the product: every routing decision and every safety alert carries a `provenance` object. If any required data source returns null, the app refuses to fabricate a recommendation — it tells the user the data is unavailable.

---

## 1. Problem statement

Cycling is the most carbon-efficient form of urban transport, but in hot, arid cities like Phoenix it's also a public-health hazard. Heat-related cyclist hospitalizations spike in summer. Pedestrians and cyclists are particularly vulnerable because they spend extended periods outdoors on poorly shaded routes (Buo, Khan, Middel et al., *Building & Environment*, April 2026).

Existing bike navigation tools optimize for **distance and elevation**. None optimize for **thermal exposure or rider physiology**. A cyclist following Google Maps' shortest path through Tempe at 3 PM in July may be unknowingly riding into a 60°C mean radiant temperature corridor with no water access for 2 km.

PulseRoute closes this gap by combining three signals never previously fused into a consumer app:

1. **Environmental:** Mean Radiant Temperature (MRT), shade, ambient temperature, heat advisories
2. **Infrastructural:** Water fountains, shaded rest stops, bike-friendly road network, repair stations
3. **Physiological:** Heart rate, heart rate variability, skin temperature → derived hydration risk score

When the model detects elevated risk, it suggests the right stop at the right moment — the same way Tesla nudges drivers to take a break.

---

## 2. Target users

- **Beachhead:** ASU students cycling between Tempe campuses, downtown Phoenix, and West campus
- **Primary:** Phoenix / Maricopa County recreational and commuter cyclists
- **Expansion:** Cyclists in any heat-vulnerable city (Las Vegas, Austin, Dubai, Riyadh, Ahmedabad, Seville)

Vulnerable subgroups (children, older adults, riders with cardiovascular conditions) get a stricter risk threshold via a "Sensitive Mode" toggle.

---

## 3. Core user journey

1. Rider opens PulseRoute, taps "Where to?"
2. Enters destination. App geocodes and shows a route comparison:
   - **Fastest** (Google-style shortest path) — distance, ETA, peak MRT exposure
   - **PulseRoute** (cool + safe) — distance, ETA, peak MRT exposure, water stops included
3. Rider taps "Start ride." App connects to watch (real or simulated).
4. Throughout the ride, the bottom panel shows live HR, HRV, skin temp, ambient temp, and a single **Hydration Risk** indicator (Green / Yellow / Red).
5. When risk crosses Yellow, or when an upcoming segment exceeds an MRT threshold, or after a time/exertion threshold — the app surfaces a stop card:
   > *"Water fountain ahead in 280m, on your right. Recommended stop: 3 minutes. Why: your HR has been above zone 3 for 22 min and ambient temp is 41°C."*
6. Post-ride summary: total exposure (°C·minutes), water stops taken, calories, alternative-route comparison.

---

## 4. Functional requirements

### Must-have (hackathon scope)

| # | Requirement | Acceptance |
|---|------------|-----------|
| F1 | Map view with origin + destination input | Tappable map, autocomplete search, route renders |
| F2 | Two-route comparison: Fastest vs PulseRoute | Both polylines visible, swipeable detail cards |
| F3 | Stops layer overlaying both routes | Water fountains, shaded benches, cafes, bike repair markers |
| F4 | Biosignal panel (mock with realistic simulation) | HR, HRV, skin temp tickers, smoothly varying values |
| F5 | Hydration risk classifier | Rule-based score using HR + HRV + skin temp + ambient temp + time-on-bike |
| F6 | Proactive stop notifications | Triggered by biosignal threshold, time interval, or upcoming MRT spike |
| F7 | Live weather + heat advisory integration | NWS API for current temp, humidity, heat index, advisory banner |
| F8 | Provenance modal on every safety alert | Tappable, shows underlying data sources + timestamps |
| F9 | "Why this route?" explanation | Lists shade %, water access count, MRT differential vs fastest |

### Should-have (if time permits)

- F10: Personal exposure budget meter (cumulative °C·min for the ride)
- F11: Voice prompts for stop suggestions (Expo Speech API)
- F12: Post-ride share card (auto-generated PNG)
- F13: Sensitive Mode toggle (kids / elderly / cardiac thresholds)

### Out of scope (explicit, non-negotiable)

- Real Apple HealthKit integration via Expo Go — documented as Phase 2 with EAS dev build path
- User accounts, profiles, login flows
- Android build
- Multi-day or multi-stop trip planning
- Social features
- Offline mode
- Indoor cycling, virtual rides

---

## 5. The Accountability Logic Gate

This is your environment-frame analogue to the Ethics Logic Gate. It is a literal piece of code, not a slogan.

**Function:** `validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None`

**Behavior:** Before any safety alert is rendered to the rider, this function checks that the alert's `provenance` object contains:
- A non-null biosignal source ID + timestamp within the last 60 seconds
- A non-null environmental source ID + timestamp within the last 30 minutes
- A non-null route segment ID

If any field is null, the function returns `None`, and the UI shows a neutral message:
> *"Sensor data unavailable — using conservative defaults."*

**Show this code in your pitch.** It's the single most defensible "we built the Guardrail into the architecture" moment.

---

## 6. Data sources

| Layer | Source | Access | Notes |
|------|-------|--------|-------|
| Cool route MRT | Cool Routes / SOLWEIG (ASU) | Email Buo/Middel TODAY | Precomputed 1m MRT rasters for Tempe |
| Shade simulation | ShadeMap.app API | Free dev key | Real-time shadows from buildings + trees |
| Tree canopy | data.tempe.gov Tree & Shade Coverage | Public download | Per-tree species, DBH, canopy area |
| Bike network | OpenStreetMap via OSMnx | Free, no auth | `network_type='bike'` |
| Water fountains | OSM tag `amenity=drinking_water` | Overpass API | Filter by Tempe bbox |
| Bike repair | OSM tag `amenity=bicycle_repair_station` | Overpass API | |
| Cafes | OSM tag `amenity=cafe` | Overpass API | Stop suggestions during long rides |
| Weather | Open-Meteo or NWS api.weather.gov | Free, no auth | Hourly temp, humidity, heat index |
| Heat advisories | NWS alerts endpoint | Free | Banner trigger |
| Land surface temp | Microsoft Planetary Computer (Landsat 9) | Free, no auth | Optional secondary heat layer |
| Biosignals | Mock generator (Phase 1) → HealthKit (Phase 2) | — | See Section 11 |

---

## 7. Tech stack

### Frontend (Mobile)
- **React Native + Expo SDK 51** (Expo Go on iOS Simulator)
- **react-native-maps** with Mapbox tiles (free tier)
- **expo-location** for GPS
- **expo-notifications** for stop alerts
- **expo-speech** for optional voice prompts
- **NativeWind** (Tailwind for React Native) for fast styling
- **Zustand** for state (simpler than Redux for hackathon)

### Backend
- **FastAPI** (Python 3.11) on **Render free tier**
- **OSMnx + NetworkX** for routing graph + modified Dijkstra
- **rasterio** for MRT raster reads
- **httpx** (async) for parallel API calls
- **pydantic v2** for response models with embedded `provenance`

### Biosignal Simulator
- Standalone Python module that emits realistic time-series for HR (60–180 bpm), HRV (10–80 ms), skin temp (32–38°C)
- Three modes: `baseline`, `moderate_exertion`, `dehydration_developing`
- Toggle in the app's debug menu so judges can switch state during demo

### Deployment
- Backend on Render (one-click from GitHub)
- Frontend tested in Expo Go on iOS Simulator (Mac required) or Expo Snack as fallback

### Why not native iOS/Swift?
Time. Expo Go gives you a working iPhone-style demo in hours, not days, and the AWS judges care about *thinking* and *architecture*, not whether you wrote Swift. Note in the README: production version would migrate to EAS dev build for HealthKit.

---

## 8. Architecture

```
┌─────────────────────────────────────┐
│  Expo Go (iOS Simulator)            │
│  ┌────────────┐  ┌──────────────┐   │
│  │  Map UI    │  │  Biosignal   │   │
│  │  + Routes  │  │  Panel       │   │
│  └──────┬─────┘  └──────┬───────┘   │
│         │               │            │
│  ┌──────▼───────────────▼─────────┐ │
│  │  Zustand Store + API Client    │ │
│  └──────────────┬─────────────────┘ │
└─────────────────┼───────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────┐
│  FastAPI Backend (Render)           │
│                                     │
│  POST /route ──┬──► OSMnx graph     │
│                ├──► MRT raster      │
│                ├──► Stops fetcher   │
│                └──► Provenance      │
│                                     │
│  POST /risk  ──┬──► Bio classifier  │
│                ├──► Weather API     │
│                └──► Logic Gate ✓    │
│                                     │
│  GET /stops  ──── Overpass API      │
└─────────────────────────────────────┘
                  │
        ┌─────────┼─────────┬──────────┐
        ▼         ▼         ▼          ▼
   ShadeMap  Open-Meteo   OSM    Cool Routes
     API     / NWS API    Overpass  MRT data
```

---

## 9. Build roadmap (assume ~10 hours of work remaining)

> **Hard freeze: 9:30 PM. Submission: 11:59 PM.** Anything not working at freeze does not ship.

### Hour 0 → 1: Setup & alignment (everyone)
- Repo created, public, MIT license added
- `.kiro/` directory at root with steering doc (Section 10)
- Three Kiro specs drafted (one per teammate)
- Render account set up for backend deploy
- Expo CLI verified, blank app boots in iOS simulator
- Mapbox / ShadeMap dev keys obtained
- Email sent to Ariane Middel asking for Tempe MRT rasters

### Hour 1 → 4: Three parallel tracks

**Mobile lead (track A):**
- Map screen with destination input + autocomplete
- Two stubbed route polylines from mock JSON
- Bottom sheet biosignal panel skeleton with mock tickers

**Backend lead (track B):**
- FastAPI scaffold deployed to Render with `/health`
- `/route` endpoint returning realistic mock JSON matching the agreed schema
- `/risk` endpoint with mock classifier returning Green/Yellow/Red
- CORS opened for Expo origins

**Data/Bio lead (track C):**
- Biosignal simulator module with three modes
- Pull Tempe water fountains + bike repair from Overpass API, save GeoJSON
- Get OSMnx bike network for Tempe, pickle to disk

### Hour 4 → 7: Real data integration
- Backend wires real OSMnx graph + MRT-weighted Dijkstra (use simple synthetic MRT raster if Middel doesn't reply — interpolate from canopy + Landsat LST)
- Frontend swaps mock JSON for real API calls
- Hydration classifier replaces stub: rule-based on HR delta from baseline + HRV trend + skin temp
- Notifications fire on threshold crossings
- Logic Gate function implemented with unit tests

### Hour 7 → 9: Polish + provenance UI
- Tap any alert → modal with cited sources
- "Why this route?" card with shade %, MRT differential, stops count
- Heat advisory banner if NWS returns one
- Real demo route locked in (e.g., Memorial Union → Mill Avenue → Tempe Town Lake)
- README written, screenshots captured

### Hour 9 → 10: Demo prep
- Pitch video recorded (3:00 max), uploaded unlisted to YouTube
- Kiro write-up drafted with screenshots of specs + hooks + Logic Gate code
- Airtable submission filled out
- Social blitz post drafted with @kirodotdev tag + #kirospark

### Buffer hour 10 → 11:59 PM
- Final commit, tag release
- Submit Airtable
- Post social
- Group screenshot for the README

---

## 10. Kiro implementation plan

### `.kiro/steering/project.md` — Steering doc

```markdown
# PulseRoute — Steering

## Mission
A mobile co-pilot for cyclists in hot cities. Plans cool + safe routes,
monitors biosignals from a smartwatch (real or simulated), and proactively
suggests stops to prevent dehydration and heat illness.

## Non-negotiables (the Accountability Logic Gate)
1. Every route or safety recommendation rendered to the user MUST carry a
   `provenance` object with source IDs and timestamps for biosignal,
   environmental, and route data.
2. The function `validate_safety_alert()` in backend/safety.py is the gate.
   No alert reaches the UI without passing it.
3. If any required data source returns null, the UI shows
   "Sensor data unavailable — using conservative defaults." Never fabricate.
4. Cite Buo, Khan, Middel et al. (2026) "Cool Routes" methodology for the
   MRT impedance approach. We are building on validated science.

## Stack
- Mobile: React Native + Expo SDK 51, react-native-maps, NativeWind,
  Zustand, expo-location, expo-notifications, expo-speech
- Backend: FastAPI, OSMnx, NetworkX, rasterio, httpx, pydantic v2
- Biosignal sim: Python module emitting realistic HR/HRV/skin-temp time series
- Data: ShadeMap API, Open-Meteo, NWS API, OSM Overpass, optional
  ASU Cool Routes precomputed MRT rasters

## Coding conventions
- Type hints everywhere. Ruff + Black for Python. Prettier for TS/TSX.
- All API responses include `provenance: ProvenanceObj`.
- Routing math lives in one pure function `compute_route()`. No I/O.
- Tests for the safety classifier and Logic Gate run on every save.

## UI principles
- The biosignal panel is glanceable. Never more than 4 numbers visible.
- Stop notifications are non-modal cards, not full-screen interrupts.
- Color language: Green/Yellow/Red is reserved for hydration risk. Use
  blue for water stops, orange for heat zones, purple for advisories.
```

### Three teammate specs

**`.kiro/specs/01-mobile-app.md`** (Mobile lead)
```markdown
# Spec: PulseRoute Mobile App

## Goal
React Native + Expo app that runs in Expo Go on iOS Simulator. Shows map,
two route options, live biosignal panel, and stop notifications.

## Screens
1. Search — destination input, recents
2. Route Compare — two polylines, swipeable detail cards
3. Ride — live map, biosignal bottom sheet, alert cards
4. Summary — post-ride exposure stats

## Components
- <RouteCard fastest|pulse> with distance, ETA, peak MRT, water stops
- <BiosignalPanel> showing HR, HRV, skin temp, hydration score
- <StopAlert> non-modal card with action buttons
- <ProvenanceModal> tap-to-expand citation list

## API contracts (from backend)
- POST /route → { fastest: Route, pulseroute: Route, provenance: P }
- POST /risk → { score: "green"|"yellow"|"red", reasons: string[],
                  provenance: P }
- GET /stops?bbox=... → { fountains: [...], cafes: [...], repair: [...] }

## Acceptance
- App boots in iOS Simulator via `npx expo start`
- Demo route (MU → Tempe Town Lake) renders both routes correctly
- Toggling biosignal sim mode visibly changes the hydration score
- Tap any safety alert opens the provenance modal
```

**`.kiro/specs/02-routing-backend.md`** (Backend lead)
```markdown
# Spec: Routing Backend

## Endpoints
POST /route
  body: { origin: [lat,lon], destination: [lat,lon], depart_time: ISO8601,
           sensitive_mode: bool }
  response: { fastest: RouteObj, pulseroute: RouteObj, provenance: P }

POST /risk
  body: { hr: float, hrv: float, skin_temp_c: float, ambient_temp_c: float,
           ride_minutes: float, baseline_hr: float }
  response: { score: "green"|"yellow"|"red", reasons: [str],
               provenance: P }

GET /stops?bbox=...
  response: { fountains: [...], cafes: [...], repair: [...] }

## Routing algorithm
1. Build bike network for Tempe with osmnx (cached on disk)
2. Edge weight = length_m * (1 + alpha * mrt_normalized)
   where alpha = 0.6 default, 0.9 in sensitive mode
3. Run NetworkX Dijkstra for both alpha=0 (fastest) and alpha=0.6 (pulse)
4. Annotate each route with shade %, mean MRT, water stops within 50m

## Risk classifier (rule-based, hackathon scope)
hr_delta = hr - baseline_hr
risk_points = 0
if hr_delta > 30: risk_points += 2
if hrv < 20: risk_points += 2
if skin_temp_c > 36: risk_points += 1
if ambient_temp_c > 38: risk_points += 1
if ride_minutes > 30: risk_points += 1
score = "green" if risk_points<=2 else "yellow" if risk_points<=4 else "red"

## Logic Gate
function `validate_safety_alert(alert) -> alert | None` enforces presence
of all provenance fields before any alert is returned.

## Acceptance
- /route p95 latency < 2s for routes under 5km
- Two integration tests in tests/test_route.py
- Logic Gate has 100% branch coverage in tests/test_logic_gate.py
```

**`.kiro/specs/03-biosignal-data.md`** (Data/Bio lead)
```markdown
# Spec: Biosignal Simulator + Data Pipeline

## Biosignal simulator
Python module `bio_sim.py` exposing:
- start_session(mode: "baseline"|"moderate"|"dehydrating") -> session_id
- get_current(session_id) -> { hr, hrv, skin_temp_c, timestamp }

Realistic dynamics:
- HR baseline 65, +10-30 with exertion, +5-15 with dehydration trend
- HRV baseline 50ms, decreases with exertion, sharper drop with dehydration
- Skin temp baseline 33°C, drifts up to 36-37°C in dehydration mode
- Add gaussian noise ~ N(0, small_sigma) to all signals
- Time-varying with realistic transition curves, not step changes

## Stops dataset
Use Overpass API to fetch for bbox covering Tempe + downtown Phoenix:
- amenity=drinking_water (water fountains)
- amenity=bicycle_repair_station
- amenity=cafe (with opening_hours filter for "open now")
Save as data/stops_tempe.geojson

## MRT raster
If Middel shares precomputed Cool Routes data: use directly.
Fallback: synthesize MRT proxy from
  - Sentinel-2 NDVI (canopy proxy)
  - Landsat 9 thermal band (LST)
  - Building footprints from Microsoft Open Buildings
  blended with Middel et al. published weights.

## Acceptance
- bio_sim demo: print 60s of synthetic data, plot the three signals
- stops dataset: > 200 fountains + > 50 cafes within bbox
- MRT raster: 30m resolution covering full Tempe extent
```

### Agent hooks (`.kiro/hooks/`)

```yaml
# on-save-test.yaml — runs critical tests on every Python save
trigger: file.save
match: "backend/**/*.py"
run: pytest tests/test_logic_gate.py tests/test_route.py -x

# pre-commit-provenance-check.yaml — enforces provenance presence
trigger: git.pre_commit
run: python scripts/check_provenance.py
description: |
  Scans staged Python files. Fails commit if any function returns a
  SafetyAlert or Route without a provenance field. This IS the
  Accountability Logic Gate at the development workflow level.

# on-spec-change-readme-sync.yaml
trigger: file.save
match: ".kiro/specs/*.md"
run: python scripts/sync_readme.py
description: Regenerates README architecture section from current specs.
```

### MCP usage

- **Filesystem MCP** for reading the cached MRT GeoTIFF + OSMnx pickle
- **GitHub MCP** for opening one PR per spec (great Story-signal artifact)
- **Custom MCP server** wrapping the ShadeMap API — call this out in the write-up; almost no team will write any MCP at all and this is the easiest Build-signal differentiator

### Vibe-coding moments to call out in the write-up

- The biosignal simulator's transition curves were vibe-coded — faster to iterate visually than to spec.
- The map polyline styling and the stop-card animations — UI taste lives outside specs.

---

## 11. The biosignal honesty story

In the pitch and write-up, **be transparent**:

> *"For this hackathon, biosignals are generated by a calibrated simulator that mirrors published HR / HRV / skin-temperature dynamics during exertion and dehydration. The classifier and Logic Gate run identically on simulated and real data — when we wire HealthKit via an EAS dev build, the only changed line is the data source. The README documents this path."*

This is a strength, not a weakness. It shows scope discipline. AWS judges respect a team that knows what to leave out.

---

## 12. 3-minute pitch script

**0:00 – 0:20 — Cold open**
"Last summer, Maricopa County recorded over 600 heat deaths. Cyclists are among the most exposed urban commuters. Today's bike apps optimize for distance. We built one that optimizes for whether you make it home safely."

**0:20 – 0:50 — Problem framing**
Show the ASU Cool Routes paper on screen. "ASU researchers proved that mean radiant temperature varies by 30°C between sun and shade on the same block. We took their methodology and built a consumer mobile app on top."

**0:50 – 2:00 — Live demo**
Open the iOS simulator. Type destination. Show two routes side by side. Start the ride. Toggle biosignal sim from "baseline" to "dehydrating" — watch the hydration score climb to Yellow, then a stop card appear: "Water fountain in 200m." Tap the alert. Show the provenance modal with cited sources.

**2:00 – 2:30 — Architecture**
"Three data layers fused: ShadeMap, Open-Meteo, and a biosignal classifier. One Logic Gate that refuses to fabricate. One custom MCP server wrapping ShadeMap. All scaffolded in 10 hours with Kiro specs and hooks."

**2:30 – 2:50 — Team flash**
Each teammate, 5 seconds, names the Kiro feature they leaned on hardest.

**2:50 – 3:00 — Closer**
"PulseRoute. Built on validated science. Citing every claim. Ready for HealthKit. Thank you."

---

## 13. Submission checklist

- [ ] Public GitHub repo with MIT or Apache-2.0 LICENSE file
- [ ] `.kiro/` directory at repo root, NOT in `.gitignore`, contains:
  - [ ] `steering/project.md`
  - [ ] `specs/01-mobile-app.md`, `02-routing-backend.md`, `03-biosignal-data.md`
  - [ ] `hooks/*.yaml`
- [ ] README with install + run instructions a judge can execute
- [ ] Backend live on Render, frontend runnable via `npx expo start`
- [ ] Unlisted YouTube video, < 3:00, with demo footage
- [ ] Airtable form submitted before 11:59 PM MST
- [ ] Social blitz post tagged @kirodotdev with #kirospark, posted during submission window
- [ ] Kiro write-up describing specs, hooks, steering, MCP usage with screenshots

---

## 14. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ShadeMap API key delay | Medium | High | Have OSM tree canopy fallback ready (Tempe Open Data) |
| Cool Routes MRT data not shared in time | High | Medium | Synthesize MRT proxy from Landsat LST + canopy |
| Expo Go crashes in iOS Simulator | Low | High | Expo Snack as backup demo platform |
| Render free tier cold starts > 30s | Medium | Medium | Use UptimeRobot ping during demo window |
| Backend dev runs out of time on routing math | Medium | High | Start with straight-line MRT lookup, swap to Dijkstra only if time |
| Biosignal sim doesn't look realistic | Low | High | Show a smooth time-series chart in the panel — sells the realism |

---

## 15. Phase 2 (post-hackathon, mention in write-up only)

- EAS dev build with HealthKit / Google Fit integration
- Strava / Apple Fitness import for personalized baselines
- Crowdsourced shade-quality validation (riders rate route segments)
- Android via React Native
- Multi-modal: walk + bike + transit combinations
- Partner with ASU Health Services, Phoenix DOT, Maricopa County Public Health
