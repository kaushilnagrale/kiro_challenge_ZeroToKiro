"""
Tests for InProcessCache (backend/services/cache.py).

Wave barrier: these must pass before Wave 2 subagents start.
"""

import time

import pytest

from backend.services.cache import InProcessCache


@pytest.fixture
def c() -> InProcessCache:
    return InProcessCache()


def test_set_and_get_hit(c: InProcessCache) -> None:
    c.setex("key1", ttl_seconds=60, value={"data": 42})
    result = c.get("key1")
    assert result == {"data": 42}


def test_key_miss_returns_none(c: InProcessCache) -> None:
    assert c.get("nonexistent") is None


def test_ttl_expiry_returns_none(c: InProcessCache) -> None:
    c.setex("key2", ttl_seconds=1, value="hello")
    # Confirm it's there immediately
    assert c.get("key2") == "hello"
    # Wait for expiry
    time.sleep(1.1)
    assert c.get("key2") is None


def test_ttl_expiry_evicts_entry(c: InProcessCache) -> None:
    c.setex("key3", ttl_seconds=1, value="bye")
    assert len(c) == 1
    time.sleep(1.1)
    c.get("key3")  # triggers eviction
    assert len(c) == 0


def test_overwrite_resets_ttl(c: InProcessCache) -> None:
    c.setex("key4", ttl_seconds=1, value="old")
    time.sleep(0.8)
    c.setex("key4", ttl_seconds=60, value="new")  # reset TTL
    time.sleep(0.5)  # would have expired under old TTL
    assert c.get("key4") == "new"


def test_delete(c: InProcessCache) -> None:
    c.setex("key5", ttl_seconds=60, value="x")
    c.delete("key5")
    assert c.get("key5") is None


def test_flush(c: InProcessCache) -> None:
    c.setex("a", 60, 1)
    c.setex("b", 60, 2)
    c.flush()
    assert len(c) == 0
    assert c.get("a") is None
