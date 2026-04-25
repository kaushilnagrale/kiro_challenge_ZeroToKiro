"""
PulseRoute FastAPI backend.

Endpoints:
  GET  /health
  POST /route      — route comparison with provenance
  POST /risk       — hydration risk classification
  GET  /stops      — water fountains, cafes, repair stations
  GET  /weather    — Open-Meteo + NWS advisory
  POST /bio/session — start biosignal simulator session
  GET  /bio/{id}   — read current biosignal values
  POST /alert      — create + validate a safety alert through the Logic Gate
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .bio_sim import simulator
from .models import (
    BioReading,
    BioSessionRequest,
    ProvenanceObj,
    RiskRequest,
    RiskResponse,
    RouteRequest,
    RouteResponse,
    SafetyAlert,
    StopsResponse,
)
from .risk import classify_risk
from .routing import compute_routes
from .safety import SENSOR_UNAVAILABLE_MSG, validate_safety_alert
from .stops import fetch_stops
from .weather import fetch_nws_advisory, fetch_weather

app = FastAPI(
    title="PulseRoute API",
    version="1.0.0",
    description="Backend for PulseRoute — cool-route cycling co-pilot for hot cities.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "pulseroute-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Route ─────────────────────────────────────────────────────────────────────

@app.post("/route", response_model=RouteResponse)
async def route(req: RouteRequest):
    weather = await fetch_weather(req.origin[0], req.origin[1])
    fastest, pulse = await compute_routes(req)
    now = datetime.now(timezone.utc)
    provenance = ProvenanceObj(
        biosignal_source_id="bio_sim_v1",
        biosignal_timestamp=now,
        environmental_source_id=weather["source_id"],
        environmental_timestamp=now,
        route_segment_id=pulse.segment_id,
    )
    return RouteResponse(
        fastest=fastest,
        pulseroute=pulse,
        weather=weather,
        provenance=provenance,
    )


# ── Risk ──────────────────────────────────────────────────────────────────────

@app.post("/risk", response_model=RiskResponse)
async def risk(req: RiskRequest):
    weather = await fetch_weather()
    if req.ambient_temp_c <= 0:
        req.ambient_temp_c = weather["ambient_temp_c"]
    env_source = weather.get("source_id", "open-meteo")
    return classify_risk(req, env_source)


# ── Stops ─────────────────────────────────────────────────────────────────────

@app.get("/stops", response_model=StopsResponse)
async def stops(
    south: float = Query(33.38, description="Bounding box south"),
    west:  float = Query(-111.97, description="Bounding box west"),
    north: float = Query(33.47,  description="Bounding box north"),
    east:  float = Query(-111.90, description="Bounding box east"),
):
    data = await fetch_stops((south, west, north, east))
    now = datetime.now(timezone.utc)
    return StopsResponse(
        fountains=data["fountains"],
        cafes=data["cafes"],
        repair=data["repair"],
        provenance=ProvenanceObj(
            environmental_source_id="osm-overpass",
            environmental_timestamp=now,
            route_segment_id="stops_layer",
        ),
    )


# ── Weather ───────────────────────────────────────────────────────────────────

@app.get("/weather")
async def weather(
    lat: float = Query(33.4255),
    lon: float = Query(-111.9400),
):
    w = await fetch_weather(lat, lon)
    advisory = await fetch_nws_advisory(lat, lon)
    return {**w, "advisory": advisory}


# ── Alert (Logic Gate demo endpoint) ─────────────────────────────────────────

@app.post("/alert")
async def create_alert(
    message: str = Query(..., description="Alert message text"),
    score: str   = Query("yellow", description="green | yellow | red"),
    bio_session_id: Optional[str] = Query(None),
    route_segment_id: str = Query("seg_default"),
):
    now = datetime.now(timezone.utc)
    weather = await fetch_weather()

    alert = SafetyAlert(
        message=message,
        score=score,
        provenance=ProvenanceObj(
            biosignal_source_id="bio_sim_v1" if bio_session_id else None,
            biosignal_timestamp=now if bio_session_id else None,
            environmental_source_id=weather["source_id"],
            environmental_timestamp=now,
            route_segment_id=route_segment_id,
        ),
    )

    validated = validate_safety_alert(alert)
    if validated is None:
        return {"alert": None, "fallback_message": SENSOR_UNAVAILABLE_MSG}
    return {"alert": validated}


# ── Biosignal simulator ───────────────────────────────────────────────────────

@app.post("/bio/session")
async def bio_start(req: BioSessionRequest):
    session_id = simulator.start_session(req.mode)
    return {"session_id": session_id, "mode": req.mode}


@app.get("/bio/{session_id}", response_model=BioReading)
async def bio_read(session_id: str):
    try:
        return simulator.get_current(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Bio session '{session_id}' not found")
