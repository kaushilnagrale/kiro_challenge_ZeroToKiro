"""
Biosignal simulator — emits realistic HR / HRV / skin-temp time series.

Three modes:
  baseline      — resting cyclist, low exertion
  moderate      — active commute, rising HR
  dehydrating   — heat-stress developing, HRV collapsing

Used for the hackathon demo. Phase 2 replaces the data source with
HealthKit via an EAS dev build; the classifier and Logic Gate are
source-agnostic.
"""
from __future__ import annotations

import math
import random
import uuid
from datetime import datetime, timezone
from typing import Dict

from .models import BioReading

_Mode = str  # "baseline" | "moderate" | "dehydrating"


class BiosignalSimulator:
    def __init__(self) -> None:
        self._sessions: Dict[str, dict] = {}

    def start_session(self, mode: _Mode = "baseline") -> str:
        if mode not in ("baseline", "moderate", "dehydrating"):
            mode = "baseline"
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = {
            "mode": mode,
            "start": datetime.now(timezone.utc),
        }
        return session_id

    def get_current(self, session_id: str) -> BioReading:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(f"Unknown bio session: {session_id}")
        now = datetime.now(timezone.utc)
        elapsed_s = (now - session["start"]).total_seconds()
        hr, hrv, skin_temp = _compute_signals(session["mode"], elapsed_s)
        return BioReading(
            session_id=session_id,
            hr=round(hr, 1),
            hrv=round(hrv, 1),
            skin_temp_c=round(skin_temp, 2),
            timestamp=now,
            mode=session["mode"],
        )

    def active_sessions(self) -> list:
        return list(self._sessions.keys())


def _compute_signals(mode: _Mode, elapsed_s: float) -> tuple[float, float, float]:
    t = elapsed_s / 60.0  # convert to minutes

    def noise(sigma: float) -> float:
        return random.gauss(0.0, sigma)

    if mode == "baseline":
        hr   = 65.0 + 5.0 * math.sin(t / 10.0) + noise(1.5)
        hrv  = 50.0 - 3.0 * math.sin(t / 8.0)  + noise(2.0)
        skin = 33.0 + 0.2 * math.sin(t / 15.0) + noise(0.10)

    elif mode == "moderate":
        ramp = min(t / 5.0, 1.0)
        hr   = 65.0 + 30.0 * ramp + 8.0 * math.sin(t / 3.0) + noise(2.0)
        hrv  = 50.0 - 20.0 * ramp - 5.0 * math.sin(t / 4.0) + noise(3.0)
        skin = 33.0 + 2.5  * ramp + 0.3 * math.sin(t / 6.0) + noise(0.15)

    else:  # dehydrating
        ramp  = min(t / 8.0,  1.0)
        dehyd = min(t / 20.0, 1.0)
        hr    = 65.0 + 25.0 * ramp + 15.0 * dehyd + 5.0 * math.sin(t / 2.0) + noise(2.5)
        hrv   = 50.0 - 15.0 * ramp - 25.0 * dehyd + noise(3.0)
        skin  = 33.0 + 2.0  * ramp +  3.5 * dehyd + noise(0.20)

    # Clamp to physiological range
    hr   = max(40.0, min(200.0, hr))
    hrv  = max(5.0,  min(100.0, hrv))
    skin = max(30.0, min(40.0,  skin))
    return hr, hrv, skin


# Module-level singleton shared across all API requests
simulator = BiosignalSimulator()
