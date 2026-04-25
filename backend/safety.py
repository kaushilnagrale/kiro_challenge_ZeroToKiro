"""
Accountability Logic Gate — the Guardrail baked into the architecture.

Every safety alert rendered to the rider MUST pass this gate.
If any provenance field is missing or stale, the gate returns None
and the UI shows SENSOR_UNAVAILABLE_MSG instead of a fabricated alert.

Show this function in the pitch — it is the single most defensible
"we built the Guardrail into the architecture" moment.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from .models import SafetyAlert

BIOSIGNAL_MAX_AGE_S: int = 60        # biosignals must be < 60 s old
ENVIRONMENTAL_MAX_AGE_S: int = 1800  # env data must be < 30 min old

SENSOR_UNAVAILABLE_MSG = (
    "Sensor data unavailable — using conservative defaults."
)


def validate_safety_alert(alert: SafetyAlert) -> Optional[SafetyAlert]:
    """
    Returns the alert unchanged if all provenance fields are present and fresh.
    Returns None if any required field is missing or stale.

    Branch coverage targets (100% required by spec):
      1. biosignal_source_id is None       → None
      2. biosignal_timestamp is None       → None
      3. biosignal too old                 → None
      4. environmental_source_id is None   → None
      5. environmental_timestamp is None   → None
      6. environmental too old             → None
      7. route_segment_id is None          → None
      8. all fields valid                  → alert
    """
    p = alert.provenance
    now = datetime.now(timezone.utc)

    if p.biosignal_source_id is None:
        return None

    if p.biosignal_timestamp is None:
        return None

    bio_age = (now - p.biosignal_timestamp).total_seconds()
    if bio_age > BIOSIGNAL_MAX_AGE_S:
        return None

    if p.environmental_source_id is None:
        return None

    if p.environmental_timestamp is None:
        return None

    env_age = (now - p.environmental_timestamp).total_seconds()
    if env_age > ENVIRONMENTAL_MAX_AGE_S:
        return None

    if p.route_segment_id is None:
        return None

    return alert
