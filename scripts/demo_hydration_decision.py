"""
Live demo: How PulseRoute decides when you need water.

Shows 3 scenarios with real scoring logic.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timezone

from backend.services.hydration_service import hydration_service
from shared.schema import Biosignal, RideContext, WeatherSnapshot


def print_scenario(title: str, bio: Biosignal, context: RideContext, weather: WeatherSnapshot):
    """Print a scenario and its risk assessment."""
    print("\n" + "="*70)
    print(f"SCENARIO: {title}")
    print("="*70)
    
    print("\n📊 INPUT DATA:")
    print(f"  Biosignal:")
    print(f"    - Heart Rate: {bio.hr:.0f} bpm")
    print(f"    - HRV: {bio.hrv_ms:.0f} ms")
    print(f"    - Skin Temp: {bio.skin_temp_c:.1f}°C")
    
    print(f"\n  Weather:")
    print(f"    - Heat Index: {weather.heat_index_c:.1f}°C" if weather.heat_index_c else "    - Heat Index: N/A")
    print(f"    - Temperature: {weather.temp_c:.1f}°C")
    print(f"    - Humidity: {weather.humidity_pct:.0f}%")
    
    print(f"\n  Ride Context:")
    print(f"    - Duration: {context.minutes:.0f} minutes")
    print(f"    - Location: ({context.current_lat:.4f}, {context.current_lng:.4f})")
    
    # Classify
    result = hydration_service.classify(bio, context, weather)
    
    print("\n🎯 DECISION:")
    print(f"  Risk Level: {result.level.upper()}")
    print(f"  Total Points: {result.points}")
    print(f"  Top Reason: {result.top_reason}")
    
    if result.all_reasons:
        print(f"\n  All Contributing Factors:")
        for reason in result.all_reasons:
            print(f"    • {reason}")
    
    # Action recommendation
    print("\n💡 RECOMMENDED ACTION:")
    if result.level == "green":
        print("  ✅ You're good! Keep riding and stay hydrated.")
    elif result.level == "yellow":
        print("  ⚠️  Consider taking a water break at the next stop.")
        print("  📍 App will show nearby fountains and shade zones.")
    else:  # red
        print("  🚨 STOP NOW! Find shade and water immediately.")
        print("  📍 App will navigate you to the nearest safe stop.")
        print("  🔔 Notification sent to your phone.")


def main():
    """Run 3 scenarios showing the decision logic."""
    print("="*70)
    print("PULSEROUTE HYDRATION DECISION DEMO")
    print("="*70)
    print("\nShowing how we decide when you need water/rest...")
    print("(No ML - just smart rules based on your body's signals)")
    
    # Scenario 1: GREEN - Morning ride, feeling good
    print_scenario(
        title="Morning Ride - Feeling Good",
        bio=Biosignal(
            hr=75.0,
            hrv_ms=60.0,
            skin_temp_c=36.5,
            timestamp=datetime.now(timezone.utc),
            source="sim_baseline",
        ),
        context=RideContext(
            minutes=15.0,
            baseline_hr=65.0,
            current_lat=33.4215,
            current_lng=-111.9390,
        ),
        weather=WeatherSnapshot(
            temp_c=28.0,
            humidity_pct=25.0,
            heat_index_c=30.0,
            uv_index=6.0,
            apparent_temp_c=30.0,
            wind_kmh=12.0,
        ),
    )
    
    # Scenario 2: YELLOW - Afternoon ride, getting warm
    print_scenario(
        title="Afternoon Ride - Getting Warm",
        bio=Biosignal(
            hr=148.0,  # Elevated
            hrv_ms=32.0,  # Low
            skin_temp_c=37.2,
            timestamp=datetime.now(timezone.utc),
            source="sim_moderate",
        ),
        context=RideContext(
            minutes=35.0,
            baseline_hr=65.0,
            current_lat=33.4285,
            current_lng=-111.9498,
        ),
        weather=WeatherSnapshot(
            temp_c=38.0,
            humidity_pct=18.0,
            heat_index_c=40.0,  # Hot!
            uv_index=10.0,
            apparent_temp_c=40.0,
            wind_kmh=8.0,
        ),
    )
    
    # Scenario 3: RED - Long ride, extreme heat, struggling
    print_scenario(
        title="Long Ride - Extreme Heat - DANGER",
        bio=Biosignal(
            hr=172.0,  # Critical
            hrv_ms=18.0,  # Critical
            skin_temp_c=38.5,  # Critical
            timestamp=datetime.now(timezone.utc),
            source="sim_dehydrating",
        ),
        context=RideContext(
            minutes=55.0,  # Extended
            baseline_hr=65.0,
            current_lat=33.4050,
            current_lng=-111.9090,
        ),
        weather=WeatherSnapshot(
            temp_c=43.0,
            humidity_pct=12.0,
            heat_index_c=46.0,  # Extreme
            uv_index=11.0,
            apparent_temp_c=46.0,
            wind_kmh=5.0,
        ),
    )
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print("\nThe system uses 10 rules to score your risk:")
    print("  1. Heart Rate (3 thresholds: 140, 155, 170 bpm)")
    print("  2. Skin Temperature (2 thresholds: 37.5, 38.0°C)")
    print("  3. Heart Rate Variability (2 thresholds: 35, 20 ms)")
    print("  4. Ride Duration (1 threshold: 45 minutes)")
    print("  5. Heat Index (2 thresholds: 35, 40°C)")
    print("\nRisk Levels:")
    print("  🟢 GREEN (0-19 pts):  Keep riding")
    print("  🟡 YELLOW (20-44 pts): Consider a break")
    print("  🔴 RED (45+ pts):     Stop immediately")
    print("\nNo ML needed - just your body's signals + weather + time!")
    print("="*70)


if __name__ == "__main__":
    main()
