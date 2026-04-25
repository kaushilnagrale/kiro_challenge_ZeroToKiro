"""
BioService — per-session biosignal simulator for PulseRoute.

Thin wrapper around bio_sim module. Delegates to bio_sim for realistic
time-series generation with smooth transitions and physiological dynamics.

Maintains backward compatibility with existing API while providing
realistic biosignal simulation for demo purposes.
"""

import structlog

from backend import bio_sim
from shared.schema import BioMode, Biosignal

logger = structlog.get_logger()


class BioService:
    def __init__(self) -> None:
        # Session management delegated to bio_sim module
        # Map user session_ids to bio_sim session_ids
        self._session_map: dict[str, str] = {}

    def set_mode(self, session_id: str, mode: BioMode) -> None:
        """Set the simulation mode for a session."""
        # Ensure session exists (create if needed)
        if session_id not in self._session_map:
            bio_session_id = bio_sim.start_session(mode=mode)
            self._session_map[session_id] = bio_session_id
            logger.info("bio_service.set_mode", session_id=session_id, mode=mode, msg="Created new session")
        else:
            bio_session_id = self._session_map[session_id]
            bio_sim.set_mode(bio_session_id, mode)
            logger.info("bio_service.set_mode", session_id=session_id, mode=mode)

    def get_current(self, session_id: str) -> Biosignal:
        """Return a freshly sampled Biosignal for the session."""
        # Ensure session exists (create if needed)
        if session_id not in self._session_map:
            bio_session_id = bio_sim.start_session(mode="baseline")
            self._session_map[session_id] = bio_session_id
            logger.info("bio_service.get_current", session_id=session_id, msg="Created new session")
        else:
            bio_session_id = self._session_map[session_id]
        
        biosignal = bio_sim.get_current(bio_session_id)
        
        logger.info(
            "bio_service.get_current",
            session_id=session_id,
            hr=round(biosignal.hr, 2),
            hrv=round(biosignal.hrv_ms, 2),
            skin_temp=round(biosignal.skin_temp_c, 2),
        )
        
        return biosignal


# Module-level singleton
bio_service = BioService()
