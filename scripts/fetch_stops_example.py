"""
Example: Fetch stops from Overpass API for Tempe bbox.

This is what Track C should implement in scripts/fetch_stops.py
"""

import requests
import json

# Tempe bounding box: (lat_min, lng_min, lat_max, lng_max)
TEMPE_BBOX = (33.38, -111.95, 33.52, -111.85)

def build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    """
    Build Overpass QL query for all heat-relief stops.
    
    Returns stops with:
    - Water sources (drinking_water)
    - Commercial (cafe, convenience, fuel)
    - Shade/rest (shelter, covered areas, parks)
    - Services (bike_repair)
    """
    lat_min, lng_min, lat_max, lng_max = bbox
    
    query = f"""
    [out:json][timeout:25];
    (
      // Water sources
      node["amenity"="drinking_water"]({lat_min},{lng_min},{lat_max},{lng_max});
      
      // Commercial stops (cafes, gas stations, convenience stores)
      node["amenity"="cafe"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["amenity"="restaurant"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["amenity"="convenience"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["amenity"="fuel"]({lat_min},{lng_min},{lat_max},{lng_max});
      
      // Shade/rest areas
      node["amenity"="shelter"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["covered"="yes"]({lat_min},{lng_min},{lat_max},{lng_max});
      node["highway"="bus_stop"]({lat_min},{lng_min},{lat_max},{lng_max});
      
      // Parks and natural shade
      way["leisure"="park"]({lat_min},{lng_min},{lat_max},{lng_max});
      way["natural"="tree_row"]({lat_min},{lng_min},{lat_max},{lng_max});
      
      // Bike services
      node["amenity"="bicycle_repair_station"]({lat_min},{lng_min},{lat_max},{lng_max});
    );
    out center;
    """
    return query


def fetch_stops_from_overpass(bbox: tuple[float, float, float, float]) -> list[dict]:
    """
    Query Overpass API and return normalized stops.
    
    Returns list of Stop-compatible dicts.
    """
    query = build_overpass_query(bbox)
    
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        timeout=30,
    )
    response.raise_for_status()
    
    data = response.json()
    stops = []
    
    for element in data.get("elements", []):
        # Extract coordinates
        if element["type"] == "node":
            lat = element["lat"]
            lng = element["lon"]
        elif element["type"] == "way" and "center" in element:
            lat = element["center"]["lat"]
            lng = element["center"]["lon"]
        else:
            continue  # Skip if no coordinates
        
        # Extract tags
        tags = element.get("tags", {})
        name = tags.get("name", "Unnamed")
        
        # Determine amenities
        amenities = []
        if tags.get("amenity") == "drinking_water":
            amenities.append("water")
        if tags.get("amenity") in ["cafe", "restaurant", "convenience", "fuel"]:
            amenities.append("water")
            amenities.append("food")
        if tags.get("amenity") == "shelter" or tags.get("covered") == "yes":
            amenities.append("shade")
        if tags.get("highway") == "bus_stop":
            amenities.append("shade")
        if tags.get("leisure") == "park" or tags.get("natural") in ["tree_row", "wood"]:
            amenities.append("shade")
        if tags.get("amenity") == "bicycle_repair_station":
            amenities.append("bike_repair")
        if tags.get("toilets") == "yes" or tags.get("amenity") == "toilets":
            amenities.append("restroom")
        
        # Determine source category
        if tags.get("amenity") == "drinking_water":
            source = "official"
        elif tags.get("amenity") in ["cafe", "restaurant", "convenience", "fuel"]:
            source = "commercial"
        elif tags.get("amenity") in ["shelter", "bicycle_repair_station"]:
            source = "public"
        elif tags.get("highway") == "bus_stop":
            source = "public"
        else:
            source = "osm"
        
        # Build stop dict
        stop = {
            "id": f"osm-{element['type']}-{element['id']}",
            "name": name,
            "lat": lat,
            "lng": lng,
            "amenities": amenities,
            "open_now": None,  # Would need separate hours API
            "source": source,
            "source_ref": "overpass_api",
        }
        
        stops.append(stop)
    
    return stops


if __name__ == "__main__":
    print("Fetching stops from Overpass API...")
    stops = fetch_stops_from_overpass(TEMPE_BBOX)
    
    print(f"\nFound {len(stops)} stops")
    print(f"Water sources: {len([s for s in stops if 'water' in s['amenities']])}")
    print(f"Shade zones: {len([s for s in stops if 'shade' in s['amenities']])}")
    print(f"Commercial: {len([s for s in stops if s['source'] == 'commercial'])}")
    
    # Save to file
    with open("data/stops_tempe_live.json", "w") as f:
        json.dump(stops, f, indent=2)
    
    print("\nSaved to data/stops_tempe_live.json")
    print("\nSample stops:")
    for stop in stops[:5]:
        print(f"  - {stop['name']} ({stop['source']}): {', '.join(stop['amenities'])}")
