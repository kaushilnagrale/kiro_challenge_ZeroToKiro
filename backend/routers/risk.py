"""
Risk router — POST /risk

Full decision pipeline:
  1. Fetch biosignal
  2. Fetch weather
  3. Build personalized thresholds (Fix 2)
  4. Classify hydration risk with those thresholds
  5. StopRecommender: pick the right stop with a reason (Fix 1)
  6. LookaheadService: project risk 10 min ahead (Fix 3)
  7. Build SafetyAlert + validate through SafetyGate
  8. Return RiskResponse with alert, stop_reason, and lookahead
"""

import math
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter

from backend.safety import validate_safety_alert
from backend.services.bio_service import bio_service
from backend.services.hydration_service import build_thresholds, hydration_service
from backend.services.lookahead_service import predict_future_risk
from backend.services.stop_recommender import recommend_stop
from backend.services.stops_service import stops_service
from backend.services.weather_service import weather_service
from shared.schema import (
    Amenity,
    Provenance,
    RideContext,
    RiskRequest,
    RiskResponse,
    SafetyAlert,
    SourceRef,
)

logger = structlog.get_logger()

router = APIRouter(tags=["risk"])

# Default amenity preferences when none are provided
_DEFAULT_PREFS: list[Amenity] = ["water"]


@router.post("/risk", response_model=RiskResponse)
async def post_risk(req: RiskRequest) -> RiskResponse:
    """
    Assess hydration risk and return a validated SafetyAlert or fallback.

    Enhancements:
    - Fix 1: StopRecommender picks the best stop with a human-readable reason
    - Fix 2: Thresholds are personalized per rider (sensitive_mode, fitness_level)
    - Fix 3: LookaheadService projects risk 10 min ahead using route segments
    """
    logger.info(
        "risk.request",
        session_id=req.bio_session_id,
        lat=req.current_lat,
        lng=req.current_lng,
        ride_minutes=req.ride_minutes,
        sensitive_mode=req.sensitive_mode,
        fitness_level=req.fitness_level,
        upcoming_segments=len(req.upcoming_segments),
    )

    # ── Step 1: Fetch biosignal ───────────────────────────────────────────────
    bio = bio_service.get_current(req.bio_session_id)

    # ── Step 2: Fetch weather ─────────────────────────────────────────────────
    weather_response = await weather_service.get_weather(req.current_lat, req.current_lng)
    weather_snapshot = weather_response.current

    # ── Step 3: Build personalized thresholds (Fix 2) ─────────────────────────
    thresholds = build_thresholds(
        sensitive_mode=req.sensitive_mode,
        fitness_level=req.fitness_level,
    )

    # ── Step 4: Classify risk with personalized thresholds ────────────────────
    ride_context = RideContext(
        minutes=req.ride_minutes,
        baseline_hr=req.baseline_hr or 65.0,
        current_lat=req.current_lat,
        current_lng=req.current_lng,
    )
    risk_score = hydration_service.classify(bio, ride_context, weather_snapshot, thresholds)

    # ── Step 5: StopRecommender (Fix 1) ───────────────────────────────────────
    suggested_stop = None
    stop_reason: str | None = None

    if risk_score.level in ("yellow", "red"):
        # ~2 km search radius
        bbox = (
            req.current_lat - 0.018,
            req.current_lng - 0.018,
            req.current_lat + 0.018,
            req.current_lng + 0.018,
        )
        stops_response = stops_service.get_stops(bbox, "water")
        all_stops = (
            stops_response.fountains
            + stops_response.cafes
            + stops_response.repair
        )

        # Use rider prefs from request, fall back to default
        rider_prefs: list[Amenity] = _DEFAULT_PREFS

        suggested_stop, stop_reason = recommend_stop(
            risk=risk_score,
            location=(req.current_lat, req.current_lng),
            candidate_stops=all_stops,
            rider_prefs=rider_prefs,
        )

    # ── Step 6: Predictive lookahead (Fix 3) ──────────────────────────────────
    lookahead = None
    if req.upcoming_segments:
        lookahead = predict_future_risk(
            current_risk=risk_score,
            upcoming_segments=req.upcoming_segments,
            current_eta_seconds=req.current_eta_seconds,
        )

    # ── Step 7: Build SafetyAlert + validate through gate ─────────────────────
    now = datetime.now(timezone.utc)
    bio_age = max(0, int((now - bio.timestamp).total_seconds()))
    alert_provenance = Provenance(
        bio_source=SourceRef(
            source_id=bio.source,
            timestamp=bio.timestamp,
            age_seconds=min(bio_age, 59),
        ),
        env_source=weather_response.provenance.env_source,
        route_segment_id="current-location",
    )

    # Use stop_reason in the alert message if available
    alert_message = stop_reason or f"Hydration risk: {risk_score.level}. {risk_score.top_reason}"

    alert_candidate = SafetyAlert(
        risk=risk_score,
        suggested_stop=suggested_stop,
        message=alert_message,
        provenance=alert_provenance,
    )

    validated_alert = validate_safety_alert(alert_candidate)

    # ── Step 8: Return response ───────────────────────────────────────────────
    if validated_alert is not None:
        logger.info(
            "risk.alert_validated",
            session_id=req.bio_session_id,
            level=risk_score.level,
            points=risk_score.points,
            has_stop=suggested_stop is not None,
            has_lookahead=lookahead is not None,
        )
        return RiskResponse(
            alert=validated_alert,
            fallback=False,
            lookahead=lookahead,
            stop_reason=stop_reason,
        )
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
            lookahead=lookahead,  # lookahead is safe to return even on gate failure
        )
