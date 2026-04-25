# Data & Biosignal Design — PulseRoute

## Overview

The data layer provides three critical capabilities for PulseRoute:

1. **Biosignal Simulator** (CRITICAL) - Generates realistic time-series biosignals (HR, HRV, skin temperature) with smooth physiological transitions between modes. This is the heart of the demo - without realistic biosignal dynamics, PulseRoute is just a static map app.

2. **Live Stops API Integration** (HIGH IMPACT) - Replaces 18 hardcoded stops with 200+ real water fountains, cafes, shade zones, and bike repair stations from OpenStreetMap via Overpass API. Includes graceful degradation to seed file on API failure.

3. **Hydration Classifier Alignment** (DOCUMENTATION) - Documents the current 10-rule hydration risk classifier and its relationship to Track C's simpler 6-rule specification.

### Design Philosophy

**Realism over simplicity**: The biosignal simulator prioritizes physiologically accurate dynamics (sigmoid transitions, exponential decay, Gaussian noise) over simple random sampling. This makes the demo compelling and validates the hydration classifier's ability to detect real physiological stress patterns.

**Graceful degradation**: The stops service falls back to seed data if Overpass API fails. The system never crashes due to external API unavailability.

**Explainability**: The hydration classifier returns human-readable reasons for every risk score, enabling users to understand and trust the system's recommendations.

### Key Technical Decisions

1. **Biosignal simulator uses numpy + scipy**: Vectorized signal generation with scipy's sigmoid/exponential curves for smooth transitions. Pure Python implementation would be too slow for real-time sampling.

2. **In-memory session state**: No persistence needed for hackathon scope. Session state (mode, last timestamp, signal parameters) stored in dict keyed by session_id.

3. **Overpass API with 24h cache**: Stops data changes infrequently. 24h TTL reduces API load while keeping data fresh enough for demo purposes.

4. **Keep current 10-rule classifier**: More sophisticated than Track C's 6-rule spec, provides better granularity for demo. Document the difference rather than downgrade.

### Out of Scope (Deferred)

- **MRT raster generation**: Hand-curated zones in `data/tempe_zones.json` sufficient for demo
- **OSMnx bike graph**: Mapbox routing adequate for hackathon scope
- **Data pipeline documentation**: Code comments sufficient, formal docs deferred
- **Persistent session storage**: In-memory dict adequate for demo

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend Services                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │ BioService   │─────▶│  bio_sim     │                   │
│  │ (existing)   │      │  (new)       │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                     │                            │
│         │              ┌──────▼──────┐                     │
│         │              │ Session     │                     │
│         │              │ State Dict  │                     │
│         │              └─────────────┘                     │
│         │                                                  │
│  ┌──────▼──────────┐                                       │
│  │ HydrationService│                                       │
│  │ (existing)      │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │ StopsService │─────▶│ Overpass API │                   │
│  │ (update)     │      │ (external)   │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                     │                            │
│         │              ┌──────▼──────┐                     │
│         │              │ Cache Dict  │                     │
│         │              │ (24h TTL)   │                     │
│         │              └─────────────┘                     │
│         │                                                  │
│         │              ┌──────────────┐                    │
│         └─────────────▶│ stops_seed   │                   │
│                        │ .json        │                   │
│                        │ (fallback)   │                   │
│                        └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Biosignal Generation Flow

```
1. Frontend requests biosignal
   ↓
2. BioService.get_current(session_id)
   ↓
3. bio_sim.get_current(session_id)
   ↓
4. Retrieve session state (mode, last_ts, signal_params)
   ↓
5. Generate next sample with smooth transition
   ↓
6. Update session state
   ↓
7. Return Biosignal with timestamp, source, provenance
```

#### Stops Retrieval Flow

```
1. Frontend requests stops for bbox
   ↓
2. StopsService.get_stops(bbox, amenity)
   ↓
3. Check cache (key: f"stops_{bbox}_{amenity}")
   ↓
4a. Cache HIT → Return cached stops
   ↓
4b. Cache MISS → Fetch from Overpass API
   ↓
5. Parse Overpass response → Stop objects
   ↓
6. Categorize: fountains, cafes, repair, shade_zones
   ↓
7. Store in cache (24h TTL)
   ↓
8. Return StopsResponse with provenance
   ↓
9. (On API failure) → Load stops_seed.json fallback
```

### Module Responsibilities

**`backend/bio_sim.py`** (NEW):
- Session management (create, retrieve, update)
- Signal generation with physiological dynamics
- Smooth mode transitions (sigmoid/exponential curves)
- Gaussian noise injection
- Monotonic timestamp enforcement

**`backend/services/bio_service.py`** (UPDATE):
- Thin wrapper around bio_sim
- Maintains backward compatibility with existing API
- Delegates to bio_sim.get_current() instead of random.uniform()

**`backend/services/hydration_service.py`** (NO CHANGE):
- 10-rule point-scoring classifier
- Risk level mapping (green/yellow/red)
- Human-readable reason generation
- Provenance tracking

**`backend/services/stops_service.py`** (UPDATE):
- Overpass API integration (httpx async client)
- Response parsing (OSM JSON → Stop objects)
- Amenity categorization
- 24h in-memory cache
- Graceful fallback to seed file

---

## Components and Interfaces

### BioSim Module (NEW)

**File**: `backend/bio_sim.py`

**Public API**:

```python
def start_session(mode: BioMode = "baseline") -> str:
    """
    Create a new biosignal session.
    
    Args:
        mode: Initial simulation mode (baseline/moderate/dehydrating)
    
    Returns:
        session_id: UUID4 string
    """

def get_current(session_id: str) -> Biosignal:
    """
    Generate next biosignal sample for session.
    
    Advances time by ~1s, applies smooth transitions if mode changed,
    adds Gaussian noise, enforces monotonic timestamps.
    
    Args:
        session_id: Session identifier from start_session()
    
    Returns:
        Biosignal with hr, hrv_ms, skin_temp_c, timestamp, source
    
    Raises:
        KeyError: If session_id not found
    """

def set_mode(session_id: str, mode: BioMode) -> None:
    """
    Change simulation mode for session.
    
    Triggers smooth transition over 30-60s to new mode's target ranges.
    
    Args:
        session_id: Session identifier
        mode: New mode (baseline/moderate/dehydrating)
    
    Raises:
        KeyError: If session_id not found
    """

def list_sessions() -> list[str]:
    """Return all active session IDs."""
```

**Internal State**:

```python
# Module-level dict
_sessions: dict[str, SessionState] = {}

class SessionState:
    mode: BioMode
    last_timestamp: datetime
    current_hr: float
    current_hrv: float
    current_skin_temp: float
    target_hr: float  # For smooth transitions
    target_hrv: float
    target_skin_temp: float
    transition_start: datetime | None
    transition_duration: float  # seconds
```

**Signal Generation Algorithm**:

```python
def _generate_sample(state: SessionState) -> tuple[float, float, float]:
    """
    Generate next HR, HRV, skin_temp sample.
    
    1. Check if in transition (mode recently changed)
    2. If transitioning:
       - Calculate progress (0.0 to 1.0)
       - Apply sigmoid interpolation: current + (target - current) * sigmoid(progress)
    3. If steady-state:
       - Sample from mode's range with Gaussian noise
    4. Enforce physiological bounds (HR: 50-200, HRV: 10-100, temp: 32-40)
    5. Return (hr, hrv, skin_temp)
    """
```

**Mode Ranges**:

```python
MODE_RANGES = {
    "baseline": {
        "hr": (65, 75),      # Resting
        "hrv": (50, 70),     # Healthy parasympathetic
        "skin_temp": (33.0, 33.6),  # Normal
        "source": "sim_baseline"
    },
    "moderate": {
        "hr": (130, 150),    # Vigorous exercise
        "hrv": (25, 35),     # Sympathetic activation
        "skin_temp": (36.5, 37.0),  # Thermoregulation
        "source": "sim_moderate"
    },
    "dehydrating": {
        "hr": (155, 175),    # Max effort
        "hrv": (15, 25),     # High stress
        "skin_temp": (37.5, 38.5),  # Impaired cooling
        "source": "sim_dehydrating"
    }
}
```

**Noise Parameters**:

```python
NOISE_PARAMS = {
    "hr_sigma": 2.0,        # bpm
    "hrv_sigma": 3.0,       # ms
    "skin_temp_sigma": 0.1  # °C
}
```

### BioService Update

**File**: `backend/services/bio_service.py`

**Changes**:

```python
# OLD (current implementation)
def get_current(self, session_id: str) -> Biosignal:
    hr = random.uniform(hr_min, hr_max)
    hrv = random.uniform(hrv_min, hrv_max)
    skin_temp = random.uniform(temp_min, temp_max)
    # ...

# NEW (delegates to bio_sim)
def get_current(self, session_id: str) -> Biosignal:
    from backend.bio_sim import get_current as bio_sim_get_current
    return bio_sim_get_current(session_id)
```

**Backward Compatibility**: Existing callers (routers, tests) see no API changes.

### StopsService Update

**File**: `backend/services/stops_service.py`

**New Methods**:

```python
async def _fetch_from_overpass(
    self,
    bbox: tuple[float, float, float, float]
) -> list[dict]:
    """
    Fetch stops from Overpass API.
    
    Query tags:
    - amenity=drinking_water (fountains)
    - amenity=cafe|restaurant|convenience|fuel (commercial)
    - amenity=shelter (shade)
    - covered=yes (shade)
    - highway=bus_stop (shade)
    - leisure=park (shade)
    - amenity=bicycle_repair_station (repair)
    
    Args:
        bbox: (lat_min, lng_min, lat_max, lng_max)
    
    Returns:
        List of OSM node dicts
    
    Raises:
        httpx.TimeoutException: If API takes >5s
        httpx.HTTPError: If API returns error
    """

def _parse_overpass_response(self, response: dict) -> list[Stop]:
    """
    Convert Overpass JSON to Stop objects.
    
    Maps OSM tags to PulseRoute amenities:
    - drinking_water → water
    - cafe/restaurant/convenience/fuel → water, food
    - shelter/covered=yes/bus_stop/park → shade
    - bicycle_repair_station → bike_repair
    
    Args:
        response: Overpass API JSON response
    
    Returns:
        List of Stop objects with amenities categorized
    """

def _categorize_stops(self, stops: list[Stop]) -> dict:
    """
    Categorize stops into fountains, cafes, repair, shade_zones.
    
    Rules:
    - fountains: source in {"official", "fountain"}
    - cafes: source == "commercial"
    - repair: "bike_repair" in amenities
    - shade_zones: "shade" in amenities AND not a fountain
    
    Args:
        stops: List of Stop objects
    
    Returns:
        Dict with keys: fountains, cafes, repair, shade_zones
    """
```

**Updated get_stops()**:

```python
def get_stops(
    self,
    bbox: tuple[float, float, float, float],
    amenity: str | None = None,
) -> StopsResponse:
    """
    Get stops with live Overpass API + 24h cache + fallback.
    
    Flow:
    1. Check cache (key: f"stops_{bbox}_{amenity}")
    2. If cache miss:
       a. Try Overpass API (5s timeout)
       b. On success: parse, cache, return
       c. On failure: load stops_seed.json
    3. Filter by bbox and amenity
    4. Categorize into fountains/cafes/repair/shade_zones
    5. Build provenance (source_id, timestamp, age_seconds)
    6. Return StopsResponse
    """
```

**Cache Structure**:

```python
# Module-level cache
_cache: dict[str, CacheEntry] = {}

class CacheEntry:
    stops: list[Stop]
    timestamp: datetime
    ttl_seconds: int = 86400  # 24 hours
    
    def is_expired(self) -> bool:
        age = (datetime.now(timezone.utc) - self.timestamp).total_seconds()
        return age > self.ttl_seconds
```

### HydrationService (NO CHANGES)

**File**: `backend/services/hydration_service.py`

**Current Implementation**: 10-rule point-scoring system (see requirements FR-C2)

**Decision**: Keep current implementation. It's more sophisticated than Track C's 6-rule spec and provides better granularity for demo.

**Documentation**: Add docstring explaining the difference:

```python
"""
HydrationService — rule-based hydration risk classifier for PulseRoute.

Uses a 10-rule point-scoring system (0-100+ points):
- Heart rate: 3 thresholds (140/155/170 bpm)
- Skin temperature: 2 thresholds (37.5/38.0°C)
- HRV: 2 thresholds (20/35 ms)
- Ride duration: 1 threshold (45 min)
- Heat index: 2 thresholds (35/40°C)

Risk levels: 0-19=green, 20-44=yellow, 45+=red

Note: Track C spec proposes a simpler 6-rule system (0-8 points).
Current implementation is more granular and better suited for demo.
See docs/HYDRATION_DECISION_LOGIC.md for comparison.
"""
```

---

## Data Models

### Biosignal (Existing Schema)

```python
class Biosignal(BaseModel):
    hr: float                    # Heart rate (bpm)
    hrv_ms: float               # Heart rate variability (ms)
    skin_temp_c: float          # Skin temperature (°C)
    timestamp: datetime         # When measured (UTC)
    source: BioSource           # "sim_baseline" | "sim_moderate" | "sim_dehydrating" | "healthkit"
```

**Validation Rules**:
- `hr`: 50 ≤ hr ≤ 200 (physiological bounds)
- `hrv_ms`: 10 ≤ hrv ≤ 100 (physiological bounds)
- `skin_temp_c`: 32 ≤ temp ≤ 40 (physiological bounds)
- `timestamp`: Must be monotonically increasing per session

### Stop (Existing Schema)

```python
class Stop(BaseModel):
    id: str                     # Unique identifier
    name: str                   # Human-readable name
    lat: float                  # Latitude
    lng: float                  # Longitude
    amenities: list[Amenity]    # ["water", "shade", "food", "restroom", "ac", "bike_repair"]
    open_now: bool | None       # Operating status (None if unknown)
    source: str                 # "official" | "fountain" | "commercial" | "public"
    source_ref: str             # OSM node ID or "stops_seed_v1"
```

**Amenity Mapping from OSM**:

| OSM Tag | PulseRoute Amenity |
|---------|-------------------|
| `amenity=drinking_water` | `water` |
| `amenity=cafe` | `water`, `food` |
| `amenity=restaurant` | `water`, `food` |
| `amenity=convenience` | `water`, `food` |
| `amenity=fuel` | `water`, `food` |
| `amenity=shelter` | `shade` |
| `covered=yes` | `shade` |
| `highway=bus_stop` | `shade` |
| `leisure=park` | `shade` |
| `amenity=bicycle_repair_station` | `bike_repair` |
| `toilets=yes` | `restroom` |
| `indoor=yes` | `ac` |

### StopsResponse (Existing Schema)

```python
class StopsResponse(BaseModel):
    fountains: list[Stop]       # Official water sources
    cafes: list[Stop]           # Commercial establishments
    repair: list[Stop]          # Bike maintenance
    shade_zones: list[Stop]     # Shelters, parks, covered areas (NEW)
    provenance: Provenance      # Data source tracking
```

**Categorization Rules**:
- `fountains`: `source in {"official", "fountain"}`
- `cafes`: `source == "commercial"`
- `repair`: `"bike_repair" in amenities`
- `shade_zones`: `"shade" in amenities AND source not in {"official", "fountain"}`

### RiskScore (Existing Schema)

```python
class RiskScore(BaseModel):
    level: RiskLevel            # "green" | "yellow" | "red"
    points: int                 # Total risk points (0-100+)
    top_reason: str             # Most significant factor
    all_reasons: list[str]      # All contributing factors
    provenance: Provenance      # Bio + env source tracking
```

**Example**:

```python
RiskScore(
    level="yellow",
    points=28,
    top_reason="Heart rate elevated (145 bpm)",
    all_reasons=[
        "Heart rate elevated (145 bpm)",
        "Heart rate variability low (32 ms)",
        "High heat index (37.0°C)"
    ],
    provenance=Provenance(
        bio_source=SourceRef(
            source_id="sim_moderate",
            timestamp=datetime(2024, 1, 15, 14, 30, 0),
            age_seconds=2
        ),
        env_source=SourceRef(
            source_id="weather_snapshot",
            timestamp=datetime(2024, 1, 15, 14, 29, 58),
            age_seconds=4
        )
    )
)
```

### SessionState (Internal to bio_sim)

```python
@dataclass
class SessionState:
    """Internal state for biosignal session."""
    mode: BioMode
    last_timestamp: datetime
    current_hr: float
    current_hrv: float
    current_skin_temp: float
    target_hr: float
    target_hrv: float
    target_skin_temp: float
    transition_start: datetime | None
    transition_duration: float  # seconds
```

**Lifecycle**:
1. Created by `start_session()` with initial mode
2. Updated by `get_current()` on each sample
3. Modified by `set_mode()` to trigger transitions
4. Stored in module-level `_sessions` dict

### CacheEntry (Internal to stops_service)

```python
@dataclass
class CacheEntry:
    """Cache entry for stops data."""
    stops: list[Stop]
    timestamp: datetime
    ttl_seconds: int = 86400  # 24 hours
    
    def is_expired(self) -> bool:
        age = (datetime.now(timezone.utc) - self.timestamp).total_seconds()
        return age > self.ttl_seconds
```

**Cache Key Format**: `f"stops_{lat_min}_{lng_min}_{lat_max}_{lng_max}_{amenity}"`

---

