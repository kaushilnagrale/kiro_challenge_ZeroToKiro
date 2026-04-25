"""
Hydration risk classifier — rule-based, hackathon scope.

Based on the algorithm specified in .kiro/specs/02-routing-backend.md.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal

from .models import ProvenanceObj, RiskRequest, RiskResponse


def classify_risk(req: RiskRequest, env_source_id: str) -> RiskResponse:
    reasons: List[str] = []
    risk_points = 0

    hr_delta = req.hr - req.baseline_hr

    if hr_delta > 30:
        risk_points += 2
        reasons.append(f"HR {req.hr:.0f} bpm — {hr_delta:.0f} above baseline (critical)")
    elif hr_delta > 20:
        risk_points += 1
        reasons.append(f"HR {req.hr:.0f} bpm — {hr_delta:.0f} above baseline (elevated)")

    if req.hrv < 20:
        risk_points += 2
        reasons.append(f"HRV {req.hrv:.0f} ms — critically low (dehydration signal)")
    elif req.hrv < 35:
        risk_points += 1
        reasons.append(f"HRV {req.hrv:.0f} ms — below normal range")

    if req.skin_temp_c > 36.5:
        risk_points += 1
        reasons.append(f"Skin temp {req.skin_temp_c:.1f}°C — elevated, watch for heat stress")

    if req.ambient_temp_c > 38:
        risk_points += 1
        reasons.append(f"Ambient {req.ambient_temp_c:.0f}°C — extreme heat conditions")
    elif req.ambient_temp_c > 32:
        reasons.append(f"Ambient {req.ambient_temp_c:.0f}°C — hot conditions")

    if req.ride_minutes > 45:
        risk_points += 1
        reasons.append(f"{req.ride_minutes:.0f} min on bike — hydration break recommended")
    elif req.ride_minutes > 30:
        reasons.append(f"{req.ride_minutes:.0f} min on bike — consider hydrating soon")

    if not reasons:
        reasons.append("All biosignals within normal range")

    score: Literal["green", "yellow", "red"]
    if risk_points <= 2:
        score = "green"
    elif risk_points <= 4:
        score = "yellow"
    else:
        score = "red"

    now = datetime.now(timezone.utc)
    provenance = ProvenanceObj(
        biosignal_source_id="bio_sim_v1",
        biosignal_timestamp=now,
        environmental_source_id=env_source_id,
        environmental_timestamp=now,
        route_segment_id="risk_assessment",
    )

    return RiskResponse(
        score=score,
        risk_points=risk_points,
        reasons=reasons,
        provenance=provenance,
    )
