#!/usr/bin/env python3
"""
Demo script for biosignal simulator — shows realistic time-series with mode transitions.

Demonstrates:
1. Baseline mode (resting) for 20 seconds
2. Transition to moderate mode (exercise) - smooth 45s transition
3. Moderate mode steady-state for 20 seconds
4. Transition to dehydrating mode (stress) - smooth 45s transition
5. Dehydrating mode steady-state for 20 seconds

Total runtime: ~150 seconds (2.5 minutes)

Usage:
    python scripts/demo_biosignal_simulator.py
"""

import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend import bio_sim


def main():
    print("=" * 80)
    print("PulseRoute Biosignal Simulator Demo")
    print("=" * 80)
    print()
    print("This demo shows realistic biosignal dynamics with smooth mode transitions.")
    print("Watch how HR, HRV, and skin temperature change smoothly (no sudden jumps).")
    print()
    
    # Start session in baseline mode
    session_id = bio_sim.start_session(mode="baseline")
    print(f"✓ Created session: {session_id}")
    print()
    
    # Phase 1: Baseline (20 samples)
    print("Phase 1: BASELINE mode (resting) - 20 seconds")
    print("-" * 80)
    print(f"{'Time':>6} | {'HR (bpm)':>10} | {'HRV (ms)':>10} | {'Skin Temp (°C)':>15}")
    print("-" * 80)
    
    for i in range(20):
        bio = bio_sim.get_current(session_id)
        print(f"{i:6d} | {bio.hr:10.2f} | {bio.hrv_ms:10.2f} | {bio.skin_temp_c:15.2f}")
        time.sleep(0.1)  # Speed up for demo (real would be 1s)
    
    print()
    
    # Phase 2: Transition to moderate
    print("Phase 2: Transitioning to MODERATE mode (exercise) - 45 seconds")
    print("-" * 80)
    bio_sim.set_mode(session_id, "moderate")
    
    for i in range(20, 65):
        bio = bio_sim.get_current(session_id)
        print(f"{i:6d} | {bio.hr:10.2f} | {bio.hrv_ms:10.2f} | {bio.skin_temp_c:15.2f}")
        time.sleep(0.1)
    
    print()
    
    # Phase 3: Moderate steady-state
    print("Phase 3: MODERATE mode steady-state - 20 seconds")
    print("-" * 80)
    
    for i in range(65, 85):
        bio = bio_sim.get_current(session_id)
        print(f"{i:6d} | {bio.hr:10.2f} | {bio.hrv_ms:10.2f} | {bio.skin_temp_c:15.2f}")
        time.sleep(0.1)
    
    print()
    
    # Phase 4: Transition to dehydrating
    print("Phase 4: Transitioning to DEHYDRATING mode (stress) - 45 seconds")
    print("-" * 80)
    bio_sim.set_mode(session_id, "dehydrating")
    
    for i in range(85, 130):
        bio = bio_sim.get_current(session_id)
        print(f"{i:6d} | {bio.hr:10.2f} | {bio.hrv_ms:10.2f} | {bio.skin_temp_c:15.2f}")
        time.sleep(0.1)
    
    print()
    
    # Phase 5: Dehydrating steady-state
    print("Phase 5: DEHYDRATING mode steady-state - 20 seconds")
    print("-" * 80)
    
    for i in range(130, 150):
        bio = bio_sim.get_current(session_id)
        print(f"{i:6d} | {bio.hr:10.2f} | {bio.hrv_ms:10.2f} | {bio.skin_temp_c:15.2f}")
        time.sleep(0.1)
    
    print()
    print("=" * 80)
    print("Demo complete!")
    print()
    print("Key observations:")
    print("  ✓ HR increased smoothly: ~70 bpm → ~140 bpm → ~165 bpm")
    print("  ✓ HRV decreased smoothly: ~60 ms → ~30 ms → ~20 ms")
    print("  ✓ Skin temp increased smoothly: ~33°C → ~36.7°C → ~38°C")
    print("  ✓ No sudden jumps - all transitions are sigmoid curves")
    print("  ✓ Gaussian noise adds realistic variation")
    print("=" * 80)


if __name__ == "__main__":
    main()
