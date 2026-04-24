---
name: external-api-integration
description: |
  Use when integrating a new external API into the PulseRoute backend
  (Mapbox, Open-Meteo, NWS, Overpass, AirNow, etc). Generates a resilient
  async client with caching, timeout, retry, graceful degradation,
  structured logging, and a mock for tests. Trigger phrases: "integrate
  API", "call the X API", "add Mapbox", "hook up NWS".
---

# External API Integration Skill

Every external API call in PulseRoute follows the same pattern. Use this
skill to generate the full stack, not just an httpx call.

## 1. Client class (backend/services/clients/<name>_client.py)

Required features:
- `httpx.AsyncClient` injected via constructor
- Timeout: 5s for non-critical APIs (weather), 10s for critical (routing)
- Retry: 2 attempts with exponential backoff (200ms, 800ms) on 5xx or timeout
- API keys loaded from env via `os.getenv()` — never hardcoded
- Every public method returns a typed Pydantic model, never raw dict
- Every response includes `fetched_at: datetime` for provenance

Example shape:
```python
class OpenMeteoClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http
        self._base = "https://api.open-meteo.com/v1"

    async def forecast(self, lat: float, lng: float) -> OpenMeteoForecast:
        started = time.monotonic()
        try:
            r = await self._http.get(
                f"{self._base}/forecast",
                params={"latitude": lat, "longitude": lng, ...},
                timeout=5.0,
            )
            r.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            logger.warning("open_meteo.fail", error=str(e),
                           latency_ms=int((time.monotonic()-started)*1000))
            raise
        latency_ms = int((time.monotonic() - started) * 1000)
        logger.info("open_meteo.ok", latency_ms=latency_ms)
        return OpenMeteoForecast(**r.json(), fetched_at=datetime.utcnow())
```

## 2. Caching layer (in the service, not the client)

The client is dumb — it makes HTTP calls. The service layer handles caching.

```python
class WeatherService:
    async def get_current(self, lat: float, lng: float) -> WeatherSnapshot:
        key = f"weather:{round(lat, 3)}:{round(lng, 3)}"
        if cached := await self._cache.get(key):
            return WeatherSnapshot.model_validate_json(cached)

        try:
            fresh = await self._client.forecast(lat, lng)
            snap = WeatherSnapshot.from_open_meteo(fresh)
            await self._cache.setex(key, 900, snap.model_dump_json())
            return snap
        except Exception:
            # Graceful degradation: return last cached or sentinel
            if last := await self._cache.get(f"{key}:last"):
                return WeatherSnapshot.model_validate_json(last)
            return WeatherSnapshot.unavailable()
```

## 3. Environment config (backend/config.py)

Add every API key to the settings class:
```python
class Settings(BaseSettings):
    mapbox_token: str
    airnow_key: Optional[str] = None  # optional APIs use Optional
    # Open-Meteo and NWS need no key

    class Config:
        env_file = ".env"
```

Add to `.env.example`:
---
name: external-api-integration
description: |
  Use when integrating a new external API into the PulseRoute backend
  (Mapbox, Open-Meteo, NWS, Overpass, AirNow, etc). Generates a resilient
  async client with caching, timeout, retry, graceful degradation,
  structured logging, and a mock for tests. Trigger phrases: "integrate
  API", "call the X API", "add Mapbox", "hook up NWS".
---

# External API Integration Skill

Every external API call in PulseRoute follows the same pattern. Use this
skill to generate the full stack, not just an httpx call.

## 1. Client class (backend/services/clients/<name>_client.py)

Required features:
- `httpx.AsyncClient` injected via constructor
- Timeout: 5s for non-critical APIs (weather), 10s for critical (routing)
- Retry: 2 attempts with exponential backoff (200ms, 800ms) on 5xx or timeout
- API keys loaded from env via `os.getenv()` — never hardcoded
- Every public method returns a typed Pydantic model, never raw dict
- Every response includes `fetched_at: datetime` for provenance

Example shape:
```python
class OpenMeteoClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http
        self._base = "https://api.open-meteo.com/v1"

    async def forecast(self, lat: float, lng: float) -> OpenMeteoForecast:
        started = time.monotonic()
        try:
            r = await self._http.get(
                f"{self._base}/forecast",
                params={"latitude": lat, "longitude": lng, ...},
                timeout=5.0,
            )
            r.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            logger.warning("open_meteo.fail", error=str(e),
                           latency_ms=int((time.monotonic()-started)*1000))
            raise
        latency_ms = int((time.monotonic() - started) * 1000)
        logger.info("open_meteo.ok", latency_ms=latency_ms)
        return OpenMeteoForecast(**r.json(), fetched_at=datetime.utcnow())
```

## 2. Caching layer (in the service, not the client)

The client is dumb — it makes HTTP calls. The service layer handles caching.

```python
class WeatherService:
    async def get_current(self, lat: float, lng: float) -> WeatherSnapshot:
        key = f"weather:{round(lat, 3)}:{round(lng, 3)}"
        if cached := await self._cache.get(key):
            return WeatherSnapshot.model_validate_json(cached)

        try:
            fresh = await self._client.forecast(lat, lng)
            snap = WeatherSnapshot.from_open_meteo(fresh)
            await self._cache.setex(key, 900, snap.model_dump_json())
            return snap
        except Exception:
            # Graceful degradation: return last cached or sentinel
            if last := await self._cache.get(f"{key}:last"):
                return WeatherSnapshot.model_validate_json(last)
            return WeatherSnapshot.unavailable()
```

## 3. Environment config (backend/config.py)

Add every API key to the settings class:
```python
class Settings(BaseSettings):
    mapbox_token: str
    airnow_key: Optional[str] = None  # optional APIs use Optional
    # Open-Meteo and NWS need no key

    class Config:
        env_file = ".env"
```

Add to `.env.example`:
MAPBOX_TOKEN=pk.your_token_here
AIRNOW_KEY=optional_key_here

## 4. Structured logging conventions

Every external call logs exactly:
```python
logger.info("<source>.ok", latency_ms=..., cache_hit=False, lat=..., lng=...)
logger.warning("<source>.fail", error=..., latency_ms=..., attempt=N)
logger.info("<source>.cached", key=..., age_s=...)
```

This lets us build a data-sources observability screen at the end.

## 5. Mock for tests (backend/tests/mocks/<name>_mock.py)

```python
@pytest.fixture
def mock_open_meteo(respx_mock):
    respx_mock.get("https://api.open-meteo.com/v1/forecast").mock(
        return_value=httpx.Response(200, json=SAMPLE_OPEN_METEO_RESPONSE)
    )
    yield respx_mock

SAMPLE_OPEN_METEO_RESPONSE = {...}  # realistic fixture
```

## 6. Rate limit handling

If the API has a rate limit:
- Document it in a comment on the client class
- Use a semaphore (`asyncio.Semaphore(N)`) to cap concurrency
- On 429, back off for the Retry-After header duration

## Checklist before done

- [ ] Client has timeout + retry + structured logging
- [ ] Service has caching + graceful degradation
- [ ] API key in config.py + .env.example (never hardcoded)
- [ ] Mock fixture in tests/mocks/
- [ ] 3+ tests: happy, cache hit, external failure
- [ ] fetched_at timestamp threaded through to Provenance
- [ ] README data sources table update