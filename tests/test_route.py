"""
Integration tests for the routing and risk endpoints.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import RouteRequest
from backend.routing import _mock_routes, _poly_distance_m
from backend.risk import classify_risk

client = TestClient(app)

# ── /health ───────────────────────────────────────────────────────────────────

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "timestamp" in body


# ── /route ────────────────────────────────────────────────────────────────────

def test_route_returns_both_routes():
    payload = {
        "origin":      [33.4176, -111.9341],
        "destination": [33.4255, -111.9155],
        "sensitive_mode": False,
    }
    resp = client.post("/route", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "fastest"    in body
    assert "pulseroute" in body
    assert "provenance" in body


def test_pulseroute_cooler_than_fastest():
    payload = {
        "origin":      [33.4176, -111.9341],
        "destination": [33.4255, -111.9155],
    }
    body = client.post("/route", json=payload).json()
    assert body["pulseroute"]["peak_mrt_c"] < body["fastest"]["peak_mrt_c"]


def test_pulseroute_has_more_shade():
    payload = {
        "origin":      [33.4176, -111.9341],
        "destination": [33.4255, -111.9155],
    }
    body = client.post("/route", json=payload).json()
    assert body["pulseroute"]["shade_pct"] > body["fastest"]["shade_pct"]


def test_route_provenance_fields_present():
    payload = {
        "origin":      [33.4176, -111.9341],
        "destination": [33.4255, -111.9155],
    }
    body = client.post("/route", json=payload).json()
    p = body["provenance"]
    assert p["biosignal_source_id"]    is not None
    assert p["environmental_source_id"] is not None
    assert p["route_segment_id"]        is not None


def test_route_polylines_have_enough_points():
    payload = {
        "origin":      [33.4176, -111.9341],
        "destination": [33.4255, -111.9155],
    }
    body = client.post("/route", json=payload).json()
    assert len(body["fastest"]["polyline"])    >= 2
    assert len(body["pulseroute"]["polyline"]) >= 2


# ── /risk ─────────────────────────────────────────────────────────────────────

def test_risk_green_for_healthy_values():
    payload = {
        "hr": 70, "hrv": 55, "skin_temp_c": 33.0,
        "ambient_temp_c": 28.0, "ride_minutes": 10.0, "baseline_hr": 65.0,
    }
    resp = client.post("/risk", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == "green"


def test_risk_red_for_dehydration_values():
    payload = {
        "hr": 145, "hrv": 12, "skin_temp_c": 37.2,
        "ambient_temp_c": 42.0, "ride_minutes": 55.0, "baseline_hr": 65.0,
    }
    body = client.post("/risk", json=payload).json()
    assert body["score"] == "red"
    assert body["risk_points"] > 4


def test_risk_yellow_intermediate():
    payload = {
        "hr": 100, "hrv": 30, "skin_temp_c": 34.5,
        "ambient_temp_c": 35.0, "ride_minutes": 25.0, "baseline_hr": 65.0,
    }
    body = client.post("/risk", json=payload).json()
    assert body["score"] in ("yellow", "green")


def test_risk_response_has_provenance():
    payload = {
        "hr": 80, "hrv": 45, "skin_temp_c": 33.5,
        "ambient_temp_c": 38.0, "ride_minutes": 20.0, "baseline_hr": 65.0,
    }
    body = client.post("/risk", json=payload).json()
    assert "provenance" in body
    assert body["provenance"]["biosignal_source_id"] is not None


# ── /stops ────────────────────────────────────────────────────────────────────

def test_stops_returns_fountains():
    resp = client.get("/stops")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["fountains"]) > 0


# ── internal routing utils ────────────────────────────────────────────────────

def test_mock_routes_distance_positive():
    origin = [33.4176, -111.9341]
    dest   = [33.4255, -111.9155]
    fastest, pulse = _mock_routes(origin, dest)
    assert fastest.distance_m > 0
    assert pulse.distance_m   > 0


def test_poly_distance_trivial():
    poly = [[0.0, 0.0], [0.0, 0.0]]
    assert _poly_distance_m(poly) == pytest.approx(0.0, abs=1.0)


# ── biosignal simulator ───────────────────────────────────────────────────────

def test_bio_session_and_read():
    resp = client.post("/bio/session", json={"mode": "baseline"})
    assert resp.status_code == 200
    session_id = resp.json()["session_id"]

    resp2 = client.get(f"/bio/{session_id}")
    assert resp2.status_code == 200
    reading = resp2.json()
    assert 40 <= reading["hr"]          <= 200
    assert  5 <= reading["hrv"]         <= 100
    assert 30 <= reading["skin_temp_c"] <= 40


def test_bio_missing_session_404():
    resp = client.get("/bio/nonexistent-session-id")
    assert resp.status_code == 404
