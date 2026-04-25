"""
Tests for SafetyGate — Accountability Logic Gate.

Owner: Track B (Sai)
Status: Production — non-negotiable demo centerpiece

Coverage: 6 test cases for 100% branch coverage of validate_safety_alert():
1. test_gate_pass           — all provenance fields valid → returns SafetyAlert
2. test_gate_no_bio         — bio_source=None → returns None
3. test_gate_old_bio        — bio_source.age_seconds=61 → returns None
4. test_gate_no_env         — env_source=None → returns None
5. test_gate_old_env        — env_source.age_seconds=1801 → returns None
6. test_gate_no_segment     — route_segment_id=None → returns None
"""

from datetime import datetime, timezone

import pytest

from backend.safety import validate_safety_alert
from shared.schema import (
    Provenance,
    RiskScore,
    SafetyAlert,
    SourceRef,
    Stop,
)


# ─────────── Fixtures ───────────

@pytest.fixture
def valid_provenance() -> Provenance:
    """Provenance that passes all gate rules."""
    now = datetime.now(timezone.utc)
    return Provenance(
        bio_source=SourceRef(
            source_id="sim_baseline",
            timestamp=now,
            age_seconds=5,  # < 60
        ),
        env_source=SourceRef(
            source_id="open-meteo",
            timestamp=now,
            age_seconds=30,  # < 1800
        ),
        route_segment_id="seg-fastest-001",
    )


@pytest.fixture
def sample_risk_score(valid_provenance: Provenance) -> RiskScore:
    """Sample RiskScore for building SafetyAlert."""
    return RiskScore(
        level="yellow",
        points=25,
        top_reason="Heart rate elevated",
        all_reasons=["Heart rate elevated"],
        provenance=valid_provenance,
    )


@pytest.fixture
def sample_stop() -> Stop:
    """Sample stop for SafetyAlert."""
    return Stop(
        id="official-001",
        name="Tempe Beach Park Fountain",
        lat=33.4285,
        lng=-111.9498,
        amenities=["water", "shade"],
        open_now=True,
        source="official",
        source_ref="stops_seed_v1",
    )


# ─────────── Tests ───────────


def test_gate_pass(
    valid_provenance: Provenance,
    sample_risk_score: RiskScore,
    sample_stop: Stop,
) -> None:
    """All provenance fields valid → gate returns SafetyAlert."""
    alert = SafetyAlert(
        risk=sample_risk_score,
        suggested_stop=sample_stop,
        message="Consider stopping for water",
        provenance=valid_provenance,
    )

    result = validate_safety_alert(alert)

    assert result is not None, "Gate should pass with valid provenance"
    assert result == alert, "Gate should return the same alert object"


def test_gate_no_bio(
    valid_provenance: Provenance,
    sample_risk_score: RiskScore,
    sample_stop: Stop,
) -> None:
    """bio_source=None → gate returns None."""
    # Mutate provenance to remove bio_source
    bad_provenance = Provenance(
        bio_source=None,  # Missing
        env_source=valid_provenance.env_source,
        route_segment_id=valid_provenance.route_segment_id,
    )

    alert = SafetyAlert(
        risk=sample_risk_score,
        suggested_stop=sample_stop,
        message="Consider stopping for water",
        provenance=bad_provenance,
    )

    result = validate_safety_alert(alert)

    assert result is None, "Gate should fail when bio_source is None"


def test_gate_old_bio(
    valid_provenance: Provenance,
    sample_risk_score: RiskScore,
    sample_stop: Stop,
) -> None:
    """bio_source.age_seconds=61 → gate returns None."""
    now = datetime.now(timezone.utc)
    bad_provenance = Provenance(
        bio_source=SourceRef(
            source_id="sim_baseline",
            timestamp=now,
            age_seconds=61,  # >= 60, too old
        ),
        env_source=valid_provenance.env_source,
        route_segment_id=valid_provenance.route_segment_id,
    )

    alert = SafetyAlert(
        risk=sample_risk_score,
        suggested_stop=sample_stop,
        message="Consider stopping for water",
        provenance=bad_provenance,
    )

    result = validate_safety_alert(alert)

    assert result is None, "Gate should fail when bio_source.age_seconds >= 60"


def test_gate_no_env(
    valid_provenance: Provenance,
    sample_risk_score: RiskScore,
    sample_stop: Stop,
) -> None:
    """env_source=None → gate returns None."""
    bad_provenance = Provenance(
        bio_source=valid_provenance.bio_source,
        env_source=None,  # Missing
        route_segment_id=valid_provenance.route_segment_id,
    )

    alert = SafetyAlert(
        risk=sample_risk_score,
        suggested_stop=sample_stop,
        message="Consider stopping for water",
        provenance=bad_provenance,
    )

    result = validate_safety_alert(alert)

    assert result is None, "Gate should fail when env_source is None"


def test_gate_old_env(
    valid_provenance: Provenance,
    sample_risk_score: RiskScore,
    sample_stop: Stop,
) -> None:
    """env_source.age_seconds=1801 → gate returns None."""
    now = datetime.now(timezone.utc)
    bad_provenance = Provenance(
        bio_source=valid_provenance.bio_source,
        env_source=SourceRef(
            source_id="open-meteo",
            timestamp=now,
            age_seconds=1801,  # >= 1800, too old
        ),
        route_segment_id=valid_provenance.route_segment_id,
    )

    alert = SafetyAlert(
        risk=sample_risk_score,
        suggested_stop=sample_stop,
        message="Consider stopping for water",
        provenance=bad_provenance,
    )

    result = validate_safety_alert(alert)

    assert result is None, "Gate should fail when env_source.age_seconds >= 1800"


def test_gate_no_segment(
    valid_provenance: Provenance,
    sample_risk_score: RiskScore,
    sample_stop: Stop,
) -> None:
    """route_segment_id=None → gate returns None."""
    bad_provenance = Provenance(
        bio_source=valid_provenance.bio_source,
        env_source=valid_provenance.env_source,
        route_segment_id=None,  # Missing
    )

    alert = SafetyAlert(
        risk=sample_risk_score,
        suggested_stop=sample_stop,
        message="Consider stopping for water",
        provenance=bad_provenance,
    )

    result = validate_safety_alert(alert)

    assert result is None, "Gate should fail when route_segment_id is None"
