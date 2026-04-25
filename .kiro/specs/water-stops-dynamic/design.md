# Water Stops Dynamic Bugfix Design

## Overview

`compute_routes()` in `backend/routing.py` hardcodes two phantom water stops
("Hayden Library Fountain", "Mill Avenue Fountain") as linear interpolations of
the origin–destination vector. The existing `fetch_stops()` in
`backend/stops.py` is never called from the routing layer, so real OSM
drinking-water nodes are completely disconnected from route responses.

The fix wires `fetch_stops()` into `compute_routes()` by:
1. Computing a bounding box from the route polyline with a small padding.
2. Calling `fetch_stops(bbox)` once per route pair (shared result).
3. Filtering returned stops to those within a configurable corridor distance
   of each polyline using nearest-point (perpendicular) geometry.
4. Populating `distance_m` on each `StopPoint` with that nearest-point distance.
5. Applying the same logic to both the fastest and PulseRoute objects.

The fix is minimal: no model changes, no endpoint changes, no frontend changes.

---

## Glossary

- **Bug_Condition (C)**: Every call to `compute_routes()` — the hardcoded stops
  are unconditionally assigned, so `isBugCondition(X) = true` for all `X`.
- **Property (P)**: After the fix, every `StopPoint` in `water_stops` must have
  coordinates sourced from `fetch_stops()` and `distance_m` equal to the
  nearest-point distance from that stop to the route polyline.
- **Preservation**: All other fields of `RouteObj` (polyline, distance_m,
  duration_s, peak_mrt_c, shade_pct, segment_id, mrt_differential) and the
  `GET /stops` endpoint must remain unchanged.
- **corridor_m**: Configurable maximum perpendicular distance (default 150 m)
  within which a stop is considered "on" a route.
- **bbox_pad_deg**: Padding added to the polyline bounding box before querying
  Overpass (default 0.005°, ≈ 500 m).
- **nearest-point distance**: The minimum Haversine distance from a stop to any
  point on any segment of the polyline, used to populate `distance_m`.
- **`fetch_stops(bbox)`**: Async function in `backend/stops.py` that queries
  OSM Overpass and falls back to a curated mock dataset.
- **`compute_routes(req)`**: Async function in `backend/routing.py` that returns
  `(fastest: RouteObj, pulse: RouteObj)`.
- **`_filter_stops_by_corridor(stops, polyline, corridor_m)`**: New pure helper
  that returns stops within `corridor_m` of the polyline, with `distance_m` set.
- **`_poly_bbox(polyline, pad_deg)`**: New pure helper that returns
  `(south, west, north, east)` from a polyline with padding.

---

## Bug Details

### Bug Condition

The bug manifests on every call to `compute_routes()`. Both the live OSRM path
and the `_mock_routes()` fallback unconditionally assign two hardcoded
`StopPoint` objects whose `lat`/`lon` are `origin + frac * (dest - origin)` —
not real map features. `fetch_stops()` is never invoked from the routing layer.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type RouteRequest
  OUTPUT: boolean

  // Hardcoded stops are assigned unconditionally — all inputs trigger the bug.
  RETURN true
END FUNCTION
```

### Examples

- Origin: ASU MU `[33.4176, -111.9341]`, Dest: Tempe Town Lake `[33.4255, -111.9155]`
  - **Actual**: `water_stops = [StopPoint(lat=33.4208, lon=-111.9258, name="Hayden Library Fountain"), ...]`
    — coordinates are `origin + 0.4 * (dest - origin)`, not an OSM node.
  - **Expected**: stops sourced from Overpass within 150 m of the polyline with
    real OSM IDs and coordinates.

- Origin: Phoenix `[33.4484, -112.0740]`, Dest: Scottsdale `[33.4942, -111.9261]`
  - **Actual**: same two Tempe-named stops with geometrically wrong coordinates
    (linear fractions of the Phoenix–Scottsdale vector).
  - **Expected**: stops near the Phoenix–Scottsdale corridor from Overpass.

- Any route where `fastest` is requested:
  - **Actual**: `fastest.water_stops = []` always.
  - **Expected**: real nearby stops filtered to the fastest polyline corridor.

- Overpass unavailable, any route:
  - **Actual**: two hardcoded interpolated stops.
  - **Expected**: mock stops filtered to those within 150 m of the polyline.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `GET /stops` endpoint continues to return fountains, cafes, and repair
  stations for the requested bounding box with a valid `provenance` object.
- When Overpass is unavailable, `fetch_stops()` continues to fall back to the
  curated mock dataset.
- Route responses continue to include a `provenance` object with
  `environmental_source_id` set to `"osm-overpass"` (or `"osm-overpass-mock"`
  on fallback) and a valid `environmental_timestamp`.
- `compute_routes()` continues to return both a `fastest` and a `pulseroute`
  `RouteObj` with valid polylines, distances, durations, MRT values, and shade
  percentages.
- `StopPoint` objects continue to conform to the existing pydantic model
  (id, type, name, lat, lon, distance_m).
- The frontend `StopAlert` component requires no changes — the `StopPoint`
  schema is unchanged.

**Scope:**
All inputs that do NOT affect the `water_stops` field (i.e., all other
`RouteObj` fields, the `/stops` endpoint, the `/risk` endpoint, biosignal
simulation) are completely unaffected by this fix.

---

## Hypothesized Root Cause

1. **Missing call to `fetch_stops()`**: `compute_routes()` never imports or
   calls `fetch_stops()`. The routing layer has no awareness of the stops module.

2. **Async/sync boundary not handled**: `compute_routes()` is already `async`,
   so `await fetch_stops(bbox)` can be called directly. No sync wrapper needed.
   The only subtlety is that `_mock_routes()` is a sync helper — it must either
   be converted to async or have stop injection done in the async caller.

3. **No corridor filtering logic exists**: There is no function that computes
   the nearest-point distance from a `StopPoint` to a polyline. This must be
   added as a pure helper alongside `_haversine_m`.

4. **No bounding box computation from polyline**: The bbox is currently
   hardcoded as `TEMPE_BBOX` in `stops.py`. A helper to derive the bbox from
   an arbitrary polyline must be added.

5. **`_mock_routes()` also hardcodes stops**: The fallback path has the same
   defect. The fix must cover both the live OSRM path and the mock fallback.

---

## Correctness Properties

Property 1: Bug Condition — Dynamic Stop Sourcing

_For any_ `RouteRequest` X (since `isBugCondition(X) = true` for all X), the
fixed `compute_routes'(X)` SHALL return `water_stops` where every `StopPoint`
has coordinates sourced from `fetch_stops()` (real Overpass data or filtered
mock data), and `distance_m` equal to the nearest-point Haversine distance from
that stop to the route polyline, within floating-point tolerance (±1 m).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation — Non-Stop Route Fields Unchanged

_For any_ `RouteRequest` X, the fixed `compute_routes'(X)` SHALL return
`RouteObj` instances where all fields other than `water_stops`
(polyline, distance_m, duration_s, peak_mrt_c, shade_pct, segment_id,
mrt_differential) are identical to what the original `compute_routes(X)` would
have returned, preserving all routing, MRT, and shade logic.

**Validates: Requirements 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

**File**: `backend/routing.py`

**New pure helpers** (no I/O, fully unit-testable):

```python
CORRIDOR_M = 150.0   # configurable: max perpendicular distance to include a stop
BBOX_PAD_DEG = 0.005  # ~500 m padding around polyline bbox

def _poly_bbox(poly: List[List[float]], pad: float = BBOX_PAD_DEG) -> tuple:
    """Return (south, west, north, east) bounding box for a polyline."""
    lats = [p[0] for p in poly]
    lons = [p[1] for p in poly]
    return (min(lats) - pad, min(lons) - pad, max(lats) + pad, max(lons) + pad)

def _point_to_segment_dist_m(pt: List[float], a: List[float], b: List[float]) -> float:
    """Nearest-point distance in metres from pt to segment a–b."""
    # Project pt onto segment ab; clamp t to [0,1]; return haversine to nearest point.
    ...

def _nearest_dist_m(pt: List[float], poly: List[List[float]]) -> float:
    """Minimum distance from pt to any segment of poly."""
    return min(_point_to_segment_dist_m(pt, poly[i], poly[i+1])
               for i in range(len(poly) - 1))

def _filter_stops_by_corridor(
    stops: List[StopPoint],
    poly: List[List[float]],
    corridor_m: float = CORRIDOR_M,
) -> List[StopPoint]:
    """Return stops within corridor_m of poly, with distance_m populated."""
    result = []
    for s in stops:
        d = _nearest_dist_m([s.lat, s.lon], poly)
        if d <= corridor_m:
            result.append(s.model_copy(update={"distance_m": round(d, 1)}))
    return result
```

**Function**: `compute_routes(req)`

**Specific Changes**:

1. **Compute shared bbox**: After obtaining both polylines (fast and pulse),
   compute a single bbox that covers both using `_poly_bbox`. Use the union of
   both polylines so one Overpass call serves both routes.

2. **Call `fetch_stops(bbox)` once**: `await fetch_stops(bbox)` returns
   `{"fountains": [...], "cafes": [...], "repair": [...]}`. Combine all three
   lists into a single candidate list for filtering.

3. **Filter per polyline**: Call `_filter_stops_by_corridor(candidates, fast_poly)`
   and `_filter_stops_by_corridor(candidates, pulse_poly)` independently, so
   each route gets only its own nearby stops.

4. **Assign to RouteObj**: Pass filtered lists as `water_stops=` when
   constructing both `fastest` and `pulse` `RouteObj` instances.

5. **Fix `_mock_routes()` fallback**: Convert `_mock_routes` to accept a
   pre-fetched stops dict (or make it async), so the same corridor filtering
   applies when OSRM is unavailable. Simplest approach: remove stop assignment
   from `_mock_routes` entirely and let `compute_routes` inject stops after
   calling `_mock_routes`.

**File**: `backend/stops.py`

No changes required. `fetch_stops(bbox)` already accepts an arbitrary bbox
tuple and falls back to mock data on Overpass failure.

### Async/Sync Boundary

`compute_routes()` is already `async`. `fetch_stops()` is already `async`.
The call is a straightforward `await fetch_stops(bbox)` inside `compute_routes`.
`_mock_routes()` is sync and returns `RouteObj` instances — stop injection
happens in the async caller after `_mock_routes()` returns, so no sync/async
conflict arises.

### Fallback Behavior

When Overpass is unavailable, `fetch_stops()` returns the curated mock dataset
(8 fountains, 4 cafes, 2 repair stations). The corridor filter is applied to
this mock data identically to live data. For the ASU–Tempe corridor, several
mock stops will pass the 150 m filter; for other corridors, the list may be
empty — which is correct behavior (no phantom stops).

---

## Testing Strategy

### Validation Approach

Two-phase: first run exploratory tests on unfixed code to confirm the root
cause; then run fix-checking and preservation-checking tests on fixed code.

### Exploratory Bug Condition Checking

**Goal**: Confirm that `compute_routes()` returns hardcoded interpolated
coordinates and never calls `fetch_stops()`, before implementing the fix.

**Test Plan**: Mock `fetch_stops` to return a known stop at a specific
coordinate. Call `compute_routes()`. Assert that the known stop does NOT appear
in `water_stops` (demonstrating the bug). Also assert that the returned stop
coordinates match the hardcoded interpolation formula.

**Test Cases**:
1. **Interpolation check**: Call `compute_routes` with origin A, dest B. Assert
   `pulse.water_stops[0].lat == A[0] + 0.4 * (B[0] - A[0])` — confirming
   hardcoded interpolation (will pass on unfixed code, fail after fix).
2. **fetch_stops not called**: Patch `fetch_stops` with a spy. Call
   `compute_routes`. Assert spy was never called (will pass on unfixed code).
3. **Fastest always empty**: Assert `fastest.water_stops == []` for any input
   (will pass on unfixed code, fail after fix when real stops exist nearby).
4. **Out-of-area route**: Use Phoenix→Scottsdale origin/dest. Assert returned
   stop names still contain "Hayden" or "Mill" — confirming Tempe-specific
   hardcoding regardless of geography.

**Expected Counterexamples**:
- `fetch_stops` spy call count = 0 (never called)
- Stop coordinates equal linear interpolation of origin/dest vector

### Fix Checking

**Goal**: Verify Property 1 — for all inputs, fixed `compute_routes'` returns
stops sourced from `fetch_stops()` with correct `distance_m`.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO   // i.e., for all X
  mock fetch_stops to return known_stops at known_coords
  result := compute_routes'(X)
  FOR EACH stop IN result.pulseroute.water_stops DO
    ASSERT stop.lat, stop.lon IN known_coords  // not interpolated
    ASSERT abs(stop.distance_m - nearest_dist(stop, result.pulseroute.polyline)) <= 1.0
  END FOR
  FOR EACH stop IN result.fastest.water_stops DO
    ASSERT stop.lat, stop.lon IN known_coords
    ASSERT abs(stop.distance_m - nearest_dist(stop, result.fastest.polyline)) <= 1.0
  END FOR
END FOR
```

### Preservation Checking

**Goal**: Verify Property 2 — all non-`water_stops` fields are unchanged.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO   // vacuously: for all X
  original := compute_routes(X)   // unfixed
  fixed    := compute_routes'(X)  // fixed
  ASSERT original.fastest.polyline    == fixed.fastest.polyline
  ASSERT original.fastest.distance_m  == fixed.fastest.distance_m
  ASSERT original.fastest.duration_s  == fixed.fastest.duration_s
  ASSERT original.fastest.peak_mrt_c  == fixed.fastest.peak_mrt_c
  ASSERT original.pulseroute.polyline == fixed.pulseroute.polyline
  // ... same for all non-water_stops fields
END FOR
```

**Testing Approach**: Property-based testing with `hypothesis` is recommended
because:
- It generates diverse origin/destination pairs across a geographic range.
- It catches edge cases (same origin/dest, very short routes, routes with no
  nearby stops) that manual tests miss.
- It provides strong guarantees that routing math is unaffected by the fix.

**Test Cases**:
1. **Polyline preservation**: Generate random (origin, dest) pairs; assert
   polyline coordinates are identical before and after fix (mock OSRM).
2. **Distance/duration preservation**: Assert `distance_m` and `duration_s`
   unchanged across random inputs.
3. **MRT/shade preservation**: Assert `peak_mrt_c` and `shade_pct` unchanged.
4. **Provenance preservation**: Assert `provenance` fields unchanged.

### Unit Tests

- `test_poly_bbox`: Assert bbox correctly encloses all polyline points with padding.
- `test_nearest_dist_on_segment`: Assert `_point_to_segment_dist_m` returns 0
  for a point on the segment, and correct distance for a perpendicular point.
- `test_nearest_dist_endpoint`: Assert nearest distance to a single-segment
  polyline equals endpoint distance when projection falls outside [0,1].
- `test_filter_stops_corridor_includes`: Stop at 100 m from polyline with
  corridor_m=150 → included with correct `distance_m`.
- `test_filter_stops_corridor_excludes`: Stop at 200 m from polyline with
  corridor_m=150 → excluded.
- `test_filter_stops_distance_m_populated`: Included stop has `distance_m`
  set to nearest-point distance ± 1 m.
- `test_compute_routes_calls_fetch_stops`: Mock `fetch_stops`; assert it is
  called exactly once with a bbox that encloses the route polylines.
- `test_compute_routes_fastest_gets_stops`: Mock `fetch_stops` returning a stop
  near the fast polyline; assert it appears in `fastest.water_stops`.
- `test_compute_routes_fallback_filters`: Force Overpass failure; assert mock
  stops are filtered by corridor (not all 14 mock stops returned).

### Property-Based Tests

- **Property 1 — Stop coordinates are real**: For any `(origin, dest)` pair
  (generated by hypothesis), mock `fetch_stops` to return stops at fixed known
  coordinates; assert every stop in `water_stops` has coordinates matching the
  mock data, not the interpolation formula `origin + frac * (dest - origin)`.
- **Property 2 — distance_m accuracy**: For any polyline and any stop within
  corridor, assert `abs(stop.distance_m - _nearest_dist_m(stop, poly)) <= 1.0`.
- **Property 3 — Corridor invariant**: For any stop with `distance_m > corridor_m`,
  assert it does not appear in the filtered result.
- **Property 4 — Polyline fields preserved**: For any `(origin, dest)`, mock
  both OSRM and `fetch_stops`; assert `fastest.polyline`, `distance_m`,
  `duration_s`, `peak_mrt_c`, `shade_pct` are identical to the pre-fix values.

### Integration Tests

- **Full route flow with real mock stops**: POST `/route` with ASU→Tempe coords;
  assert `pulseroute.water_stops` is non-empty and each stop has a real `id`
  (not "f3"/"f5") and a numeric `distance_m`.
- **Fastest route gets stops**: Same POST; assert `fastest.water_stops` is
  non-empty (previously always `[]`).
- **Out-of-area route gets filtered stops**: POST `/route` with
  Phoenix→Scottsdale; assert no Tempe-named stops appear in `water_stops`.
- **Provenance unchanged**: POST `/route`; assert `provenance.environmental_source_id`
  is `"osm-overpass"` or `"osm-overpass-mock"` and `route_segment_id` is present.
