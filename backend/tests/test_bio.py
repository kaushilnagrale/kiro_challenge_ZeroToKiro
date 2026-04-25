"""
Tests for BioService and /bio endpoints.

Coverage:
1. test_default_mode_is_baseline        — new session HR in baseline range
2. test_set_mode_dehydrating            — HR in dehydrating range after set_mode
3. test_set_mode_moderate               — HR in moderate range after set_mode
4. test_value_ranges_baseline           — HRV, skin_temp in baseline range
5. test_value_ranges_dehydrating        — HRV, skin_temp in dehydrating range
6. test_timestamps_monotonic            — two consecutive calls non-decreasing
7. test_smooth_transitions              — mode change triggers smooth transition
8. test_bio_mode_endpoint               — POST /bio/mode returns 200 with provenance
9. test_bio_current_endpoint            — GET /bio/current returns 200

Note: bio_sim uses realistic ranges with Gaussian noise, so we allow wider bounds
to account for noise (σ=2 for HR, σ=3 for HRV, σ=0.1 for skin_temp).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.bio import router
from backend.services.bio_service import BioService

# ─────────── TestClient setup ───────────

test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app)


# ─────────── Service-level tests ───────────

def test_default_mode_is_baseline() -> None:
    """New session defaults to baseline — HR must be in baseline range."""
    svc = BioService()
    bio = svc.get_current("sess-baseline-default")
    # Baseline range: 65-75 bpm + noise (σ=2), allow 60-80 for safety
    assert 60.0 <= bio.hr <= 80.0, f"Expected HR ~65-75, got {bio.hr}"


def test_set_mode_dehydrating() -> None:
    """After set_mode dehydrating, values eventually reach dehydrating range."""
    svc = BioService()
    svc.set_mode("sess-dehydrating", "dehydrating")
    
    # Sample multiple times to let transition complete
    for _ in range(50):
        bio = svc.get_current("sess-dehydrating")
    
    # Dehydrating range: 155-175 bpm + noise, allow 150-180
    assert 150.0 <= bio.hr <= 180.0, f"Expected HR ~155-175, got {bio.hr}"


def test_set_mode_moderate() -> None:
    """After set_mode moderate, values eventually reach moderate range."""
    svc = BioService()
    svc.set_mode("sess-moderate", "moderate")
    
    # Sample multiple times to let transition complete
    for _ in range(50):
        bio = svc.get_current("sess-moderate")
    
    # Moderate range: 130-150 bpm + noise, allow 125-155
    assert 125.0 <= bio.hr <= 155.0, f"Expected HR ~130-150, got {bio.hr}"


def test_value_ranges_baseline() -> None:
    """Baseline mode: HRV ~50-70, skin_temp ~33.0-33.6."""
    svc = BioService()
    bio = svc.get_current("sess-ranges-baseline")
    # HRV: 50-70 ms + noise (σ=3), allow 45-75
    assert 45.0 <= bio.hrv_ms <= 75.0, f"Expected HRV ~50-70, got {bio.hrv_ms}"
    # Skin temp: 33.0-33.6°C + noise (σ=0.1), allow 32.8-33.8
    assert 32.8 <= bio.skin_temp_c <= 33.8, f"Expected skin_temp ~33.0-33.6, got {bio.skin_temp_c}"


def test_value_ranges_dehydrating() -> None:
    """Dehydrating mode: HRV ~15-25, skin_temp ~37.5-38.5."""
    svc = BioService()
    svc.set_mode("sess-ranges-dehydrating", "dehydrating")
    
    # Sample multiple times to let transition complete
    for _ in range(50):
        bio = svc.get_current("sess-ranges-dehydrating")
    
    # HRV: 15-25 ms + noise (σ=3), allow 12-28
    assert 12.0 <= bio.hrv_ms <= 28.0, f"Expected HRV ~15-25, got {bio.hrv_ms}"
    # Skin temp: 37.5-38.5°C + noise (σ=0.1), allow 37.3-38.7
    assert 37.3 <= bio.skin_temp_c <= 38.7, f"Expected skin_temp ~37.5-38.5, got {bio.skin_temp_c}"


def test_timestamps_monotonic() -> None:
    """Two consecutive get_current calls return non-decreasing timestamps."""
    svc = BioService()
    bio1 = svc.get_current("sess-monotonic")
    bio2 = svc.get_current("sess-monotonic")
    assert bio2.timestamp >= bio1.timestamp, (
        f"Timestamps not monotonic: {bio1.timestamp} -> {bio2.timestamp}"
    )


def test_smooth_transitions() -> None:
    """Mode change triggers smooth transition, not sudden jump."""
    svc = BioService()
    
    # Start in baseline
    bio1 = svc.get_current("sess-smooth")
    hr1 = bio1.hr
    
    # Switch to moderate
    svc.set_mode("sess-smooth", "moderate")
    bio2 = svc.get_current("sess-smooth")
    hr2 = bio2.hr
    
    # HR should not jump more than 20 bpm in one sample (smooth transition)
    hr_delta = abs(hr2 - hr1)
    assert hr_delta < 20.0, f"HR jumped {hr_delta:.2f} bpm (expected smooth transition)"


# ─────────── Endpoint tests ───────────

def test_bio_mode_endpoint() -> None:
    """POST /bio/mode returns 200 with session_id, mode, and provenance."""
    response = client.post(
        "/bio/mode",
        json={"session_id": "ep-sess-001", "mode": "moderate"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "ep-sess-001"
    assert data["mode"] == "moderate"
    assert "provenance" in data
    assert data["provenance"]["bio_source"]["source_id"] == "sim_moderate"
    assert data["provenance"]["bio_source"]["age_seconds"] == 0


def test_bio_current_endpoint() -> None:
    """GET /bio/current returns 200 with a valid Biosignal."""
    response = client.get("/bio/current", params={"session_id": "ep-sess-002"})
    assert response.status_code == 200
    data = response.json()
    assert "hr" in data
    assert "hrv_ms" in data
    assert "skin_temp_c" in data
    assert "timestamp" in data
    assert "source" in data
    # Default mode is baseline (allow wider range for noise)
    assert 60.0 <= data["hr"] <= 80.0
