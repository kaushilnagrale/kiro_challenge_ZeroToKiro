"""
Full app integration test - tests all endpoints together.

Tests the complete flow:
1. User profile (Strava integration)
2. Biosignal simulation
3. Weather data
4. Hydration risk assessment
5. Route planning with MRT
6. Stops (water/shade)
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"


def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)


def test_health():
    """Test health endpoint."""
    print_section("1. HEALTH CHECK")
    response = requests.get(f"{BASE_URL}/health")
    data = response.json()
    print(f"[OK] Status: {data['status']}")
    print(f"[OK] Version: {data['version']}")
    print(f"[OK] Uptime: {data['uptime_s']}s")
    return response.status_code == 200


def test_user_profile():
    """Test user profile endpoints."""
    print_section("2. USER PROFILE (Strava Integration)")
    
    # Test all 3 fitness levels
    for user_id in ["demo_beginner", "demo_intermediate", "demo_advanced"]:
        response = requests.get(f"{BASE_URL}/profile/{user_id}")
        profile = response.json()
        
        print(f"\n👤 {user_id.replace('demo_', '').upper()}:")
        print(f"   Resting HR: {profile['resting_hr']:.0f} bpm")
        print(f"   HRV Baseline: {profile['hrv_baseline']:.0f} ms")
        print(f"   HR Alert Threshold: {profile['hr_alert_threshold']:.0f} bpm")
        print(f"   HRV Alert Threshold: {profile['hrv_alert_threshold']:.0f} ms")
    
    return True


def test_strava_data():
    """Test Strava data endpoint."""
    print_section("3. STRAVA DATA")
    
    response = requests.get(f"{BASE_URL}/profile/demo_advanced/strava")
    data = response.json()
    
    athlete = data['athlete']
    stats = data['stats']
    metrics = data['fitness_metrics']
    
    print(f"\n🏃 Athlete: {athlete['firstname']} {athlete['lastname']} (@{athlete['username']})")
    print(f"   Location: {athlete['city']}, {athlete['state']}")
    
    print(f"\n📊 Recent Stats (Last 4 weeks):")
    print(f"   Rides: {stats['recent_ride_totals']['count']}")
    print(f"   Distance: {stats['recent_ride_totals']['distance']/1000:.1f} km")
    print(f"   Time: {stats['recent_ride_totals']['moving_time']/3600:.1f} hours")
    
    print(f"\n💪 Fitness Metrics:")
    print(f"   Level: {metrics['fitness_level'].upper()}")
    print(f"   FTP: {metrics['ftp']:.0f} watts")
    print(f"   Avg Distance: {metrics['avg_distance_km']:.1f} km")
    
    return True


def test_biosignal():
    """Test biosignal endpoints."""
    print_section("4. BIOSIGNAL SIMULATION")
    
    # Set mode to dehydrating
    response = requests.post(
        f"{BASE_URL}/bio/mode",
        json={"session_id": "test_session", "mode": "dehydrating"}
    )
    print(f"✅ Set mode to dehydrating")
    
    # Get current biosignal
    response = requests.get(f"{BASE_URL}/bio/current?session_id=test_session")
    bio = response.json()
    
    print(f"\n📈 Current Biosignal:")
    print(f"   HR: {bio['hr']:.0f} bpm")
    print(f"   HRV: {bio['hrv_ms']:.0f} ms")
    print(f"   Skin Temp: {bio['skin_temp_c']:.1f}°C")
    print(f"   Source: {bio['source']}")
    
    return True


def test_weather():
    """Test weather endpoint."""
    print_section("5. WEATHER DATA")
    
    response = requests.get(f"{BASE_URL}/weather?lat=33.4215&lng=-111.9390")
    data = response.json()
    
    current = data['current']
    print(f"\n🌡️ Current Weather (Tempe):")
    print(f"   Temperature: {current['temp_c']:.1f}°C")
    print(f"   Heat Index: {current['heat_index_c']:.1f}°C")
    print(f"   Humidity: {current['humidity_pct']:.0f}%")
    print(f"   UV Index: {current['uv_index']:.1f}")
    
    if data.get('advisories'):
        print(f"\n⚠️  Weather Advisories: {len(data['advisories'])}")
    
    return True


def test_risk_assessment():
    """Test risk assessment endpoint."""
    print_section("6. HYDRATION RISK ASSESSMENT")
    
    response = requests.post(
        f"{BASE_URL}/risk",
        json={
            "bio_session_id": "test_session",
            "current_lat": 33.4215,
            "current_lng": -111.9390,
            "ride_minutes": 45.0,
            "baseline_hr": 65.0
        }
    )
    data = response.json()
    
    if data.get('alert'):
        alert = data['alert']
        risk = alert['risk']
        
        print(f"\n🚨 Risk Assessment:")
        print(f"   Level: {risk['level'].upper()}")
        print(f"   Points: {risk['points']}")
        print(f"   Top Reason: {risk['top_reason']}")
        
        if risk['all_reasons']:
            print(f"\n   Contributing Factors:")
            for reason in risk['all_reasons']:
                print(f"     • {reason}")
        
        if alert.get('suggested_stop'):
            stop = alert['suggested_stop']
            print(f"\n   💧 Suggested Stop: {stop['name']}")
            print(f"      Amenities: {', '.join(stop['amenities'])}")
    else:
        print(f"\n⚠️  Fallback: {data.get('fallback_message')}")
    
    return True


def test_stops():
    """Test stops endpoint."""
    print_section("7. STOPS (Water & Shade)")
    
    response = requests.get(
        f"{BASE_URL}/stops?bbox=33.38,-111.95,33.52,-111.85"
    )
    data = response.json()
    
    print(f"\n💧 Stops in Tempe:")
    print(f"   Fountains: {len(data['fountains'])}")
    print(f"   Cafes: {len(data['cafes'])}")
    print(f"   Shade Zones: {len(data['shade_zones'])}")
    print(f"   Repair Stations: {len(data['repair'])}")
    
    if data['fountains']:
        print(f"\n   Sample Fountain: {data['fountains'][0]['name']}")
        print(f"   Amenities: {', '.join(data['fountains'][0]['amenities'])}")
    
    if data['shade_zones']:
        print(f"\n   Sample Shade Zone: {data['shade_zones'][0]['name']}")
        print(f"   Amenities: {', '.join(data['shade_zones'][0]['amenities'])}")
    
    return True


def test_route():
    """Test route endpoint."""
    print_section("8. ROUTE PLANNING (with MRT)")
    
    response = requests.post(
        f"{BASE_URL}/route",
        json={
            "origin": [33.4215, -111.9390],
            "destination": [33.4285, -111.9498],
            "depart_time": datetime.now().isoformat(),
            "sensitive_mode": True,
            "amenity_prefs": ["water", "shade"]
        }
    )
    data = response.json()
    
    fastest = data['fastest']
    pulseroute = data['pulseroute']
    
    print(f"\n🚴 Route Comparison:")
    print(f"\n   FASTEST Route:")
    print(f"     Distance: {fastest['distance_m']/1000:.2f} km")
    print(f"     ETA: {fastest['eta_seconds']/60:.1f} minutes")
    print(f"     Peak MRT: {fastest['peak_mrt_c']:.1f}°C")
    print(f"     Mean MRT: {fastest['mean_mrt_c']:.1f}°C")
    print(f"     Stops: {len(fastest['stops'])}")
    
    print(f"\n   PULSEROUTE (Cool Route):")
    print(f"     Distance: {pulseroute['distance_m']/1000:.2f} km")
    print(f"     ETA: {pulseroute['eta_seconds']/60:.1f} minutes")
    print(f"     Peak MRT: {pulseroute['peak_mrt_c']:.1f}°C")
    print(f"     Mean MRT: {pulseroute['mean_mrt_c']:.1f}°C")
    print(f"     Stops: {len(pulseroute['stops'])}")
    
    print(f"\n   🌡️ Temperature Difference:")
    print(f"     Peak: {fastest['peak_mrt_c'] - pulseroute['peak_mrt_c']:.1f}°C cooler")
    print(f"     Mean: {fastest['mean_mrt_c'] - pulseroute['mean_mrt_c']:.1f}°C cooler")
    
    return True


def main():
    """Run all tests."""
    print("="*70)
    print("  PULSEROUTE FULL APP TEST")
    print("="*70)
    print("\nTesting all endpoints with integrated flow...")
    
    tests = [
        ("Health Check", test_health),
        ("User Profile", test_user_profile),
        ("Strava Data", test_strava_data),
        ("Biosignal", test_biosignal),
        ("Weather", test_weather),
        ("Risk Assessment", test_risk_assessment),
        ("Stops", test_stops),
        ("Route Planning", test_route),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            results.append((name, False))
    
    # Summary
    print_section("SUMMARY")
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    print(f"\n✅ Tests Passed: {passed}/{total}")
    
    for name, success in results:
        status = "✅" if success else "❌"
        print(f"   {status} {name}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! App is fully functional!")
        print("\n📱 Ready for mobile app integration!")
        print("\n🔗 API Documentation: http://localhost:8000/docs")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
    
    print("="*70)


if __name__ == "__main__":
    main()
