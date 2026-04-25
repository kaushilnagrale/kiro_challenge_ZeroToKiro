# Bugfix Requirements Document

## Introduction

Water stop locations embedded in route responses are hardcoded constants rather
than real points of interest sourced from OSM Overpass. In `compute_routes()`
(both the live OSRM path and the mock fallback in `backend/routing.py`), the
`water_stops` list for the PulseRoute is always two fixed `StopPoint` objects
("Hayden Library Fountain" and "Mill Avenue Fountain") whose coordinates are
simple linear interpolations of the origin–destination vector — not actual map
features. The fastest route always receives `water_stops=[]`. The existing
`fetch_stops()` function in `backend/stops.py` is never called from the routing
layer, so real OSM drinking-water nodes, cafes, and repair stations are
completely disconnected from route responses.

This means riders are directed to phantom stops that may not exist at the
reported location, and genuinely nearby water sources along the route are
silently ignored.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a route is computed for any origin–destination pair THEN the system
    returns a hardcoded list of two water stops ("Hayden Library Fountain",
    "Mill Avenue Fountain") whose coordinates are linear fractions of the
    origin–destination vector, regardless of what OSM data contains at those
    locations.

1.2 WHEN a route is computed and real OSM drinking-water nodes exist near the
    route corridor THEN the system ignores them and returns the hardcoded stops
    instead.

1.3 WHEN a route is computed for the fastest route type THEN the system always
    returns `water_stops = []`, even when real water sources exist along that
    corridor.

1.4 WHEN `fetch_stops()` successfully retrieves live data from the Overpass API
    THEN the system does not use that data to populate `water_stops` in the
    route response.

1.5 WHEN the route bounding box falls outside the hardcoded Tempe area THEN the
    system still returns the same two Tempe-specific stop names with
    geometrically incorrect coordinates.

### Expected Behavior (Correct)

2.1 WHEN a route is computed for any origin–destination pair THEN the system
    SHALL query the Overpass API (via `fetch_stops()`) for the bounding box that
    encloses the route polyline and return only stops whose coordinates lie
    within a configurable corridor distance of the route.

2.2 WHEN real OSM drinking-water nodes, cafes, or repair stations exist near
    the route corridor THEN the system SHALL include them in `water_stops` with
    their actual OSM coordinates, names, and IDs.

2.3 WHEN a route is computed for the fastest route type THEN the system SHALL
    populate `water_stops` with real nearby stops found along that corridor,
    using the same Overpass query as the PulseRoute.

2.4 WHEN `fetch_stops()` returns live Overpass data THEN the system SHALL use
    those results to populate `water_stops` in the `RouteObj` for both route
    types.

2.5 WHEN the Overpass API is unavailable and `fetch_stops()` falls back to the
    mock dataset THEN the system SHALL still filter mock stops to those
    geometrically near the route corridor rather than returning all mock stops
    unconditionally.

2.6 WHEN a stop is included in `water_stops` THEN the system SHALL populate
    `distance_m` with the perpendicular or nearest-point distance from the stop
    to the route polyline, in metres.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `fetch_stops()` is called directly via the `GET /stops` endpoint THEN
    the system SHALL CONTINUE TO return fountains, cafes, and repair stations
    for the requested bounding box with a valid `provenance` object.

3.2 WHEN the Overpass API is unavailable THEN the system SHALL CONTINUE TO fall
    back to the curated mock dataset so that the demo always returns usable
    stop data.

3.3 WHEN a route response is returned THEN the system SHALL CONTINUE TO include
    a `provenance` object with `environmental_source_id` set to `"osm-overpass"`
    (or `"osm-overpass-mock"` when the fallback is used) and a valid
    `environmental_timestamp`.

3.4 WHEN `compute_routes()` is called THEN the system SHALL CONTINUE TO return
    both a `fastest` and a `pulseroute` `RouteObj` with valid polylines,
    distances, durations, MRT values, and shade percentages.

3.5 WHEN a `StopPoint` is returned inside `water_stops` THEN the system SHALL
    CONTINUE TO conform to the existing `StopPoint` pydantic model (id, type,
    name, lat, lon, distance_m).

3.6 WHEN the biosignal panel or `StopAlert` card renders a stop THEN the system
    SHALL CONTINUE TO display the stop using the blue color language for water
    stops as a non-modal card, without requiring any changes to the frontend
    `StopAlert` component.

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type RouteRequest
  OUTPUT: boolean

  // The bug fires for every route request — the hardcoded stops are
  // unconditionally assigned inside compute_routes(), so all inputs trigger it.
  RETURN true
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← compute_routes'(X)          // fixed function
  FOR EACH stop IN result.pulseroute.water_stops DO
    ASSERT stop.lat AND stop.lon are real OSM coordinates (not frac * dest)
    ASSERT stop.distance_m = nearest_distance(stop, result.pulseroute.polyline)
  END FOR
  ASSERT result.fastest.water_stops are derived from the same OSM query
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO   // vacuously true — no non-buggy inputs exist
  ASSERT compute_routes(X) = compute_routes'(X)   // all other fields unchanged
END FOR
```
