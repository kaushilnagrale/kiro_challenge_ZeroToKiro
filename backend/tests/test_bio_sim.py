"""
Unit tests for bio_sim module — biosignal simulator.

Coverage:
1. test_start_session_creates_session — session_id in list_sessions()
2. test_start_session_returns_uuid — valid UUID4 format
3. test_get_current_raises_on_invalid_session — KeyError for unknown session
4. test_set_mode_raises_on_invalid_session — KeyError for unknown session
5. test_baseline_mode_values_in_range — HR, HRV, skin_temp within bounds
6. test_moderate_mode_values_in_range — after transition completes
7. test_dehydrating_mode_values_in_range — after transition completes
8. test_timestamps_monotonic — never goes backward
9. test_smooth_transition_no_sudden_jump — HR delta < 20 bpm on mode change
10. test_transition_completes_after_45s — values reach target after 45 samples
11. test_gaussian_noise_present — values vary between samples
12. test_physiological_bounds_enforced — never exceeds 50-200 HR, 10-100 HRV, 32-40 temp
"""

import uuid

from backend import bio_sim


def test_start_session_creates_session() -> None:
    """start_session() adds session to list_sessions()."""
    session_id = bio_sim.start_session(mode="baseline")
    assert session_id in bio_sim.list_sessions()


def test_start_session_returns_uuid() -> None:
    """start_session() returns valid UUID4 string."""
    session_id = bio_sim.start_session(mode="baseline")
    # Should not raise ValueError
    uuid.UUID(session_id, version=4)


def test_get_current_raises_on_invalid_session() -> None:
    """get_current() raises KeyError for unknown session."""
    try:
        bio_sim.get_current("nonexistent-session-id")
        assert False, "Expected KeyError"
    except KeyError as e:
        assert "not found" in str(e)


def test_set_mode_raises_on_invalid_session() -> None:
    """set_mode() raises KeyError for unknown session."""
    try:
        bio_sim.set_mode("nonexistent-session-id", "moderate")
        assert False, "Expected KeyError"
    except KeyError as e:
        assert "not found" in str(e)


def test_baseline_mode_values_in_range() -> None:
    """Baseline mode: HR ~65-75, HRV ~50-70, skin_temp ~33.0-33.6."""
    session_id = bio_sim.start_session(mode="baseline")
    
    # Sample multiple times to get steady-state
    for _ in range(10):
        bio = bio_sim.get_current(session_id)
    
    # Allow wider range for noise (σ=2 for HR, σ=3 for HRV, σ=0.1 for temp)
    assert 60.0 <= bio.hr <= 80.0, f"HR {bio.hr} out of baseline range"
    assert 45.0 <= bio.hrv_ms <= 75.0, f"HRV {bio.hrv_ms} out of baseline range"
    assert 32.8 <= bio.skin_temp_c <= 33.8, f"Skin temp {bio.skin_temp_c} out of baseline range"


def test_moderate_mode_values_in_range() -> None:
    """Moderate mode: HR ~130-150, HRV ~25-35, skin_temp ~36.5-37.0."""
    session_id = bio_sim.start_session(mode="moderate")
    
    # Sample 50 times to let transition complete
    for _ in range(50):
        bio = bio_sim.get_current(session_id)
    
    # Allow wider range for noise
    assert 125.0 <= bio.hr <= 155.0, f"HR {bio.hr} out of moderate range"
    assert 20.0 <= bio.hrv_ms <= 40.0, f"HRV {bio.hrv_ms} out of moderate range"
    assert 36.3 <= bio.skin_temp_c <= 37.2, f"Skin temp {bio.skin_temp_c} out of moderate range"


def test_dehydrating_mode_values_in_range() -> None:
    """Dehydrating mode: HR ~155-175, HRV ~15-25, skin_temp ~37.5-38.5."""
    session_id = bio_sim.start_session(mode="dehydrating")
    
    # Sample 50 times to let transition complete
    for _ in range(50):
        bio = bio_sim.get_current(session_id)
    
    # Allow wider range for noise
    assert 150.0 <= bio.hr <= 180.0, f"HR {bio.hr} out of dehydrating range"
    assert 12.0 <= bio.hrv_ms <= 28.0, f"HRV {bio.hrv_ms} out of dehydrating range"
    assert 37.3 <= bio.skin_temp_c <= 38.7, f"Skin temp {bio.skin_temp_c} out of dehydrating range"


def test_timestamps_monotonic() -> None:
    """Timestamps never go backward."""
    session_id = bio_sim.start_session(mode="baseline")
    
    bio1 = bio_sim.get_current(session_id)
    bio2 = bio_sim.get_current(session_id)
    bio3 = bio_sim.get_current(session_id)
    
    assert bio2.timestamp >= bio1.timestamp, "Timestamp went backward"
    assert bio3.timestamp >= bio2.timestamp, "Timestamp went backward"


def test_smooth_transition_no_sudden_jump() -> None:
    """Mode change triggers smooth transition, not sudden jump."""
    session_id = bio_sim.start_session(mode="baseline")
    
    bio1 = bio_sim.get_current(session_id)
    hr1 = bio1.hr
    
    # Switch to moderate
    bio_sim.set_mode(session_id, "moderate")
    bio2 = bio_sim.get_current(session_id)
    hr2 = bio2.hr
    
    # HR should not jump more than 20 bpm in one sample
    hr_delta = abs(hr2 - hr1)
    assert hr_delta < 20.0, f"HR jumped {hr_delta:.2f} bpm (expected smooth transition)"


def test_transition_completes_after_45s() -> None:
    """Transition completes after ~45 samples (45s)."""
    session_id = bio_sim.start_session(mode="baseline")
    
    # Get baseline HR
    bio1 = bio_sim.get_current(session_id)
    hr_baseline = bio1.hr
    
    # Switch to moderate (target ~140 bpm)
    bio_sim.set_mode(session_id, "moderate")
    
    # Sample 45 times (transition duration)
    for _ in range(45):
        bio = bio_sim.get_current(session_id)
    
    # HR should be close to moderate range now
    assert bio.hr > hr_baseline + 40, f"HR only increased by {bio.hr - hr_baseline:.2f} bpm after 45s"


def test_gaussian_noise_present() -> None:
    """Values vary between samples due to Gaussian noise."""
    session_id = bio_sim.start_session(mode="baseline")
    
    # Sample 10 times
    hrs = [bio_sim.get_current(session_id).hr for _ in range(10)]
    
    # Not all values should be identical (noise adds variation)
    unique_hrs = len(set(hrs))
    assert unique_hrs > 1, "No variation in HR values (noise not working)"


def test_physiological_bounds_enforced() -> None:
    """Values never exceed physiological bounds."""
    session_id = bio_sim.start_session(mode="dehydrating")
    
    # Sample 100 times to stress-test bounds
    for _ in range(100):
        bio = bio_sim.get_current(session_id)
        
        # Physiological bounds
        assert 50.0 <= bio.hr <= 200.0, f"HR {bio.hr} exceeds physiological bounds"
        assert 10.0 <= bio.hrv_ms <= 100.0, f"HRV {bio.hrv_ms} exceeds physiological bounds"
        assert 32.0 <= bio.skin_temp_c <= 40.0, f"Skin temp {bio.skin_temp_c} exceeds physiological bounds"


def test_set_mode_same_mode_is_noop() -> None:
    """set_mode() to same mode doesn't trigger transition."""
    session_id = bio_sim.start_session(mode="baseline")
    
    # Get initial HR
    bio1 = bio_sim.get_current(session_id)
    hr1 = bio1.hr
    
    # Set to same mode
    bio_sim.set_mode(session_id, "baseline")
    bio2 = bio_sim.get_current(session_id)
    hr2 = bio2.hr
    
    # HR should be similar (only noise difference)
    hr_delta = abs(hr2 - hr1)
    assert hr_delta < 5.0, f"HR changed by {hr_delta:.2f} bpm when setting same mode"
