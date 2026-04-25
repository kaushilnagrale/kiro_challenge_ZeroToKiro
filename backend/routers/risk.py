"""
Risk router — POST /risk

Accepts a RiskRequest, fetches biosignal and weather, classifies hydration risk,
builds a SafetyAlert candidate, validates it through the SafetyGate, and returns
a RiskResponse.

If the gate fails, returns a fallback response with a conservative message.
"""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter

from backend.safety import validate_safety_alert
from backend.services.bio_service import bio_service
from backend.services.hydration_service import hydration_service
from backend.services.stops_service import stops_service
from backend.services.weather_service import weather_service
from shared.schema import (
    Provenance,
    RideContext,
    RiskRequest,
    RiskResponse,
    SafetyAlert,
    SourceRef,
)

logger = structlog.get_logger()

router = APIRouter(tags=["risk"])


@router.post("/risk", response_model=RiskResponse)
async def post_risk(req: RiskRequest) -> RiskResponse:
    """
    Assess hydration risk and return a validated SafetyAlert or fallback.

    Flow:
    1. BioService.get_current(bio_session_id) → Biosignal
    2. WeatherService.get_weather(current_lat, current_lng) → WeatherResponse
    3. HydrationService.classify(bio, context, weather) → RiskScore
    4. Build SafetyAlert candidate with provenance
    5. SafetyGate.validate_safety_alert(alert) → SafetyAlert | None
    6. If gate passes: return RiskResponse(alert=...)
    7. If gate fails: return RiskResponse(fallback=True, fallback_message=...)
    """
    logger.info(
        "risk.request",
        session_id=req.bio_session_id,
        lat=req.current_lat,
        lng=req.current_lng,
        ride_minutes=req.ride_minutes,
    )

    # ── Step 1: Fetch biosignal ───────────────────────────────────────────────
    bio = bio_service.get_current(req.bio_session_id)

    # ── Step 2: Fetch weather ──────────────────────────────────────────────────
    weather_response = await weather_service.get_weather(req.current_lat, req.current_lng)
    weather_snapshot = weather_response.current

    # ── Step 3: Classify risk ──────────────────────────────────────────────────
    ride_context = RideContext(
        minutes=req.ride_minutes,
        baseline_hr=req.baseline_hr or 65.0,
        current_lat=req.current_lat,
        current_lng=req.current_lng,
    )

    risk_score = hydration_service.classify(bio, ride_context, weather_snapshot)

    # ── Step 4: Build SafetyAlert candidate ────────────────────────────────────
    # Find nearest stop if risk is yellow or red
    suggested_stop = None
    if risk_score.level in ("yellow", "red"):
        # Get stops near current location (0.01 degree bbox ~ 1km)
        bbox = (
            req.current_lat - 0.01,
            req.current_lng - 0.01,
            req.current_lat + 0.01,
            req.current_lng + 0.01,
        )
        stops_response = stops_service.get_stops(bbox, "water")
        all_stops = stops_response.fountains + stops_response.cafes + stops_response.repair
        if all_stops:
            # Pick closest stop (simple: first in list)
            suggested_stop = all_stops[0]

    # Build provenance for the alert
    now = datetime.now(timezone.utc)
    alert_provenance = Provenance(
        bio_source=SourceRef(
            source_id=bio.source,
            timestamp=bio.timestamp,
            age_seconds=int((now - bio.timestamp).total_seconds()),
        ),
        env_source=weather_response.provenance.env_source,
        route_segment_id="current-location",  # Not on a route, but gate requires this
    )

    alert_candidate = SafetyAlert(
        risk=risk_score,
        suggested_stop=suggested_stop,
        message=f"Hydration risk: {risk_score.level}. {risk_score.top_reason}",
        provenance=alert_provenance,
    )

    # ── Step 5: Validate through SafetyGate ────────────────────────────────────
    validated_alert = validate_safety_alert(alert_candidate)

    # ── Step 6/7: Return response ──────────────────────────────────────────────
    if validated_alert is not None:
        logger.info(
            "risk.alert_validated",
            session_id=req.bio_session_id,
            level=risk_score.level,
            points=risk_score.points,
        )
        return RiskResponse(alert=validated_alert, fallback=False)
    else:
        logger.warning(
            "risk.gate_failed",
            session_id=req.bio_session_id,
            reason="provenance_check_failed",
        )
        return RiskResponse(
            alert=None,
            fallback=True,
            fallback_message="Sensor data unavailable — using conservative defaults.",
        )
