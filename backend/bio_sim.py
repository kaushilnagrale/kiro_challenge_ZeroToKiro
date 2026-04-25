"""
Biosignal Simulator — realistic time-series generator for PulseRoute.

Generates physiologically accurate HR, HRV, and skin temperature signals
with smooth transitions between modes (baseline/moderate/dehydrating).

Key features:
- Smooth mode transitions using sigmoid interpolation (30-60s)
- Gaussian noise for realistic variation
- Monotonic timestamps (never goes backward)
- Session-based state management (in-memory)

Usage:
    >>> session_id = start_session(mode="baseline")
    >>> bio = get_current(session_id)
    >>> set_mode(session_id, "moderate")  # Triggers smooth transition
    >>> bio = get_current(session_id)  # Returns transitioning values
"""

import math
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import structlog

from shared.schema import BioMode, Biosignal, BioSource

logger = structlog.get_logger()

# ─────────── Mode Ranges (Physiological) ───────────

MODE_RANGES = {
    "baseline": {
        "hr": (65.0, 75.0),           # Resting heart rate
        "hrv": (50.0, 70.0),          # Healthy parasympathetic tone
        "skin_temp": (33.0, 33.6),    # Normal skin temperature
        "source": "sim_baseline",
    },
    "moderate": {
        "hr": (130.0, 150.0),         # Vigorous exercise
        "hrv": (25.0, 35.0),          # Sympathetic activation
        "skin_temp": (36.5, 37.0),    # Thermoregulation active
        "source": "sim_moderate",
    },
    "dehydrating": {
        "hr": (155.0, 175.0),         # Max effort / stress
        "hrv": (15.0, 25.0),          # High stress response
        "skin_temp": (37.5, 38.5),    # Impaired cooling
        "source": "sim_dehydrating",
    },
}

# ─────────── Noise Parameters ───────────

NOISE_PARAMS = {
    "hr_sigma": 2.0,        # bpm (beat-to-beat variation)
    "hrv_sigma": 3.0,       # ms (natural variability)
    "skin_temp_sigma": 0.1, # °C (sensor noise)
}

# ─────────── Transition Parameters ───────────

TRANSITION_DURATION = 45.0  # seconds (smooth mode changes)
SAMPLE_INTERVAL = 1.0       # seconds (time advance per get_current call)

# ─────────── Physiological Bounds ───────────

BOUNDS = {
    "hr": (50.0, 200.0),
    "hrv": (10.0, 100.0),
    "skin_temp": (32.0, 40.0),
}


# ─────────── Session State ───────────

@dataclass
class SessionState:
    """Internal state for a biosignal session."""
    mode: BioMode
    last_timestamp: datetime
    current_hr: float
    current_hrv: float
    current_skin_temp: float
    target_hr: float
    target_hrv: float
    target_skin_temp: float
    transition_start: datetime | None
    transition_duration: float


# Module-level session storage
_sessions: dict[str, SessionState] = {}


# ─────────── Public API ───────────

def start_session(mode: BioMode = "baseline") -> str:
    """
    Create a new biosignal session.
    
    Args:
        mode: Initial simulation mode (baseline/moderate/dehydrating)
    
    Returns:
        session_id: UUID4 string
    """
    session_id = str(uuid.uuid4())
    
    # Initialize with mode's midpoint values
    ranges = MODE_RANGES[mode]
    hr_mid = (ranges["hr"][0] + ranges["hr"][1]) / 2
    hrv_mid = (ranges["hrv"][0] + ranges["hrv"][1]) / 2
    temp_mid = (ranges["skin_temp"][0] + ranges["skin_temp"][1]) / 2
    
    state = SessionState(
        mode=mode,
        last_timestamp=datetime.now(timezone.utc),
        current_hr=hr_mid,
        current_hrv=hrv_mid,
        current_skin_temp=temp_mid,
        target_hr=hr_mid,
        target_hrv=hrv_mid,
        target_skin_temp=temp_mid,
        transition_start=None,
        transition_duration=TRANSITION_DURATION,
    )
    
    _sessions[session_id] = state
    
    logger.info(
        "bio_sim.start_session",
        session_id=session_id,
        mode=mode,
        hr=round(hr_mid, 2),
        hrv=round(hrv_mid, 2),
        skin_temp=round(temp_mid, 2),
    )
    
    return session_id


def get_current(session_id: str) -> Biosignal:
    """
    Generate next biosignal sample for session.
    
    Advances time by ~1s, applies smooth transitions if mode changed,
    adds Gaussian noise, enforces monotonic timestamps.
    
    Args:
        session_id: Session identifier from start_session()
    
    Returns:
        Biosignal with hr, hrv_ms, skin_temp_c, timestamp, source
    
    Raises:
        KeyError: If session_id not found
    """
    if session_id not in _sessions:
        raise KeyError(f"Session {session_id} not found")
    
    state = _sessions[session_id]
    
    # Advance time monotonically
    now = state.last_timestamp + timedelta(seconds=SAMPLE_INTERVAL)
    state.last_timestamp = now
    
    # Generate sample (with transitions if active)
    hr, hrv, skin_temp = _generate_sample(state)
    
    # Update current values
    state.current_hr = hr
    state.current_hrv = hrv
    state.current_skin_temp = skin_temp
    
    # Get source from current mode
    source = MODE_RANGES[state.mode]["source"]
    
    logger.debug(
        "bio_sim.get_current",
        session_id=session_id,
        mode=state.mode,
        hr=round(hr, 2),
        hrv=round(hrv, 2),
        skin_temp=round(skin_temp, 2),
        in_transition=state.transition_start is not None,
    )
    
    return Biosignal(
        hr=hr,
        hrv_ms=hrv,
        skin_temp_c=skin_temp,
        timestamp=now,
        source=source,  # type: ignore[arg-type]
    )


def set_mode(session_id: str, mode: BioMode) -> None:
    """
    Change simulation mode for session.
    
    Triggers smooth transition over 30-60s to new mode's target ranges.
    
    Args:
        session_id: Session identifier
        mode: New mode (baseline/moderate/dehydrating)
    
    Raises:
        KeyError: If session_id not found
    """
    if session_id not in _sessions:
        raise KeyError(f"Session {session_id} not found")
    
    state = _sessions[session_id]
    
    if state.mode == mode:
        logger.debug("bio_sim.set_mode", session_id=session_id, mode=mode, msg="Already in mode")
        return
    
    # Set new targets from mode's midpoint
    ranges = MODE_RANGES[mode]
    state.target_hr = (ranges["hr"][0] + ranges["hr"][1]) / 2
    state.target_hrv = (ranges["hrv"][0] + ranges["hrv"][1]) / 2
    state.target_skin_temp = (ranges["skin_temp"][0] + ranges["skin_temp"][1]) / 2
    
    # Start transition
    state.mode = mode
    state.transition_start = state.last_timestamp
    
    logger.info(
        "bio_sim.set_mode",
        session_id=session_id,
        mode=mode,
        target_hr=round(state.target_hr, 2),
        target_hrv=round(state.target_hrv, 2),
        target_skin_temp=round(state.target_skin_temp, 2),
    )


def list_sessions() -> list[str]:
    """Return all active session IDs."""
    return list(_sessions.keys())


# ─────────── Internal Helpers ───────────

def _generate_sample(state: SessionState) -> tuple[float, float, float]:
    """
    Generate next HR, HRV, skin_temp sample.
    
    1. Check if in transition (mode recently changed)
    2. If transitioning:
       - Calculate progress (0.0 to 1.0)
       - Apply sigmoid interpolation: current + (target - current) * sigmoid(progress)
    3. If steady-state:
       - Sample from mode's range with Gaussian noise
    4. Enforce physiological bounds
    5. Return (hr, hrv, skin_temp)
    """
    # Check if in transition
    if state.transition_start is not None:
        elapsed = (state.last_timestamp - state.transition_start).total_seconds()
        progress = elapsed / state.transition_duration
        
        if progress >= 1.0:
            # Transition complete
            state.transition_start = None
            hr = state.target_hr
            hrv = state.target_hrv
            skin_temp = state.target_skin_temp
        else:
            # Apply sigmoid interpolation
            sigmoid_progress = _sigmoid(progress)
            hr = state.current_hr + (state.target_hr - state.current_hr) * sigmoid_progress
            hrv = state.current_hrv + (state.target_hrv - state.current_hrv) * sigmoid_progress
            skin_temp = state.current_skin_temp + (state.target_skin_temp - state.current_skin_temp) * sigmoid_progress
    else:
        # Steady-state: sample from mode's range
        ranges = MODE_RANGES[state.mode]
        hr_min, hr_max = ranges["hr"]
        hrv_min, hrv_max = ranges["hrv"]
        temp_min, temp_max = ranges["skin_temp"]
        
        # Use current values as base, add small random walk
        hr = state.current_hr + random.uniform(-1.0, 1.0)
        hrv = state.current_hrv + random.uniform(-0.5, 0.5)
        skin_temp = state.current_skin_temp + random.uniform(-0.05, 0.05)
        
        # Clamp to mode range
        hr = max(hr_min, min(hr_max, hr))
        hrv = max(hrv_min, min(hrv_max, hrv))
        skin_temp = max(temp_min, min(temp_max, skin_temp))
    
    # Add Gaussian noise
    hr += random.gauss(0, NOISE_PARAMS["hr_sigma"])
    hrv += random.gauss(0, NOISE_PARAMS["hrv_sigma"])
    skin_temp += random.gauss(0, NOISE_PARAMS["skin_temp_sigma"])
    
    # Enforce physiological bounds
    hr = max(BOUNDS["hr"][0], min(BOUNDS["hr"][1], hr))
    hrv = max(BOUNDS["hrv"][0], min(BOUNDS["hrv"][1], hrv))
    skin_temp = max(BOUNDS["skin_temp"][0], min(BOUNDS["skin_temp"][1], skin_temp))
    
    return hr, hrv, skin_temp


def _sigmoid(x: float) -> float:
    """
    Sigmoid function for smooth transitions.
    
    Maps [0, 1] → [0, 1] with smooth S-curve.
    Steeper than linear, smoother than step.
    """
    # Scale to [-6, 6] for nice sigmoid shape
    scaled = (x - 0.5) * 12
    return 1.0 / (1.0 + math.exp(-scaled))
