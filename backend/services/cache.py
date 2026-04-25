"""
In-process TTL cache for PulseRoute.

Interface mirrors aioredis / Upstash Redis so callers need zero changes
if we swap the backing store later:

    cache.get(key)               -> Any | None
    cache.setex(key, ttl_s, val) -> None

Backed by a plain dict[str, (value, expires_at_monotonic)].
TTL is checked lazily on every get(); expired entries are evicted then.

Module-level singleton `cache` is imported by all service modules.
"""

import time
from typing import Any


class InProcessCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        """Return cached value or None if missing / expired."""
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return value

    def setex(self, key: str, ttl_seconds: int, value: Any) -> None:
        """Store value with a TTL (seconds). Overwrites existing entry."""
        self._store[key] = (value, time.monotonic() + ttl_seconds)

    def delete(self, key: str) -> None:
        """Remove a key if present."""
        self._store.pop(key, None)

    def flush(self) -> None:
        """Clear all entries — useful in tests."""
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)


# Module-level singleton — import this in service modules:
#   from backend.services.cache import cache
cache = InProcessCache()
