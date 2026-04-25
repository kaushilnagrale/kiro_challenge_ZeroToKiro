# Spec: Routing Backend

## Endpoints

```
POST /route
  body:     { origin: [lat,lon], destination: [lat,lon],
              depart_time: ISO8601, sensitive_mode: bool }
  response: { fastest: RouteObj, pulseroute: RouteObj,
              weather: WeatherObj, provenance: ProvenanceObj }

POST /risk
  body:     { hr: float, hrv: float, skin_temp_c: float,
              ambient_temp_c: float, ride_minutes: float,
              baseline_hr: float }
  response: { score: "green"|"yellow"|"red", risk_points: int,
              reasons: [str], provenance: ProvenanceObj }

GET /stops?south=&west=&north=&east=
  response: { fountains: [...], cafes: [...], repair: [...],
              provenance: ProvenanceObj }

GET /weather?lat=&lon=
  response: { ambient_temp_c, humidity_pct, heat_index_c,
              wind_speed_ms, advisory, source_id, timestamp }

POST /bio/session  body: { mode: "baseline"|"moderate"|"dehydrating" }
  response: { session_id: str, mode: str }

GET /bio/{session_id}
  response: { hr, hrv, skin_temp_c, timestamp, mode }
```

## Routing algorithm

1. Build bike network for Tempe with osmnx (cached on disk)
2. Edge weight = `length_m * (1 + alpha * mrt_normalized)`
   where `alpha = 0.6` default, `0.9` in sensitive mode
3. Run NetworkX Dijkstra for both `alpha=0` (fastest) and `alpha=0.6` (pulse)
4. Annotate each route with shade %, mean MRT, water stops within 50m
5. Falls back to high-quality mock routing when OSMnx graph is unavailable

## Risk classifier (rule-based, hackathon scope)

```python
hr_delta = hr - baseline_hr
risk_points = 0
if hr_delta > 30:        risk_points += 2  # HR critically elevated
if hr_delta > 20:        risk_points += 1  # HR elevated
if hrv < 20:             risk_points += 2  # HRV critically low
if hrv < 35:             risk_points += 1  # HRV low
if skin_temp_c > 36.5:   risk_points += 1  # Skin temp elevated
if ambient_temp_c > 38:  risk_points += 1  # Extreme heat
if ride_minutes > 45:    risk_points += 1  # Long ride
score = "green" if risk_points<=2 else "yellow" if risk_points<=4 else "red"
```

## Accountability Logic Gate

`validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None` in
`backend/safety.py` enforces presence and freshness of all provenance
fields before any alert is returned to the client.

## Acceptance
- `/health` returns 200 within 500ms
- `/route` p95 latency < 2s for routes under 5km
- Two integration tests in `tests/test_route.py`
- Logic Gate has 100% branch coverage in `tests/test_logic_gate.py`
- All responses include a non-null `provenance` object
