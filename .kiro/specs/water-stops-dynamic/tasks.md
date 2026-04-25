# Implementation Plan

- [x] 1. Write bug condition exploration test
  - Confirmed: `fetch_stops` was never called from routing layer (call_count=0)
  - Confirmed: `pulse.water_stops` contained hardcoded interpolated coords (ids "f3", "f5")
  - Confirmed: `fastest.water_stops` was always `[]`
  - Confirmed: Tempe-named stops appeared for Phoenix→Scottsdale route
  - Tests written in `tests/test_bug_water_stops.py` — failed on unfixed code as expected
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - Baseline captured: polyline, distance_m, duration_s, peak_mrt_c, shade_pct, mrt_differential
  - Tests pass on both unfixed and fixed code — no regressions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix: wire dynamic water stops into compute_routes()

  - [x] 3.1 Add `_poly_bbox()` pure helper to `backend/routing.py`
    - Added `CORRIDOR_M = 150.0` and `BBOX_PAD_DEG = 0.005` constants
    - Implemented `_poly_bbox(poly, pad=BBOX_PAD_DEG) -> tuple`
    - _Requirements: 2.1_

  - [x] 3.2 Add `_point_to_segment_dist_m()` and `_nearest_dist_m()` pure helpers to `backend/routing.py`
    - Implemented project-and-clamp nearest-point distance using `_haversine_m`
    - _Requirements: 2.6_

  - [x] 3.3 Add `_filter_stops_by_corridor()` pure helper to `backend/routing.py`
    - Filters stops to those within `CORRIDOR_M` of polyline; populates `distance_m`
    - _Requirements: 2.1, 2.5, 2.6, 3.5_

  - [x] 3.4 Remove hardcoded stop injection from `_mock_routes()` fallback
    - Removed `frac_40`, `frac_75`, `pulse_stops` — both routes now return `water_stops=[]`
    - Stop injection happens in async caller
    - _Requirements: 2.5_

  - [x] 3.5 Wire `await fetch_stops(bbox)` into `compute_routes()` — one call shared between both routes
    - Added `from .stops import fetch_stops` import
    - Union bbox computed from both polylines; single `await fetch_stops(bbox)` call
    - _Requirements: 2.1, 2.4, 3.3, 3.4_

  - [x] 3.6 Apply corridor filter independently to each polyline (fastest and pulseroute)
    - `_filter_stops_by_corridor` applied to both `fast_poly` and `pulse_poly`
    - Same pattern applied in mock fallback path
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 3.4_

  - [x] 3.7 Verify bug condition exploration test now passes
    - All Task 1 tests now PASS — bug confirmed fixed
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 3.8 Verify preservation tests still pass
    - All preservation tests PASS — no regressions

- [x] 4. Write unit tests for new pure helpers
  - `test_poly_bbox_encloses_all_points` ✓
  - `test_poly_bbox_padding` ✓
  - `test_poly_bbox_single_point` ✓
  - `test_point_on_segment_zero_distance` ✓
  - `test_point_perpendicular_distance` ✓
  - `test_point_beyond_endpoint_clamps` ✓
  - `test_nearest_dist_picks_closest_segment` ✓
  - `test_filter_includes_stop_within_corridor` ✓
  - `test_filter_excludes_stop_beyond_corridor` ✓
  - `test_filter_empty_input` ✓
  - `test_filter_distance_m_populated` ✓
  - `test_compute_routes_calls_fetch_stops_once` ✓
  - `test_compute_routes_fastest_gets_stops` ✓
  - `test_compute_routes_fallback_filters_by_corridor` ✓
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

- [x] 5. Write integration tests for the full route flow
  - `test_fetch_stops_is_called` ✓
  - `test_pulse_stops_sourced_from_fetch_stops` ✓
  - `test_fastest_water_stops_not_always_empty` ✓
  - `test_out_of_area_no_tempe_stops` ✓
  - `test_preservation_mock_route_fields` ✓
  - _Requirements: 2.2, 2.3, 3.1, 3.3, 3.4, 3.5_

- [x] 6. Checkpoint — Ensure all tests pass
  - `pytest tests/ -v` → 45 passed, 0 failed
  - Property 1 (bug condition): PASS — stops sourced from `fetch_stops()`, not interpolated
  - Property 2 (preservation): PASS — polyline, distance_m, duration_s, peak_mrt_c, shade_pct unchanged
  - All helper unit tests: PASS
  - Out-of-area route returns no Tempe phantom stops: PASS
