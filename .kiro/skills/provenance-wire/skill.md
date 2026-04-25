---
name: provenance-wire
description: |
  Use when a function, endpoint, or data flow needs provenance wired
  through it. This is the hardest convention to remember and easiest
  to break. Trigger phrases: "add provenance to", "wire provenance",
  "this is missing provenance", "fix the gate". Also invoke when
  the pre-commit-provenance-check hook reports a violation.
---

# Provenance Wiring Skill

Provenance is the Accountability Logic Gate. Every response model in
PulseRoute that touches user-visible data MUST carry a Provenance
object with source citations.

## The contract (shared/schemas.py)

```python
class SourceRef(BaseModel):
    source_id: str        # e.g. "open_meteo", "nws", "osm_overpass"
    timestamp: datetime   # when the data was fetched
    age_seconds: int      # server-computed, for UI "14 min ago" chip

class Provenance(BaseModel):
    bio_source: Optional[SourceRef] = None
    env_source: Optional[SourceRef] = None
    route_segment_id: Optional[str] = None
```

## Which fields to populate

- **bio_source**: any response derived from biosignals (RiskScore,
  SafetyAlert). source_id = the BioSource literal used.
- **env_source**: any response derived from weather (WeatherResponse,
  Route with forecasted conditions, RiskScore). source_id =
  "open_meteo" | "nws" | "airnow".
- **route_segment_id**: any response tied to a specific route segment
  (SafetyAlert triggered by an upcoming segment, Route, RouteSegment).

## The wiring pattern

### In services
```python
async def get_composed_weather(self, lat: float, lng: float) -> WeatherResponse:
    now = datetime.utcnow()
    open_meteo_data = await self._fetch_open_meteo(lat, lng)

    return WeatherResponse(
        current=open_meteo_data.current,
        forecast_hourly=open_meteo_data.hourly,
        advisories=await self._fetch_nws_alerts(lat, lng),
        provenance=Provenance(
            env_source=SourceRef(
                source_id="open_meteo",
                timestamp=open_meteo_data.fetched_at,
                age_seconds=int((now - open_meteo_data.fetched_at).total_seconds()),
            ),
        ),
    )
```

### In the Logic Gate
```python
def validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None:
    p = alert.provenance
    if not p.bio_source or p.bio_source.age_seconds > 60:
        logger.info("gate.reject", reason="bio_stale_or_missing")
        return None
    if not p.env_source or p.env_source.age_seconds > 1800:
        logger.info("gate.reject", reason="env_stale_or_missing")
        return None
    if not p.route_segment_id:
        logger.info("gate.reject", reason="no_segment")
        return None
    logger.info("gate.pass", alert_id=alert.risk.level)
    return alert
```

### In the UI (ProvenanceModal)
```tsx
<ProvenanceModal sources={[
  { label: "Biosignal", ...alert.provenance.bio_source },
  { label: "Weather", ...alert.provenance.env_source },
  { label: "Route segment", id: alert.provenance.route_segment_id },
]} />
```

## When asked to "add provenance to X"

1. Read the function and identify every data source it touches.
2. Map each source to the correct Provenance field (bio / env / route).
3. Thread a `timestamp` from the moment the data was fetched, not now().
4. Compute `age_seconds = int((now - timestamp).total_seconds())`.
5. Populate the Provenance object at the point of response construction,
   not later.
6. If the data comes from a cache, use the CACHED timestamp, not the
   cache read time — otherwise the gate won't catch stale data.
7. Add a test that asserts provenance is non-null on success paths.

## Red flags to catch

- `provenance=Provenance()` with no fields populated — blocks the gate
- `timestamp=datetime.utcnow()` unconditionally — lies about age
- Computing age in the route handler instead of service — timing drift
- Passing provenance as Optional in function signatures — it's requireds