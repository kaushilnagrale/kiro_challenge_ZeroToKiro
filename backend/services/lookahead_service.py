"""
LookaheadService — projects hydration risk 10 minutes into the future.

Uses the per-segment forecasted MRT from the route response to detect
upcoming heat spikes before the rider enters them.

Logic:
  1. Take the next N segments (covering ~10 minutes of ride time).
  2. Find the peak MRT segment in that window.
  3. If peak MRT > HOT_ZONE_MRT_C, project that current risk points will
     increase by a calibrated amount.
  4. If the projected total crosses a risk threshold (yellow or red),
     fire an anticipatory warning even if current risk is green.

This is the "brain doesn't just react" feature: it tells the rider to
stop NOW, before they're in a zone with no stop options.

MRT thresholds (Celsius):
  > 45°C  → warm zone  (+5 projected points)
  > 50°C  → hot zone   (+10 projected points)
  > 55°C  → danger zone (+20 projected points)

Demo line:
  "The brain looks 10 minutes down the route, knows where the heat spikes
   are, and tells you to stop BEFORE you're in trouble."
"""

import structlog

from shared.schema import LookaheadWarning, RouteSegment, RiskScore

logger = structlog.get_logger()

# How far ahead to look (seconds)
_LOOKAHEAD_WINDOW_S = 600  # 10 minutes

# MRT thresholds and their projected point additions
_MRT_TIERS: list[tuple[float, int, str]] = [
    (55.0, 20, "danger zone"),
    (50.0, 10, "hot zone"),
    (45.0,  5, "warm zone"),
]


def predict_future_risk(
    current_risk: RiskScore,
    upcoming_segments: list[RouteSegment],
    current_eta_seconds: int,
) -> LookaheadWarning | None:
    """
    Project risk 10 minutes into the future using upcoming route segments.

    Args:
        current_risk:        Current RiskScore from HydrationService.
        upcoming_segments:   All segments from the active route (full list).
        current_eta_seconds: How many seconds into the ride the rider is now.

    Returns:
        LookaheadWarning if a heat spike is detected ahead, None otherwise.
    """
    if not upcoming_segments:
        return None

    # Filter to segments within the lookahead window
    window_end = current_eta_seconds + _LOOKAHEAD_WINDOW_S
    ahead = [
        s for s in upcoming_segments
        if s.eta_seconds_into_ride > current_eta_seconds
        and s.eta_seconds_into_ride <= window_end
    ]

    if not ahead:
        return None

    # Find the hottest segment in the window
    peak_seg = max(ahead, key=lambda s: s.mrt_mean_c)
    peak_mrt = peak_seg.mrt_mean_c
    seconds_until = max(0, peak_seg.eta_seconds_into_ride - current_eta_seconds)

    # Determine projected point addition
    projected_addition = 0
    tier_label = ""
    for threshold, pts, label in _MRT_TIERS:
        if peak_mrt >= threshold:
            projected_addition = pts
            tier_label = label
            break

    if projected_addition == 0:
        # No significant heat spike ahead
        return None

    projected_total = current_risk.points + projected_addition

    # Only warn if projection crosses a threshold boundary
    # (green→yellow at 20, yellow→red at 45)
    current_level = current_risk.level
    crosses_yellow = current_level == "green" and projected_total >= 20
    crosses_red = current_level in ("green", "yellow") and projected_total >= 45

    if not (crosses_yellow or crosses_red):
        return None

    minutes_until = round(seconds_until / 60, 1)
    projected_level = "red" if projected_total >= 45 else "yellow"

    reason = (
        f"Approaching {peak_mrt:.0f}°C MRT {tier_label} in "
        f"~{minutes_until} min (seg {peak_seg.id}). "
        f"Projected risk: {projected_level} ({projected_total} pts). "
        f"Stop now — no water stops ahead in that zone."
    )

    logger.info(
        "lookahead.warning",
        current_level=current_level,
        projected_level=projected_level,
        peak_mrt_c=round(peak_mrt, 1),
        seconds_until=seconds_until,
        projected_points=projected_total,
        tier=tier_label,
    )

    return LookaheadWarning(
        projected_points=projected_total,
        reason=reason,
        seconds_until_hot_zone=seconds_until,
        peak_mrt_c=round(peak_mrt, 1),
    )
