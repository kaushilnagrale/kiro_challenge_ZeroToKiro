"""
StopRecommender — decides which stop to suggest and why.

This is the "brain" for stop selection. It replaces the naive nearest-stop
approach with a ranked decision that considers:

  - Risk level: red → cooling centers / AC first; yellow → preference-matched
  - Amenity preferences: match rider's stated prefs (water, food, shade, ac)
  - Distance: closer is better, but a matching stop 400m away beats a
    non-matching stop 50m away
  - Open status: prefer open stops; never exclude all stops just because
    open_now is unknown
  - Tier: official sources (drinking_water, official) ranked above commercial

Scoring formula (yellow path):
    score = distance_m / amenity_match_bonus / open_bonus
    amenity_match_bonus = 1 + 0.5 * (number of rider prefs matched)
    open_bonus = 1.3 if open_now is True, 1.0 otherwise

Lower score = better stop.

Returns (stop, reason_string) so the caller can surface a human-readable
explanation in the UI: "Suggesting Cartel Coffee (cafe + AC, 280m) because
you're at yellow and it matches your water+food preference."
"""

import math
from typing import Optional

import structlog

from shared.schema import Amenity, RiskLevel, RiskScore, Stop

logger = structlog.get_logger()

# Amenity labels for human-readable reasons
_AMENITY_LABELS: dict[str, str] = {
    "water": "water",
    "food": "food",
    "shade": "shade",
    "restroom": "restroom",
    "ac": "AC",
    "bike_repair": "bike repair",
}

# Official source identifiers — ranked above commercial in red mode
_OFFICIAL_SOURCES = {"official", "public"}


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def _nearest(stops: list[Stop], location: tuple[float, float]) -> Optional[Stop]:
    if not stops:
        return None
    lat, lng = location
    return min(stops, key=lambda s: _haversine_m(lat, lng, s.lat, s.lng))


def _distance_m(stop: Stop, location: tuple[float, float]) -> float:
    return _haversine_m(location[0], location[1], stop.lat, stop.lng)


def _amenity_label(amenities: list[Amenity]) -> str:
    """Short human-readable amenity string, e.g. 'water + AC'."""
    labels = [_AMENITY_LABELS.get(a, a) for a in amenities[:3]]
    return " + ".join(labels)


def recommend_stop(
    risk: RiskScore,
    location: tuple[float, float],
    candidate_stops: list[Stop],
    rider_prefs: list[Amenity],
) -> tuple[Optional[Stop], Optional[str]]:
    """
    Pick the right stop for the right moment.

    Returns (stop, reason) where reason is a human-readable string
    suitable for display in the UI, or (None, None) if no stop is needed.

    Args:
        risk:            Current RiskScore from HydrationService.
        location:        (lat, lng) of the rider's current position.
        candidate_stops: All stops within the search radius.
        rider_prefs:     Rider's amenity preferences (e.g. ["water", "food"]).

    Returns:
        (Stop | None, reason_str | None)
    """
    if not candidate_stops:
        logger.info("stop_recommender.no_candidates", level=risk.level)
        return None, None

    if risk.level == "green":
        # No stop needed — rider is fine
        return None, None

    lat, lng = location

    if risk.level == "red":
        # Critical — prioritise official cooling centers with AC.
        # Ignore rider preferences; safety overrides comfort.
        critical = [
            s for s in candidate_stops
            if "ac" in s.amenities or s.source in _OFFICIAL_SOURCES
        ]
        chosen = _nearest(critical, location) if critical else _nearest(candidate_stops, location)
        if chosen is None:
            return None, None

        dist = int(_distance_m(chosen, location))
        amenity_str = _amenity_label(chosen.amenities)
        tier = "cooling center" if chosen.source in _OFFICIAL_SOURCES else "stop"
        reason = (
            f"Suggesting {chosen.name} ({amenity_str}, {dist}m) — "
            f"critical risk: routing to nearest {tier} with cooling."
        )
        logger.info(
            "stop_recommender.red",
            stop_id=chosen.id,
            stop_name=chosen.name,
            dist_m=dist,
        )
        return chosen, reason

    # ── Yellow path: preference-matched, distance-weighted ranking ────────────
    prefs_set = set(rider_prefs) if rider_prefs else {"water"}

    # Filter: must match at least one pref OR be open (don't exclude everything)
    matching = [
        s for s in candidate_stops
        if any(a in s.amenities for a in prefs_set) and s.open_now is not False
    ]
    pool = matching if matching else candidate_stops

    def _score(s: Stop) -> float:
        dist = _distance_m(s, location)
        matched_prefs = len(prefs_set & set(s.amenities))
        amenity_bonus = 1.0 + 0.5 * matched_prefs   # more matches = lower score
        open_bonus = 1.3 if s.open_now is True else 1.0
        return dist / amenity_bonus / open_bonus

    scored = sorted(pool, key=_score)
    chosen = scored[0]

    dist = int(_distance_m(chosen, location))
    amenity_str = _amenity_label(chosen.amenities)
    matched = [_AMENITY_LABELS.get(a, a) for a in rider_prefs if a in chosen.amenities]
    pref_str = " + ".join(matched) if matched else "nearby"
    open_str = " · open now" if chosen.open_now is True else ""

    reason = (
        f"Suggesting {chosen.name} ({amenity_str}, {dist}m{open_str}) "
        f"because you're at yellow and it matches your {pref_str} preference."
    )

    logger.info(
        "stop_recommender.yellow",
        stop_id=chosen.id,
        stop_name=chosen.name,
        dist_m=dist,
        matched_prefs=matched,
        score=round(_score(chosen), 1),
    )
    return chosen, reason
