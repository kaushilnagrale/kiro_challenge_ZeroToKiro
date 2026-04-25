"""
100% branch coverage for the Accountability Logic Gate.

Tests every branch that returns None and the one happy-path that returns
the alert. This is the code we show in the pitch.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from backend.models import ProvenanceObj, SafetyAlert
from backend.safety import (
    BIOSIGNAL_MAX_AGE_S,
    ENVIRONMENTAL_MAX_AGE_S,
    validate_safety_alert,
)


def _make_alert(**provenance_overrides) -> SafetyAlert:
    now = datetime.now(timezone.utc)
    base = ProvenanceObj(
        biosignal_source_id="bio_sim_v1",
        biosignal_timestamp=now,
        environmental_source_id="open-meteo",
        environmental_timestamp=now,
        route_segment_id="seg_abc123",
    )
    for k, v in provenance_overrides.items():
        setattr(base, k, v)
    return SafetyAlert(
        message="Water fountain ahead in 280m, on your right.",
        score="yellow",
        provenance=base,
    )


# ── Branch 1: biosignal_source_id is None ────────────────────────────────────

def test_gate_rejects_missing_biosignal_source():
    alert = _make_alert(biosignal_source_id=None)
    assert validate_safety_alert(alert) is None


# ── Branch 2: biosignal_timestamp is None ────────────────────────────────────

def test_gate_rejects_missing_biosignal_timestamp():
    alert = _make_alert(biosignal_timestamp=None)
    assert validate_safety_alert(alert) is None


# ── Branch 3: biosignal too old ───────────────────────────────────────────────

def test_gate_rejects_stale_biosignal():
    stale = datetime.now(timezone.utc) - timedelta(seconds=BIOSIGNAL_MAX_AGE_S + 1)
    alert = _make_alert(biosignal_timestamp=stale)
    assert validate_safety_alert(alert) is None


# ── Branch 4: environmental_source_id is None ────────────────────────────────

def test_gate_rejects_missing_env_source():
    alert = _make_alert(environmental_source_id=None)
    assert validate_safety_alert(alert) is None


# ── Branch 5: environmental_timestamp is None ────────────────────────────────

def test_gate_rejects_missing_env_timestamp():
    alert = _make_alert(environmental_timestamp=None)
    assert validate_safety_alert(alert) is None


# ── Branch 6: environmental data too old ─────────────────────────────────────

def test_gate_rejects_stale_environmental_data():
    stale = datetime.now(timezone.utc) - timedelta(seconds=ENVIRONMENTAL_MAX_AGE_S + 1)
    alert = _make_alert(environmental_timestamp=stale)
    assert validate_safety_alert(alert) is None


# ── Branch 7: route_segment_id is None ───────────────────────────────────────

def test_gate_rejects_missing_route_segment():
    alert = _make_alert(route_segment_id=None)
    assert validate_safety_alert(alert) is None


# ── Branch 8: all fields valid — gate passes ─────────────────────────────────

def test_gate_passes_valid_alert():
    alert = _make_alert()
    result = validate_safety_alert(alert)
    assert result is not None
    assert result.message == alert.message
    assert result.score == alert.score


# ── Edge: exactly at biosignal age limit ─────────────────────────────────────

def test_gate_passes_biosignal_just_within_limit():
    fresh = datetime.now(timezone.utc) - timedelta(seconds=BIOSIGNAL_MAX_AGE_S - 1)
    alert = _make_alert(biosignal_timestamp=fresh)
    assert validate_safety_alert(alert) is not None


# ── Edge: exactly at environmental age limit ──────────────────────────────────

def test_gate_passes_env_just_within_limit():
    fresh = datetime.now(timezone.utc) - timedelta(seconds=ENVIRONMENTAL_MAX_AGE_S - 1)
    alert = _make_alert(environmental_timestamp=fresh)
    assert validate_safety_alert(alert) is not None


# ── Verify the gate returns the exact same object (no copy) ──────────────────

def test_gate_returns_same_object():
    alert = _make_alert()
    result = validate_safety_alert(alert)
    assert result is alert
