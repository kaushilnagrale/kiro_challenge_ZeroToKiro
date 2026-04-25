"""
HydrationService — rule-based hydration risk classifier for PulseRoute.

Thresholds are personalized per rider via the `thresholds` parameter.

**Heart Rate (3 rules)**:
- HR > hr_critical  → +40 points  (default 170 bpm)
- HR > hr_high      → +25 points  (default 155 bpm)
- HR > hr_elevated  → +10 points  (default 140 bpm)

**Skin Temperature (2 rules)**:
- skin_temp > skin_critical → +30 points  (default 38.0°C)
- skin_temp > skin_elevated → +15 points  (default 37.5°C)

**Heart Rate Variability (2 rules)**:
- HRV < hrv_critical → +20 points  (default 20 ms)
- HRV < hrv_low      → +10 points  (default 35 ms)

**Ride Duration (1 rule)**:
- ride_minutes > duration_threshold → +10 points  (default 45 min)

**Heat Index (2 rules)**:
- heat_index > heat_danger  → +15 points  (default 40°C)
- heat_index > heat_caution → +8 points   (default 35°C)

**Risk Thresholds**:
- 0-19 points → GREEN
- 20-44 points → YELLOW
- 45+ points → RED

## Personalization (Fix 2)

Pass a `Thresholds` object to `classify()` to adjust per rider:
- sensitive_mode: stricter thresholds (kids, elderly, cardiac)
- fitness_level "advanced": more lenient thresholds (trained athletes)
- fitness_level "beginner": slightly more conservative than default
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Optional

import structlog

from shared.schema import (
    Biosignal,
    Provenance,
    RideContext,
    RiskLevel,
    RiskScore,
    SourceRef,
    WeatherSnapshot,
)

logger = structlog.get_logger()


@dataclass
class Thresholds:
    """Personalized scoring thresholds for the hydration classifier."""
    # Heart rate
    hr_critical: float = 170.0
    hr_high: float = 155.0
    hr_elevated: float = 140.0
    # Skin temperature
    skin_critical: float = 38.0
    skin_elevated: float = 37.5
    # HRV (lower is worse)
    hrv_critical: float = 20.0
    hrv_low: float = 35.0
    # Ride duration
    duration_threshold: float = 45.0
    # Heat index
    heat_danger: float = 40.0
    heat_caution: float = 35.0


def build_thresholds(
    sensitive_mode: bool = False,
    fitness_level: Optional[Literal["beginner", "intermediate", "advanced"]] = None,
) -> Thresholds:
    """
    Build personalized thresholds from rider profile flags.

    sensitive_mode (kids, elderly, cardiac):
      - Alert at lower HR, higher HRV, lower skin temp, lower heat index
      - Shorter ride duration before flagging

    fitness_level "advanced" (trained athletes):
      - Alert at higher HR, lower HRV threshold, higher skin temp tolerance
      - Longer ride duration before flagging

    fitness_level "beginner":
      - Slightly more conservative than default intermediate
    """
    if sensitive_mode:
        return Thresholds(
            hr_critical=150.0,
            hr_high=135.0,
            hr_elevated=120.0,
            skin_critical=37.5,
            skin_elevated=37.0,
            hrv_critical=25.0,
            hrv_low=40.0,
            duration_threshold=30.0,
            heat_danger=37.0,
            heat_caution=33.0,
        )

    if fitness_level == "advanced":
        return Thresholds(
            hr_critical=180.0,
            hr_high=165.0,
            hr_elevated=150.0,
            skin_critical=38.5,
            skin_elevated=38.0,
            hrv_critical=15.0,
            hrv_low=28.0,
            duration_threshold=60.0,
            heat_danger=42.0,
            heat_caution=37.0,
        )

    if fitness_level == "beginner":
        return Thresholds(
            hr_critical=160.0,
            hr_high=145.0,
            hr_elevated=130.0,
            skin_critical=37.8,
            skin_elevated=37.3,
            hrv_critical=22.0,
            hrv_low=38.0,
            duration_threshold=35.0,
            heat_danger=38.0,
            heat_caution=34.0,
        )

    # intermediate / default
    return Thresholds()


class HydrationService:
    """Rule-based hydration risk classifier with personalized thresholds."""

    def classify(
        self,
        bio: Biosignal,
        context: RideContext,
        weather: WeatherSnapshot,
        thresholds: Optional[Thresholds] = None,
    ) -> RiskScore:
        """
        Classify hydration risk based on biosignal, ride context, and weather.

        Args:
            bio:        Current biosignal reading.
            context:    Ride context (duration, location).
            weather:    Current weather snapshot.
            thresholds: Personalized thresholds. Defaults to standard intermediate.

        Returns:
            RiskScore with level, points, top_reason, all_reasons, and provenance.
        """
        t = thresholds or Thresholds()
        points = 0
        reasons: list[tuple[int, str]] = []

        # Heart rate scoring
        if bio.hr > t.hr_critical:
            pts = 40
            points += pts
            reasons.append((pts, f"Heart rate critically high ({bio.hr:.0f} bpm)"))
        elif bio.hr > t.hr_high:
            pts = 25
            points += pts
            reasons.append((pts, f"Heart rate very high ({bio.hr:.0f} bpm)"))
        elif bio.hr > t.hr_elevated:
            pts = 10
            points += pts
            reasons.append((pts, f"Heart rate elevated ({bio.hr:.0f} bpm)"))

        # Skin temperature scoring
        if bio.skin_temp_c > t.skin_critical:
            pts = 30
            points += pts
            reasons.append((pts, f"Skin temperature critically high ({bio.skin_temp_c:.1f}°C)"))
        elif bio.skin_temp_c > t.skin_elevated:
            pts = 15
            points += pts
            reasons.append((pts, f"Skin temperature elevated ({bio.skin_temp_c:.1f}°C)"))

        # HRV scoring (lower is worse)
        if bio.hrv_ms < t.hrv_critical:
            pts = 20
            points += pts
            reasons.append((pts, f"Heart rate variability critically low ({bio.hrv_ms:.0f} ms)"))
        elif bio.hrv_ms < t.hrv_low:
            pts = 10
            points += pts
            reasons.append((pts, f"Heart rate variability low ({bio.hrv_ms:.0f} ms)"))

        # Ride duration scoring
        if context.minutes > t.duration_threshold:
            pts = 10
            points += pts
            reasons.append((pts, f"Extended ride duration ({context.minutes:.0f} minutes)"))

        # Heat index scoring
        if weather.heat_index_c is not None:
            if weather.heat_index_c > t.heat_danger:
                pts = 15
                points += pts
                reasons.append((pts, f"Extreme heat index ({weather.heat_index_c:.1f}°C)"))
            elif weather.heat_index_c > t.heat_caution:
                pts = 8
                points += pts
                reasons.append((pts, f"High heat index ({weather.heat_index_c:.1f}°C)"))

        # Map points to risk level
        if points >= 45:
            level: RiskLevel = "red"
        elif points >= 20:
            level = "yellow"
        else:
            level = "green"

        all_reasons = [reason for _, reason in reasons]
        top_reason = reasons[0][1] if reasons else "All metrics within normal range"

        now = datetime.now(timezone.utc)
        provenance = Provenance(
            bio_source=SourceRef(
                source_id=bio.source,
                timestamp=bio.timestamp,
                age_seconds=int((now - bio.timestamp).total_seconds()),
            ),
            env_source=SourceRef(
                source_id="weather_snapshot",
                timestamp=now,
                age_seconds=0,
            ),
            route_segment_id=None,
        )

        logger.info(
            "hydration_service.classify",
            level=level,
            points=points,
            top_reason=top_reason,
            num_reasons=len(all_reasons),
            personalized=thresholds is not None,
        )

        return RiskScore(
            level=level,
            points=points,
            top_reason=top_reason,
            all_reasons=all_reasons,
            provenance=provenance,
        )


# Module-level singleton
hydration_service = HydrationService()
