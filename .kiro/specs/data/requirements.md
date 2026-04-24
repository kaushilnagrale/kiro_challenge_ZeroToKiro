# Data & Biosignal Requirements — PulseRoute

## Owner
Track C — Data Pipelines & Biosignal Simulator

## Mission
Build the three data sources the backend depends on: a realistic biosignal
simulator, a stops dataset from OSM, and a synthesized MRT raster from public
satellite + canopy data. Build the hydration risk classifier as a pure
function. Everything you ship is a library the backend imports or a data file
the backend reads.

## Stack
- Python 3.11
- numpy, pandas, scipy for signal generation and stats
- requests for Overpass + satellite data pulls
- rasterio for raster ops
- osmnx for bike graph
- pytest for classifier tests

## Functional requirements

### FR-C1: Biosignal simulator module
- File: backend/bio_sim.py (imported by backend)
- API: start_session(mode), get_current(session_id), set_mode(session_id, mode), list_sessions()
- HR: baseline 65bpm, moderate +15-30 over 60s, dehydrating slow drift +5-15
- HRV: baseline 50ms, exponential decay toward 25ms under exertion, toward 15ms dehydrating
- Skin temp: baseline 33°C, drifts up to 36-37°C in dehydrating mode
- Gaussian noise on all signals; smooth sigmoid transitions (30s), not step changes
- Session state held in-memory dict; no persistence needed
- Acceptance: 60s demo prints three plotted time series showing realistic dynamics

### FR-C2: Hydration risk classifier
- File: backend/scoring.py
- API: classify(bio, weather, ride_ctx) -> RiskScore
- Rule-based:
  - hr_delta > 30 → +2 points
  - hrv_ms < 20 → +2 points
  - skin_temp_c > 36 → +1 point
  - ambient_temp_c > 38 → +1 point
  - uv_index > 8 → +1 point
  - ride_minutes > 30 → +1 point
- level = green (≤2) / yellow (≤4) / red (>4)
- Pure function, deterministic, returns reasons[] list
- Acceptance: 100% branch coverage, 12+ tests in tests/test_hydration.py

### FR-C3: Stops dataset
- File: data/stops_tempe.geojson
- Source: Overpass API, bbox (33.38,-112.05) to (33.52,-111.85)
- Tags: amenity=drinking_water, bicycle_repair_station, cafe, public_bookcase, shelter=yes
- Normalized properties: name, amenity_type, amenities[], open_now (best-effort), source="osm"
- Rerunnable script: scripts/fetch_stops.py
- Acceptance: ≥200 fountains, ≥50 cafes, ≥10 repair stations

### FR-C4: Synthesized MRT raster
- File: data/mrt_tempe.tif (GeoTIFF, 30m, Tempe bbox)
- Inputs: Landsat 9 LST (Microsoft Planetary Computer), OSM tree canopy, Microsoft Global Building Footprints
- Method: blend LST + inverse-canopy as MRT proxy (document as proxy, not validated MRT)
- Script: scripts/build_mrt.py
- Acceptance: loads with rasterio, values 30-80°C, visible asphalt vs shade differentiation

### FR-C5: Bike graph
- File: data/bike_graph.pkl
- OSMnx network_type='bike' for Tempe + Phoenix downtown
- Nodes: (lat, lng). Edges: length_m + precomputed mrt_mean sampled from raster
- Script: scripts/build_graph.py
- Acceptance: >5000 nodes, loads <2s, edges have mrt_mean

### FR-C6: Data pipeline documentation
- File: data/README.md
- Explains each file: what, how generated, limitations, how to rebuild
- Table of data sources with license info
- Acceptance: a new teammate can regenerate all data from this doc

## Non-functional requirements
- Every data file has a generator script in scripts/
- Biosignal simulator curves documented with parameters
- Hydration classifier has reasons[] list in output
- MRT proxy method documented with limitations
- Combined data <100MB (Git LFS for MRT if needed)

## Interfaces I expose
- backend/bio_sim.py: start_session, get_current, set_mode
- backend/scoring.py: classify
- data/stops_tempe.geojson
- data/mrt_tempe.tif
- data/bike_graph.pkl

## Folder ownership
- scoring/
- scripts/
- data/

## Deliverables
- Working biosignal simulator with 3 modes + demo plot script
- Hydration classifier with 12+ passing tests
- stops_tempe.geojson with 250+ features
- mrt_tempe.tif GeoTIFF
- bike_graph.pkl with >5000 nodes
- data/README.md documenting every pipeline

## Explicit non-goals
- Training an ML model (rule-based only)
- Real HealthKit integration
- Real-time satellite refresh
- Validated MRT (proxy is fine, documented)
- Multi-city data (Tempe + Phoenix downtown only)