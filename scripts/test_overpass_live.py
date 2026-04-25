"""
Quick test: Fetch live stops from Overpass API for Tempe.

Run this to verify Overpass API is working and returns real data.
"""

import requests
import json

TEMPE_BBOX = (33.38, -111.95, 33.52, -111.85)

def test_overpass_api():
    """Test Overpass API with a simple query."""
    lat_min, lng_min, lat_max, lng_max = TEMPE_BBOX
    
    # Simple query: just drinking water fountains
    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="drinking_water"]({lat_min},{lng_min},{lat_max},{lng_max});
    );
    out body;
    """
    
    print("Querying Overpass API...")
    print(f"Bbox: {TEMPE_BBOX}")
    
    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query.encode('utf-8'),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        response.raise_for_status()
        
        data = response.json()
        elements = data.get("elements", [])
        
        print(f"\n✅ Success! Found {len(elements)} drinking water fountains")
        
        if elements:
            print("\nSample results:")
            for elem in elements[:5]:
                tags = elem.get("tags", {})
                name = tags.get("name", "Unnamed")
                lat = elem.get("lat")
                lng = elem.get("lon")
                print(f"  - {name} ({lat:.4f}, {lng:.4f})")
        
        return True
        
    except requests.exceptions.Timeout:
        print("❌ Timeout: Overpass API took too long")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")
        return False


def test_full_query():
    """Test full query with all stop types."""
    lat_min, lng_min, lat_max, lng_max = TEMPE_BBOX
    
    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="drinking_water"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["amenity"="cafe"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["amenity"="shelter"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["highway"="bus_stop"]({lat_min},{lng_min},{lat_max},{lng_max});
    );
    out body;
    """
    
    print("\n" + "="*60)
    print("Testing full query (water + cafes + shelters + bus stops)...")
    
    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query.encode('utf-8'),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        response.raise_for_status()
        
        data = response.json()
        elements = data.get("elements", [])
        
        # Count by type
        water = [e for e in elements if e.get("tags", {}).get("amenity") == "drinking_water"]
        cafes = [e for e in elements if e.get("tags", {}).get("amenity") == "cafe"]
        shelters = [e for e in elements if e.get("tags", {}).get("amenity") == "shelter"]
        bus_stops = [e for e in elements if e.get("tags", {}).get("highway") == "bus_stop"]
        
        print(f"\n✅ Success! Found {len(elements)} total stops:")
        print(f"   - {len(water)} drinking water fountains")
        print(f"   - {len(cafes)} cafes")
        print(f"   - {len(shelters)} shelters")
        print(f"   - {len(bus_stops)} bus stops")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    print("="*60)
    print("OVERPASS API LIVE TEST")
    print("="*60)
    
    # Test 1: Simple query
    success1 = test_overpass_api()
    
    # Test 2: Full query
    success2 = test_full_query()
    
    print("\n" + "="*60)
    if success1 and success2:
        print("✅ ALL TESTS PASSED")
        print("\nOverpass API is working! Track C can use this for production.")
    else:
        print("❌ SOME TESTS FAILED")
        print("\nFallback to stops_seed.json recommended.")
    print("="*60)
