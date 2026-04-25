"""
PulseRoute FastAPI application entry point.

Router registration is lazy — each router module is imported at startup via
importlib. If a module doesn't exist yet (Wave 2/3 subagents haven't landed
it), a warning is logged and that router is skipped. This means subagents
never need to touch this file.
"""

import importlib
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

logger = structlog.get_logger()

_START_TIME = time.time()

# All expected routers. Subagents create their module; this file picks it up.
_ROUTER_MODULES = [
    ("backend.routers.health", "router"),
    ("backend.routers.bio", "router"),
    ("backend.routers.stops", "router"),
    ("backend.routers.weather", "router"),
    ("backend.routers.mrt", "router"),
    ("backend.routers.route", "router"),
    ("backend.routers.risk", "router"),
    ("backend.routers.profile", "router"),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("pulseroute.startup", version="0.1.0")
    yield
    logger.info("pulseroute.shutdown")


app = FastAPI(
    title="PulseRoute",
    version="0.1.0",
    description="Cycling co-pilot backend — cool routes, biosignal monitoring, heat safety.",
    lifespan=lifespan,
)


def _register_routers() -> None:
    """Lazily import and mount all routers. Missing modules are skipped."""
    for module_path, attr in _ROUTER_MODULES:
        try:
            mod = importlib.import_module(module_path)
            router = getattr(mod, attr)
            app.include_router(router)
            logger.info("router.loaded", module=module_path)
        except ImportError as e:
            logger.warning("router.skipped", module=module_path, reason=str(e))
        except AttributeError as e:
            logger.warning(
                "router.skipped",
                module=module_path,
                reason=f"missing '{attr}' attribute: {e}",
            )


_register_routers()
