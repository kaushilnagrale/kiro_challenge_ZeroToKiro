"""
PulseRoute shared Pydantic schemas — source of truth for all API contracts.

Owner: Track B (Sai)
Frozen: target 11:30 AM. Schema changes after freeze require all-three ack.

Every response model MUST include a `provenance: Provenance` field.
This is enforced at the type level — missing provenance = validation error.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ─────────── Provenance (the guardrail) ───────────

class SourceRef(BaseModel):
    """A single data source citation."""
    source_id: str
    timestamp: datetime
    age_seconds: int


class Provenance(BaseModel):
    """
    Attached to every API response. The Accountability Logic Gate checks
    this object before letting any safety alert reach the UI.
    """
    bio_source: Optional[SourceRef] = None
    env_source: Optional[SourceRef] = None
    route_segment_id: Optional[str] = None


# ─────────── Biosignal ───────────

BioMode = Literal["baseline", "moderate", "dehydrating"]
BioSource = Literal[
    "sim_baseline", "sim_moderate", "sim_dehydrating", "healthkit"
]


class Biosignal(BaseModel):
    hr: float
    hrv_ms: float
    skin_temp_c: float
    timestamp: datetime
    source: BioSource


# ─────────── Weather ───────────

class WeatherSnapshot(BaseModel):
    temp_c: float
    humidity_pct: float
    heat_index_c: Optional[float] = None
    uv_index: Optional[float] = None
    apparent_temp_c: Optional[float] = None
    wind_kmh: Optional[float] = None


class WeatherHourly(BaseModel):
    at: datetime
    temp_c: float
    humidity_pct: float
    uv_index: Optional[float] = None


class Advisory(BaseModel):
    id: str
    headline: str
    severity: str
    effective: datetime
    expires: datetime
    source: str = "NWS"


class AirQuality(BaseModel):
    aqi: int
    dominant_pollutant: str


class WeatherResponse(BaseModel):
    current: WeatherSnapshot
    forecast_hourly: list[WeatherHourly]
    advisories: list[Advisory]
    air_quality: Optional[AirQuality] = None
    provenance: Provenance


# ─────────── Stops ───────────

Amenity = Literal["water", "shade", "food", "restroom", "ac", "bike_repair"]


class Stop(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    amenities: list[Amenity]
    open_now: Optional[bool] = None
    source: str
    source_ref: str


class StopsResponse(BaseModel):
    fountains: list[Stop]  # Official water sources
    cafes: list[Stop]  # Commercial refreshments
    repair: list[Stop]  # Bike maintenance
    shade_zones: list[Stop] = []  # Shaded rest areas (shelters, tree groves, covered areas)
    provenance: Provenance


# ─────────── Route ───────────

class RouteSegment(BaseModel):
    id: str
    polyline: list[tuple[float, float]]
    mrt_mean_c: float
    length_m: float
    eta_seconds_into_ride: int
    forecasted_temp_c: Optional[float] = None


class Route(BaseModel):
    polyline: list[tuple[float, float]]
    distance_m: float
    eta_seconds: int
    peak_mrt_c: float
    mean_mrt_c: float
    shade_pct: float
    stops: list[Stop]
    segments: list[RouteSegment]
    provenance: Provenance


class RouteRequest(BaseModel):
    origin: tuple[float, float]
    destination: tuple[float, float]
    depart_time: datetime
    sensitive_mode: bool = False
    bio_session_id: Optional[str] = None
    amenity_prefs: list[Amenity] = Field(default_factory=lambda: ["water"])


class RouteResponse(BaseModel):
    fastest: Route
    pulseroute: Route
    provenance: Provenance


# ─────────── Risk & Safety ───────────

RiskLevel = Literal["green", "yellow", "red"]


class RideContext(BaseModel):
    minutes: float
    baseline_hr: float = 65.0
    current_lat: float
    current_lng: float


class RiskScore(BaseModel):
    level: RiskLevel
    points: int
    top_reason: str
    all_reasons: list[str]
    provenance: Provenance


class SafetyAlert(BaseModel):
    risk: RiskScore
    suggested_stop: Optional[Stop] = None
    message: str
    provenance: Provenance


class RiskRequest(BaseModel):
    bio_session_id: str
    current_lat: float
    current_lng: float
    ride_minutes: float
    baseline_hr: Optional[float] = None
    # Fix 2: rider profile for personalized thresholds
    sensitive_mode: bool = False
    fitness_level: Optional[Literal["beginner", "intermediate", "advanced"]] = None
    # Fix 3: upcoming segments for predictive lookahead
    upcoming_segments: list[RouteSegment] = Field(default_factory=list)
    current_eta_seconds: int = 0


class LookaheadWarning(BaseModel):
    """Predictive heat warning — fired before the rider enters a hot zone."""
    projected_points: int
    reason: str
    seconds_until_hot_zone: int
    peak_mrt_c: float


class RiskResponse(BaseModel):
    """Either a validated SafetyAlert or a fallback neutral message."""
    alert: Optional[SafetyAlert] = None
    fallback: bool = False
    fallback_message: Optional[str] = None
    # Fix 3: lookahead warning (present even when current risk is green)
    lookahead: Optional[LookaheadWarning] = None
    # Fix 1: human-readable stop recommendation reason
    stop_reason: Optional[str] = None


# ─────────── Health ───────────

class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    version: str
    uptime_s: int