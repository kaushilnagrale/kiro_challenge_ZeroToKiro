from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class ProvenanceObj(BaseModel):
    biosignal_source_id: Optional[str] = None
    biosignal_timestamp: Optional[datetime] = None
    environmental_source_id: Optional[str] = None
    environmental_timestamp: Optional[datetime] = None
    route_segment_id: Optional[str] = None


class StopPoint(BaseModel):
    id: str
    type: Literal["fountain", "cafe", "repair", "bench"]
    name: str
    lat: float
    lon: float
    distance_m: Optional[float] = None


class RouteObj(BaseModel):
    type: Literal["fastest", "pulseroute"]
    polyline: List[List[float]]  # [[lat, lon], ...]
    distance_m: float
    duration_s: float
    peak_mrt_c: float
    shade_pct: float
    water_stops: List[StopPoint]
    segment_id: str
    mrt_differential: Optional[float] = None


class RouteResponse(BaseModel):
    fastest: RouteObj
    pulseroute: RouteObj
    weather: Optional[dict] = None
    provenance: ProvenanceObj


class RouteRequest(BaseModel):
    origin: List[float]       # [lat, lon]
    destination: List[float]  # [lat, lon]
    depart_time: Optional[str] = None
    sensitive_mode: bool = False


class RiskRequest(BaseModel):
    hr: float
    hrv: float
    skin_temp_c: float
    ambient_temp_c: float
    ride_minutes: float
    baseline_hr: float = 65.0


class RiskResponse(BaseModel):
    score: Literal["green", "yellow", "red"]
    risk_points: int
    reasons: List[str]
    provenance: ProvenanceObj


class SafetyAlert(BaseModel):
    message: str
    stop: Optional[StopPoint] = None
    recommended_stop_minutes: int = 3
    score: Literal["green", "yellow", "red"]
    provenance: ProvenanceObj


class StopsResponse(BaseModel):
    fountains: List[StopPoint]
    cafes: List[StopPoint]
    repair: List[StopPoint]
    provenance: ProvenanceObj


class BioReading(BaseModel):
    session_id: str
    hr: float
    hrv: float
    skin_temp_c: float
    timestamp: datetime
    mode: str


class BioSessionRequest(BaseModel):
    mode: Literal["baseline", "moderate", "dehydrating"] = "baseline"
