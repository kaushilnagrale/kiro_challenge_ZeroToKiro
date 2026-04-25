"""
Bio router — /bio/mode and /bio/current endpoints.

POST /bio/mode    — set simulation mode for a session
GET  /bio/current — get latest biosignal for a session (returns Biosignal directly)
"""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.bio_service import bio_service
from shared.schema import BioMode, Biosignal, Provenance, SourceRef

logger = structlog.get_logger()

router = APIRouter(prefix="/bio", tags=["bio"])


# ─────────── Request / Response models ───────────

class BioModeRequest(BaseModel):
    session_id: str
    mode: BioMode


class BioModeResponse(BaseModel):
    session_id: str
    mode: str
    provenance: Provenance


# ─────────── Endpoints ───────────

@router.post("/mode", response_model=BioModeResponse)
async def post_bio_mode(body: BioModeRequest) -> BioModeResponse:
    """Set the biosignal simulation mode for a session."""
    logger.info("bio.set_mode", session_id=body.session_id, mode=body.mode)

    bio_service.set_mode(body.session_id, body.mode)

    now = datetime.now(timezone.utc)
    provenance = Provenance(
        bio_source=SourceRef(
            source_id=f"sim_{body.mode}",
            timestamp=now,
            age_seconds=0,
        )
    )

    return BioModeResponse(
        session_id=body.session_id,
        mode=body.mode,
        provenance=provenance,
    )


@router.get("/current", response_model=Biosignal)
async def get_bio_current(session_id: str) -> Biosignal:
    """Get the current biosignal reading for a session."""
    logger.info("bio.get_current", session_id=session_id)
    return bio_service.get_current(session_id)
