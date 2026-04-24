---
name: fastapi-endpoint
description: |
  Use when adding a new FastAPI endpoint to the PulseRoute backend.
  Generates a complete endpoint following our conventions: router file,
  service class, Pydantic request/response schemas with provenance,
  Redis caching, structlog instrumentation, and pytest tests with mocked
  external APIs. Trigger phrases: "add endpoint", "new route", "create
  API for", "expose X as endpoint".
---

# FastAPI Endpoint Skill

When the user asks for a new endpoint, produce all of these artifacts
in a single response. Do not skip any layer.

## 1. Pydantic schemas (shared/schemas.py)

Add to `shared/schemas.py`:
- `<Name>Request` — request body model with field validators
- `<Name>Response` — response model with REQUIRED `provenance: Provenance` field
- Any supporting nested models

Example shape:
```python
class WeatherRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)

class WeatherResponse(BaseModel):
    current: WeatherSnapshot
    forecast_hourly: list[WeatherHourly]
    advisories: list[Advisory]
    provenance: Provenance   # NEVER OMIT
```

## 2. Service class (backend/services/<name>_service.py)

- Single responsibility class, async methods
- Constructor takes an httpx.AsyncClient and the cache client
- Every external API call wrapped with:
  - structlog call with {source, latency_ms, status, cached}
  - Redis cache lookup with TTL appropriate to the data (weather=15m, routes=60m, stops=infinite)
  - try/except with graceful degradation — return None or cached value on failure, never raise to caller
- Every method that returns a response model MUST populate provenance with:
  - source_id (the external API name or data file)
  - timestamp (when the data was fetched)
  - age_seconds (computed from timestamp)

## 3. Router (backend/routers/<name>.py)

- FastAPI APIRouter with prefix and tags
- Dependency injection for service class
- Endpoint handler is thin — parse, call service, return
- No business logic in routers

Example shape:
```python
router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/", response_model=WeatherResponse)
async def get_weather(
    lat: float, lng: float,
    svc: WeatherService = Depends(get_weather_service),
) -> WeatherResponse:
    return await svc.get_composed_weather(lat, lng)
```

## 4. Register in app/main.py

Add `app.include_router(<name>_router)` in the right section.

## 5. Tests (backend/tests/test_<name>.py)

Required tests:
- Happy path with mocked external APIs (use respx or httpx_mock)
- Cache hit path (mock Redis returns cached value, external API not called)
- External API failure → graceful degradation (no 500 to client)
- Response includes provenance with all required fields populated
- Invalid input returns 422 (Pydantic validation)

Use fixtures from `backend/tests/conftest.py`:
- `client` — httpx AsyncClient for the FastAPI app
- `mock_redis` — in-memory fake
- `frozen_time` — freezegun fixture

## 6. README update

Add one row to the Data Sources table in README.md if this endpoint
introduces a new external source.

## Checklist before declaring done

- [ ] Schemas added to shared/schemas.py
- [ ] Service class has caching + logging + graceful degradation
- [ ] Router is thin, uses Depends()
- [ ] Provenance populated in every response path
- [ ] 4 tests minimum, all passing
- [ ] Registered in app/main.py
- [ ] README data sources table updated if applicable