"""
Demo: Strava integration for personalized hydration alerts.

Shows how we'd use Strava data to personalize thresholds.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.services.strava_service import strava_service
from backend.services.user_profile_service import user_profile_service


def print_divider():
    print("\n" + "="*70)


def demo_user(user_id: str):
    """Demo Strava integration for a user."""
    print_divider()
    print(f"USER: {user_id}")
    print_divider()
    
    # Step 1: Get Strava athlete profile
    athlete = strava_service.get_athlete(user_id)
    if not athlete:
        print("❌ Strava not connected")
        return
    
    print(f"\n👤 STRAVA PROFILE:")
    print(f"   Name: {athlete.firstname} {athlete.lastname}")
    print(f"   Username: @{athlete.username}")
    print(f"   Location: {athlete.city}, {athlete.state}")
    
    # Step 2: Get Strava stats
    stats = strava_service.get_athlete_stats(user_id)
    if stats:
        recent = stats.recent_ride_totals
        print(f"\n📊 RECENT ACTIVITY (Last 4 weeks):")
        print(f"   Rides: {recent['count']}")
        print(f"   Distance: {recent['distance']/1000:.1f} km")
        print(f"   Time: {recent['moving_time']/3600:.1f} hours")
    
    # Step 3: Get recent activities
    activities = strava_service.get_recent_activities(user_id, limit=5)
    if activities:
        print(f"\n🚴 RECENT RIDES:")
        for activity in activities[:3]:
            print(f"   • {activity.name}")
            print(f"     {activity.distance/1000:.1f} km, Avg HR: {activity.average_heartrate:.0f} bpm")
    
    # Step 4: Get fitness metrics
    metrics = strava_service.get_fitness_metrics(user_id)
    print(f"\n💪 FITNESS METRICS:")
    print(f"   Fitness Level: {metrics['fitness_level'].upper()}")
    print(f"   Resting HR: {metrics['resting_hr']:.0f} bpm")
    print(f"   Max HR: {metrics['max_hr']:.0f} bpm")
    print(f"   FTP: {metrics['ftp']:.0f} watts")
    print(f"   HRV Baseline: {metrics['hrv_baseline']:.0f} ms")
    
    # Step 5: Get personalized thresholds
    profile = user_profile_service.get_profile(user_id)
    if profile:
        print(f"\n🎯 PERSONALIZED THRESHOLDS:")
        print(f"   HR Alert: {profile.hr_alert_threshold:.0f} bpm")
        print(f"   HRV Alert: {profile.hrv_alert_threshold:.0f} ms")
        print(f"\n   💡 These thresholds are adjusted based on your Strava history!")
        print(f"      A beginner gets alerted earlier (more conservative)")
        print(f"      An athlete gets alerted later (less conservative)")


def main():
    """Run demo for all 3 user types."""
    print("="*70)
    print("STRAVA INTEGRATION DEMO")
    print("="*70)
    print("\nShowing how we use Strava data to personalize hydration alerts...")
    print("(This is MOCK data for hackathon - production would use real Strava API)")
    
    # Demo all 3 user types
    demo_user("demo_beginner")
    demo_user("demo_intermediate")
    demo_user("demo_advanced")
    
    # Comparison
    print_divider()
    print("COMPARISON: How Thresholds Differ")
    print_divider()
    
    print("\n📊 HR Alert Thresholds:")
    print("   Beginner:     140 bpm (more conservative)")
    print("   Intermediate: 155 bpm (standard)")
    print("   Advanced:     170 bpm (less conservative)")
    
    print("\n📊 HRV Alert Thresholds:")
    print("   Beginner:     25 ms (alert at higher HRV)")
    print("   Intermediate: 35 ms (standard)")
    print("   Advanced:     45 ms (alert at lower HRV)")
    
    print("\n💡 WHY THIS MATTERS:")
    print("   • Beginner with HR 145 → 🟡 YELLOW (alert!)")
    print("   • Advanced with HR 145 → 🟢 GREEN (normal for them)")
    print("\n   Same HR, different alert - personalized to YOUR fitness!")
    
    print_divider()
    print("PRODUCTION FLOW")
    print_divider()
    print("\n1. User clicks 'Connect Strava' in app")
    print("2. App redirects to Strava OAuth")
    print("3. User authorizes PulseRoute")
    print("4. Strava redirects back with code")
    print("5. Backend exchanges code for token")
    print("6. Backend fetches athlete data + recent rides")
    print("7. Backend calculates fitness level from FTP + volume")
    print("8. Backend sets personalized thresholds")
    print("9. User gets alerts tailored to THEIR fitness!")
    
    print("\n🎯 For hackathon: We fake this with 3 pre-defined users")
    print("🚀 For production: Real Strava OAuth + API integration")
    print("="*70)


if __name__ == "__main__":
    main()
