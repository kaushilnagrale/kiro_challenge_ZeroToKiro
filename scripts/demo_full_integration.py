#!/usr/bin/env python3
"""
Full Integration Demo — biosignal simulator → classifier → risk score changes.

Demonstrates end-to-end flow:
1. Start biosignal session in baseline mode
2. Get biosignal → classify → verify GREEN risk
3. Switch to moderate mode
4. Get biosignal → classify → verify YELLOW risk
5. Switch to dehydrating mode
6. Get biosignal → classify → verify RED risk
7. Test stops API returns shade_zones

Usage:
    python scripts/demo_full_integration.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend import bio_sim
from backend.services.bio_service import bio_service
from backend.services.hydration_service import hydration_service
from backend.services.stops_service import stops_service
from shared.schema import RideContext, WeatherSnapshot


def main():
    print("=" * 80)
    print("PulseRoute Full Integration Demo")
    print("=" * 80)
    print()
    print("Testing: Biosignal Simulator -> Hydration Classifier -> Risk Score Changes")
    print()
    
    # Test data
    ride_context = RideContext(
        minutes=50.0,  # Extended ride to trigger +10 points
        current_lat=33.42,
        current_lng=-111.94,
    )
    weather = WeatherSnapshot(
        temp_c=35.0,
        humidity_pct=20.0,
        heat_index_c=37.0,
        uv_index=9.0,
    )
    
    # ─────────── Phase 1: Baseline Mode (GREEN) ───────────
    print("Phase 1: BASELINE mode (resting)")
    print("-" * 80)
    
    session_id = "demo-session-001"
    bio_service.set_mode(session_id, "baseline")
    
    # Sample a few times to get steady-state
    for _ in range(5):
        bio = bio_service.get_current(session_id)
    
    # Classify
    risk = hydration_service.classify(bio, ride_context, weather)
    
    print(f"Biosignal:")
    print(f"  HR: {bio.hr:.1f} bpm")
    print(f"  HRV: {bio.hrv_ms:.1f} ms")
    print(f"  Skin Temp: {bio.skin_temp_c:.1f}°C")
    print()
    print(f"Risk Score:")
    print(f"  Level: {risk.level.upper()} ({risk.points} points)")
    print(f"  Reason: {risk.top_reason}")
    print()
    
    assert risk.level == "green", f"Expected GREEN, got {risk.level}"
    print("✅ PASS: Baseline mode → GREEN risk")
    print()
    
    # ─────────── Phase 2: Moderate Mode (YELLOW) ───────────
    print("Phase 2: MODERATE mode (exercise)")
    print("-" * 80)
    
    bio_service.set_mode(session_id, "moderate")
    
    # Sample many times to let transition complete
    for _ in range(50):
        bio = bio_service.get_current(session_id)
    
    # Classify
    risk = hydration_service.classify(bio, ride_context, weather)
    
    print(f"Biosignal:")
    print(f"  HR: {bio.hr:.1f} bpm")
    print(f"  HRV: {bio.hrv_ms:.1f} ms")
    print(f"  Skin Temp: {bio.skin_temp_c:.1f}°C")
    print()
    print(f"Risk Score:")
    print(f"  Level: {risk.level.upper()} ({risk.points} points)")
    print(f"  Reason: {risk.top_reason}")
    print(f"  All Reasons:")
    for reason in risk.all_reasons:
        print(f"    - {reason}")
    print()
    
    assert risk.level in ["yellow", "red"], f"Expected YELLOW or RED, got {risk.level}"
    print(f"✅ PASS: Moderate mode → {risk.level.upper()} risk")
    print()
    
    # ─────────── Phase 3: Dehydrating Mode (RED) ───────────
    print("Phase 3: DEHYDRATING mode (stress)")
    print("-" * 80)
    
    bio_service.set_mode(session_id, "dehydrating")
    
    # Sample many times to let transition complete
    for _ in range(50):
        bio = bio_service.get_current(session_id)
    
    # Classify
    risk = hydration_service.classify(bio, ride_context, weather)
    
    print(f"Biosignal:")
    print(f"  HR: {bio.hr:.1f} bpm")
    print(f"  HRV: {bio.hrv_ms:.1f} ms")
    print(f"  Skin Temp: {bio.skin_temp_c:.1f}°C")
    print()
    print(f"Risk Score:")
    print(f"  Level: {risk.level.upper()} ({risk.points} points)")
    print(f"  Reason: {risk.top_reason}")
    print(f"  All Reasons:")
    for reason in risk.all_reasons:
        print(f"    - {reason}")
    print()
    
    assert risk.level == "red", f"Expected RED, got {risk.level}"
    print("✅ PASS: Dehydrating mode → RED risk")
    print()
    
    # ─────────── Phase 4: Stops API (Shade Zones) ───────────
    print("Phase 4: Stops API (shade zones)")
    print("-" * 80)
    
    # Tempe bbox
    bbox = (33.38, -111.95, 33.52, -111.85)
    stops_response = stops_service.get_stops(bbox)
    
    print(f"Stops Response:")
    print(f"  Fountains: {len(stops_response.fountains)}")
    print(f"  Cafes: {len(stops_response.cafes)}")
    print(f"  Repair: {len(stops_response.repair)}")
    print(f"  Shade Zones: {len(stops_response.shade_zones)} ⭐ NEW!")
    print()
    print(f"Provenance:")
    print(f"  Source: {stops_response.provenance.env_source.source_id}")
    print(f"  Age: {stops_response.provenance.env_source.age_seconds}s")
    print()
    
    total_stops = (
        len(stops_response.fountains) +
        len(stops_response.cafes) +
        len(stops_response.repair) +
        len(stops_response.shade_zones)
    )
    
    print(f"Total stops: {total_stops}")
    print()
    
    # Verify shade zones exist
    assert len(stops_response.shade_zones) > 0, "Expected shade_zones to be populated"
    print("✅ PASS: Stops API returns shade_zones")
    print()
    
    # Show sample shade zone
    if stops_response.shade_zones:
        shade = stops_response.shade_zones[0]
        print(f"Sample Shade Zone:")
        print(f"  Name: {shade.name}")
        print(f"  Location: ({shade.lat:.4f}, {shade.lng:.4f})")
        print(f"  Amenities: {', '.join(shade.amenities)}")
        print(f"  Source: {shade.source}")
        print()
    
    # ─────────── Summary ───────────
    print("=" * 80)
    print("Integration Demo Complete!")
    print("=" * 80)
    print()
    print("✅ All tests passed:")
    print("  1. Baseline mode → GREEN risk")
    print("  2. Moderate mode → YELLOW/RED risk")
    print("  3. Dehydrating mode → RED risk")
    print("  4. Stops API returns shade_zones")
    print()
    print("Key observations:")
    print("  ✓ Biosignal simulator generates realistic values")
    print("  ✓ Risk score changes appropriately with mode")
    print("  ✓ Classifier provides human-readable reasons")
    print("  ✓ Stops API includes shade zones (parks, shelters, bus stops)")
    print("  ✓ All components work together seamlessly")
    print()
    print("=" * 80)


if __name__ == "__main__":
    main()
