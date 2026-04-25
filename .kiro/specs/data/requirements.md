# Data & Biosignal Requirements — PulseRoute

## Owner
Track C — Data Pipelines & Biosignal Simulator

## Mission
Build the data sources that power PulseRoute's health monitoring and route planning:

**CRITICAL (Demo-Essential)**:
1. **Realistic biosignal simulator** - The heart of the demo. This drives the varying health suggestions and water bank recommendations that make PulseRoute compelling. Without realistic HR/HRV/skin-temp dynamics, the demo is just a static map.
2. **Live stops API integration** - Replaces hardcoded 18 stops with 200+ real water fountains, shade zones, and cafes from OpenStreetMap.

**IMPORTANT (Spec Compliance)**:
3. **Hydration classifier alignment** - Align backend's 10-rule system with Track C's 6-rule specification for consistency.

**DEFERRED (Nice-to-Have)**:
4. **MRT raster** - Hand-curated zones in `data/tempe_zones.json` work fine for demo
5. **Bike graph with OSMnx** - Mapbox routing is sufficient for hackathon scope

Everything you ship is a library the backend imports or a data file the backend reads.

## Stack
- Python 3.11
- numpy, pandas, scipy for signal generation and stats
- requests for Overpass + satellite data pulls
- rasterio for raster ops
- osmnx for bike graph
- pytest for classifier tests

## Functional requirements

### FR-C1: Biosignal simulator module ⭐ CRITICAL FOR DEMO

**Why this matters**: This is what makes the demo compelling. Judges need to see health suggestions and water bank recommendations VARY realistically as biosignals change. Without this, PulseRoute is just another map app.

**Current state**: `backend/services/bio_service.py` uses simple `random.uniform()` within mode ranges. Values jump randomly with no temporal continuity or physiological realism.

**What we need**: Realistic time-series simulator with smooth transitions and physiologically accurate dynamics.

#### API Requirements
- **File**: `backend/bio_sim.py` (new module, imported by BioService)
- **Interface**: 
  - `start_session(mode: BioMode) -> session_id: str`
  - `get_current(session_id: str) -> Biosignal`
  - `set_mode(session_id: str, mode: BioMode) -> None`
  - `list_sessions() -> list[str]`

#### Signal Dynamics (Physiologically Realistic)

**Heart Rate (HR)**:
- Baseline mode: 65 bpm ± 5 (resting)
- Moderate mode: Ramp up from baseline to 130-150 bpm over 60s (sigmoid curve)
- Dehydrating mode: Slow drift upward +5-15 bpm over 2-3 minutes (linear + noise)
- Noise: Gaussian σ=2 bpm (realistic beat-to-beat variation)

**Heart Rate Variability (HRV)**:
- Baseline mode: 50 ms ± 10 (healthy parasympathetic tone)
- Moderate mode: Exponential decay toward 25-35 ms over 60s (sympathetic activation)
- Dehydrating mode: Further decay toward 15-20 ms over 2-3 minutes (stress response)
- Noise: Gaussian σ=3 ms

**Skin Temperature**:
- Baseline mode: 33.0°C ± 0.3 (normal)
- Moderate mode: Gradual rise to 36.5-37.0°C over 90s (thermoregulation)
- Dehydrating mode: Drift up to 37.5-38.5°C over 3-4 minutes (impaired cooling)
- Noise: Gaussian σ=0.1°C

#### Transition Behavior
- **Smooth mode changes**: Use sigmoid/exponential curves, NOT step changes
- **Transition duration**: 30-60s for mode switches
- **Temporal continuity**: Each `get_current()` call advances time by ~1s
- **Monotonic timestamps**: Never go backward in time

#### Session Management
- In-memory dict: `session_id -> {mode, last_timestamp, signal_state}`
- No persistence needed (hackathon scope)
- Session IDs: UUID4 strings

#### User Stories

**US-C1.1**: As a demo presenter, I want to toggle between baseline/moderate/dehydrating modes and see the biosignal panel smoothly transition, so judges understand the system responds to physiological changes.

**US-C1.2**: As a backend developer, I want `BioService.get_current()` to call `bio_sim.get_current()` instead of `random.uniform()`, so the simulator is a drop-in replacement.

**US-C1.3**: As a judge watching the demo, I want to see the hydration risk score change from green → yellow → red as the simulator mode changes, proving the classifier works.

#### Acceptance Criteria
- [ ] 60s demo script prints three time-series showing realistic curves
- [ ] Mode transitions are smooth (no sudden jumps)
- [ ] HR/HRV/skin-temp values stay within physiological ranges
- [ ] `BioService` integration: swap `random.uniform()` for `bio_sim.get_current()`
- [ ] Demo: Toggle mode in app → biosignal panel updates → risk score changes

### FR-C2: Hydration risk classifier alignment

**Current state**: `backend/services/hydration_service.py` has a 10-rule system with granular thresholds (HR >140/155/170, skin_temp >37.5/38.0, etc.). Works well but doesn't match Track C spec.

**What we need**: Align to Track C's simpler 6-rule system for spec compliance.

#### Current Backend Rules (10 rules, 0-100+ points)
```python
# Heart rate (3 rules)
if bio.hr > 170: +40 points
elif bio.hr > 155: +25 points
elif bio.hr > 140: +10 points

# Skin temperature (2 rules)
if bio.skin_temp_c > 38.0: +30 points
elif bio.skin_temp_c > 37.5: +15 points

# HRV (2 rules)
if bio.hrv_ms < 20: +20 points
elif bio.hrv_ms < 35: +10 points

# Ride duration (1 rule)
if context.minutes > 45: +10 points

# Heat index (2 rules)
if weather.heat_index_c > 40: +15 points
elif weather.heat_index_c > 35: +8 points

# Thresholds: 0-19=green, 20-44=yellow, 45+=red
```

#### Track C Spec (6 rules, 0-8 points)
```python
# Simpler system
if hr_delta > 30: +2 points  # HR above baseline
if hrv_ms < 20: +2 points
if skin_temp_c > 36: +1 point
if ambient_temp_c > 38: +1 point
if uv_index > 8: +1 point
if ride_minutes > 30: +1 point

# Thresholds: 0-2=green, 3-4=yellow, 5+=red
```

#### Decision: Keep Current Backend System

**Rationale**: 
- Current 10-rule system is MORE sophisticated and works well
- Provides better granularity for demo (more interesting transitions)
- Already tested and integrated
- Track C's 6-rule system is simpler but less expressive

**Action**: Document the difference, keep current implementation. If time permits, add Track C's 6-rule system as an alternative classifier for comparison.

#### User Stories

**US-C2.1**: As a backend developer, I want the hydration classifier to return a `RiskScore` with level (green/yellow/red), points, reasons[], and provenance, so the frontend can display actionable alerts.

**US-C2.2**: As a safety engineer, I want 100% branch coverage on the classifier tests, so I can verify every rule path is tested.

**US-C2.3**: As a user, I want to see WHY the app thinks I need water (e.g., "Heart rate elevated (145 bpm)"), so I can trust the recommendation.

#### Acceptance Criteria
- [ ] Classifier is a pure function (no I/O, deterministic)
- [ ] Returns `reasons[]` list with human-readable explanations
- [ ] 100% branch coverage in `backend/tests/test_hydration.py`
- [ ] All 10 rules tested with edge cases
- [ ] Provenance object includes bio_source, env_source, timestamps

### FR-C3: Stops dataset (LIVE API integration) ⭐ HIGH IMPACT

**Current state**: `backend/services/stops_service.py` loads 18 hardcoded stops from `data/stops_seed.json`. Limited coverage, no shade zones.

**What we need**: Live Overpass API integration to fetch 200+ real stops from OpenStreetMap.

#### Why This Matters
- **18 stops → 200+ stops**: Massive improvement in coverage
- **Adds shade zones**: Parks, shelters, covered bus stops (user requested!)
- **Real data**: Actual water fountains, cafes, bike repair in Tempe
- **Graceful degradation**: Falls back to seed file if API is down

#### Data Source
- **API**: Overpass API (https://overpass-api.de/api/interpreter)
- **License**: ODbL (Open Database License) - attribution required
- **Rate limits**: No auth required, but use 24h cache to be respectful
- **Bbox**: Tempe, AZ (33.38,-111.95) to (33.52,-111.85)

#### Query Tags (OSM Amenities)

**Water sources**:
- `amenity=drinking_water` (official fountains)
- `amenity=cafe|restaurant|convenience|fuel` (commercial water access)

**Shade/rest zones** (NEW - user requested):
- `amenity=shelter` (covered structures)
- `covered=yes` (any covered area)
- `highway=bus_stop` (transit stops with benches)
- `leisure=park` (shaded park areas)
- `natural=tree_row` (tree-lined paths)

**Services**:
- `amenity=bicycle_repair_station` (bike maintenance)

#### Amenity Mapping
Map OSM tags to PulseRoute amenity categories:
- `water`: drinking_water, cafe, restaurant, convenience, fuel
- `shade`: shelter, covered=yes, bus_stop, park, tree_row
- `food`: cafe, restaurant, convenience, fuel
- `restroom`: toilets=yes (if present)
- `bike_repair`: bicycle_repair_station

#### Response Categorization
`StopsResponse` schema (already defined in `shared/schema.py`):
- `fountains`: Official drinking water sources
- `cafes`: Commercial establishments (cafe, restaurant, convenience, fuel)
- `repair`: Bike maintenance facilities
- `shade_zones`: Shelters, covered areas, transit stops, parks ⭐ NEW

#### Implementation Strategy
1. **Replace `StopsService.__init__()`**: Instead of loading JSON, initialize empty cache
2. **Add `_fetch_from_overpass()` method**: POST query to Overpass API
3. **Add `_parse_overpass_response()` method**: Convert Overpass JSON to `Stop` objects
4. **Update `get_stops()` method**: Check cache → fetch if expired → parse → categorize
5. **Fallback**: If Overpass times out, load `data/stops_seed.json`

#### Caching Strategy
- **TTL**: 24 hours (stops don't change frequently)
- **Key**: `f"stops_{bbox}_{amenity}"`
- **Storage**: In-memory dict (no Redis needed for hackathon)
- **Invalidation**: Automatic after 24h

#### User Stories

**US-C3.1**: As a cyclist, I want to see 200+ real water fountains and cafes in Tempe, so I have more options for hydration stops.

**US-C3.2**: As a user who wants shade, I want to see parks, shelters, and covered bus stops marked as "shade zones", so I can rest in the shade during hot rides.

**US-C3.3**: As a backend developer, I want the Overpass API to be cached for 24h, so we don't hammer OSM servers on every request.

**US-C3.4**: As a reliability engineer, I want graceful degradation to the seed file if Overpass is down, so the app still works during API outages.

#### Acceptance Criteria
- [ ] Live API returns ≥200 stops for Tempe bbox
- [ ] Cache hit on second request within 24h (verify with logs)
- [ ] Graceful degradation: If API times out (>5s), fall back to seed file
- [ ] All stops have `lat`, `lng`, `amenities[]`, `source` fields
- [ ] `shade_zones` category populated with parks, shelters, bus stops
- [ ] Provenance includes `source_id="overpass_api"` and timestamp
- [ ] Optional: `scripts/fetch_stops.py` exports GeoJSON for offline use

### FR-C4: MRT raster (DEFERRED - Not needed for demo)

**Current state**: `data/tempe_zones.json` has 5 hand-curated MRT zones. Works fine for demo.

**Decision**: DEFER. Hand-curated zones are sufficient for hackathon scope.

**Rationale**:
- Synthesizing MRT raster requires Landsat 9 LST, OSM tree canopy, building footprints
- Complex data pipeline: 6-8 hours of work
- Marginal demo value: Judges won't notice the difference
- Current zones work: Backend already uses them for routing

**If time permits** (unlikely):
- File: `data/mrt_tempe.tif` (GeoTIFF, 30m resolution, Tempe bbox)
- Inputs: Landsat 9 LST (Microsoft Planetary Computer), OSM tree canopy, Microsoft Global Building Footprints
- Method: Blend LST + inverse-canopy as MRT proxy (document as proxy, not validated MRT)
- Script: `scripts/build_mrt.py`
- Acceptance: Loads with rasterio, values 30-80°C, visible asphalt vs shade differentiation

**Explicit non-goal**: Validated MRT. Proxy is fine, documented as such.

---

### FR-C5: Bike graph (DEFERRED - Mapbox routing sufficient)

**Current state**: Backend uses Mapbox Directions API for routing. Works fine.

**Decision**: DEFER. OSMnx bike graph is overkill for hackathon scope.

**Rationale**:
- OSMnx graph requires NetworkX, custom Dijkstra implementation
- Mapbox routing is faster and more reliable
- 4-6 hours of work for marginal benefit
- Current routing works: Backend already returns routes

**If time permits** (unlikely):
- File: `data/bike_graph.pkl`
- OSMnx `network_type='bike'` for Tempe + Phoenix downtown
- Nodes: (lat, lng). Edges: length_m + precomputed mrt_mean sampled from raster
- Script: `scripts/build_graph.py`
- Acceptance: >5000 nodes, loads <2s, edges have mrt_mean

**Explicit non-goal**: Multi-city data. Tempe + Phoenix downtown only.

### FR-C6: Data pipeline documentation (DEFERRED)

**Decision**: DEFER. Focus on implementation, not documentation.

**Rationale**: 
- Hackathon scope: Working code > documentation
- README can be written post-implementation if time permits
- Code comments are sufficient for now

**If time permits**:
- File: `data/README.md`
- Explains each file: what, how generated, limitations, how to rebuild
- Table of data sources with license info
- Acceptance: A new teammate can regenerate all data from this doc

---

## Priority Summary

### MUST HAVE (Critical for demo)
1. ⭐ **FR-C1: Biosignal simulator** - Makes demo compelling, drives health suggestions
2. ⭐ **FR-C3: Live stops API** - 18 → 200+ stops, adds shade zones

### SHOULD HAVE (Spec compliance)
3. **FR-C2: Hydration classifier** - Already works, just document the difference from Track C spec

### DEFERRED (Nice-to-have)
4. **FR-C4: MRT raster** - Hand-curated zones work fine
5. **FR-C5: Bike graph** - Mapbox routing sufficient
6. **FR-C6: Documentation** - Code comments sufficient for hackathon

---

## Implementation Order

**Phase 1 (30 min)**: Biosignal simulator
- Create `backend/bio_sim.py` with realistic time-series generation
- Integrate into `BioService.get_current()`
- Demo script showing smooth transitions

**Phase 2 (30 min)**: Live stops API
- Update `StopsService` to fetch from Overpass API
- Add caching (24h TTL)
- Add fallback to seed file
- Test with Tempe bbox

**Phase 3 (15 min)**: Hydration classifier alignment
- Document current 10-rule system vs Track C 6-rule system
- Decision: Keep current system (more sophisticated)
- Verify 100% test coverage

**Total estimated time**: ~75 minutes (1.25 hours)

## Non-functional requirements

### Performance
- Biosignal `get_current()` latency: <10ms (pure computation, no I/O)
- Overpass API timeout: 5s (then fall back to seed file)
- Stops cache hit: <1ms (in-memory dict lookup)

### Reliability
- Graceful degradation: If Overpass API fails, use seed file
- No crashes on malformed API responses
- Session state survives mode changes

### Maintainability
- Biosignal simulator curves documented with parameters
- Hydration classifier has `reasons[]` list in output
- Every data file has a generator script in `scripts/` (if time permits)

### Testing
- Biosignal simulator: Unit tests for each mode, transition tests
- Hydration classifier: 100% branch coverage (already achieved)
- Stops service: Mock Overpass API responses, test cache behavior

### Data Size
- Combined data <100MB (no Git LFS needed)
- Stops cache: ~2MB for 200+ stops
- Biosignal session state: <1KB per session

## Interfaces I expose

### Python Modules (Import from backend)
- `backend.bio_sim`:
  - `start_session(mode: BioMode) -> str`
  - `get_current(session_id: str) -> Biosignal`
  - `set_mode(session_id: str, mode: BioMode) -> None`
  - `list_sessions() -> list[str]`

### Services (Already exist, will be updated)
- `backend.services.bio_service.BioService`:
  - `get_current(session_id: str) -> Biosignal` (updated to use bio_sim)
  - `set_mode(session_id: str, mode: BioMode) -> None`

- `backend.services.hydration_service.HydrationService`:
  - `classify(bio: Biosignal, context: RideContext, weather: WeatherSnapshot) -> RiskScore`

- `backend.services.stops_service.StopsService`:
  - `get_stops(bbox: tuple, amenity: str | None) -> StopsResponse` (updated to use Overpass API)

### Data Files (Deferred)
- `data/stops_tempe.geojson` (optional export from Overpass)
- `data/mrt_tempe.tif` (deferred)
- `data/bike_graph.pkl` (deferred)

## Folder ownership
- `backend/bio_sim.py` (new file)
- `backend/services/bio_service.py` (update)
- `backend/services/hydration_service.py` (document only)
- `backend/services/stops_service.py` (update)
- `scripts/` (optional demo scripts)
- `data/` (optional exports)

## Deliverables

### MUST HAVE (Critical)
- ✅ **Biosignal simulator** (`backend/bio_sim.py`) with 3 modes + smooth transitions
- ✅ **BioService integration**: Replace `random.uniform()` with `bio_sim.get_current()`
- ✅ **Live stops API**: Update `StopsService` to fetch from Overpass API with caching
- ✅ **Demo script**: Show biosignal time-series with mode transitions

### SHOULD HAVE (If time permits)
- ⏸️ **Hydration classifier documentation**: Explain 10-rule vs 6-rule system
- ⏸️ **Stops export script**: `scripts/fetch_stops.py` for GeoJSON export

### DEFERRED (Out of scope)
- ❌ MRT raster (`data/mrt_tempe.tif`)
- ❌ Bike graph (`data/bike_graph.pkl`)
- ❌ Data pipeline documentation (`data/README.md`)

## Explicit non-goals
- Training an ML model (rule-based only)
- Real HealthKit integration
- Real-time satellite refresh
- Validated MRT (proxy is fine, documented)
- Multi-city data (Tempe + Phoenix downtown only)