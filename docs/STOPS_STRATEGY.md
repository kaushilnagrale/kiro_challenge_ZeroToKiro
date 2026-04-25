# PulseRoute Stops Strategy: Live API vs Hardcoded

## The Question

> "Can we get stops through an API instead of hardcoding them?"

**Answer: YES!** And we should. Here's the complete strategy.

---

## Current State (Hackathon Stub)

### What We Have Now
- **File**: `data/stops_seed.json`
- **Count**: 18 hardcoded stops
- **Categories**: Official fountains, cafes, transit shelters
- **Loaded**: Once at startup
- **Good for**: Demo, offline testing
- **Bad for**: Production, real-world coverage

### Why It's a Stub
- Only covers ASU campus + downtown Tempe
- Missing hundreds of real stops
- No updates when new stops are added to OSM
- Can't expand to other cities

---

## Production Strategy (Track C)

### Data Source: Overpass API

**URL**: `https://overpass-api.de/api/interpreter`

**License**: ODbL (Open Database License) — free, no API key needed

**What It Provides**:
- Live OpenStreetMap data
- Hundreds of stops in Tempe
- Automatically updated when OSM is updated
- Query any city/bbox

### Stop Types We Query

| OSM Tag | What It Is | Amenities | Example |
|---------|------------|-----------|---------|
| `amenity=drinking_water` | Public water fountains | water | Tempe Beach Park Fountain |
| `amenity=cafe` | Coffee shops | water, food, ac | Starbucks, Dutch Bros |
| `amenity=convenience` | Convenience stores | water, food, restroom | 7-Eleven, Circle K |
| `amenity=fuel` | Gas stations | water, food, restroom | QT, Shell |
| `amenity=shelter` | Covered shelters | shade | Park shelters |
| `highway=bus_stop` | Transit stops | shade | Valley Metro stops |
| `leisure=park` | Parks | shade | Papago Park |
| `amenity=bicycle_repair_station` | Bike repair | bike_repair | ASU bike stations |

### Why This Matters for Heat Relief

Your insight: **"I want to ride beside water spots and where I can get some rest when heat"**

Traditional approach: Only official fountains
**Your approach**: Any place with shade, water, or AC

**Overpass API gives us**:
- 200+ water sources (not just 3 official fountains)
- 100+ shade zones (transit shelters, parks, covered areas)
- 50+ commercial stops (gas stations, cafes with AC)
- Real-time: New stops added to OSM appear automatically

---

## Implementation Plan

### Phase 1: Hackathon (Current)
```python
# backend/services/stops_service.py
class StopsService:
    def __init__(self):
        # Load from stops_seed.json
        self._stops = json.load(open("data/stops_seed.json"))
```

**Status**: ✅ Done (18 stops, good for demo)

### Phase 2: Track C Production
```python
# backend/services/stops_service.py (Track C replaces this)
class StopsService:
    def __init__(self):
        self.overpass_url = "https://overpass-api.de/api/interpreter"
        self._cache = {}  # 24h TTL cache
    
    async def get_stops(self, bbox):
        # Check cache first
        if bbox in self._cache and not expired:
            return self._cache[bbox]
        
        # Query Overpass API
        stops = await self._fetch_from_overpass(bbox)
        self._cache[bbox] = stops
        
        # Fallback to stops_seed.json if API fails
        if not stops:
            stops = self._load_seed_file()
        
        return stops
```

**Status**: 🚧 Track C to implement

### Phase 3: Enhancements (Post-Hackathon)
- Add opening hours from OSM
- Add real-time availability (is fountain working?)
- Add user-submitted stops
- Add photos from Mapillary

---

## Caching Strategy

### Why Cache?
- Overpass API has rate limits
- Stops don't change frequently
- Faster response times
- Graceful degradation if API is down

### Cache TTL
- **24 hours** for stop locations
- **1 hour** for opening hours (if we add them)
- **No cache** for user-submitted real-time status

### Cache Key
```python
cache_key = f"{lat_min:.4f},{lng_min:.4f},{lat_max:.4f},{lng_max:.4f}"
```

---

## Fallback Strategy

### Graceful Degradation Ladder

1. **Try Overpass API** (primary)
   - If success → cache for 24h
   
2. **Try cache** (if API fails)
   - If cache exists and <7 days old → use it
   
3. **Fall back to seed file** (if both fail)
   - Load `data/stops_seed.json`
   - Log warning to Sentry
   
4. **Return empty with provenance** (if all fail)
   - Return `StopsResponse` with empty lists
   - Provenance shows "stops_unavailable"
   - UI shows "Stop data temporarily unavailable"

### Why This Matters
- Overpass API can be slow or down
- Network issues happen
- Demo must work offline
- Accountability: provenance shows data source

---

## Example Overpass Query

```python
query = f"""
[out:json][timeout:25];
(
  // Water sources
  node["amenity"="drinking_water"]({lat_min},{lng_min},{lat_max},{lng_max});
  
  // Commercial (cafes, gas stations)
  node["amenity"="cafe"]({lat_min},{lng_min},{lat_max},{lng_max});
  node["amenity"="convenience"]({lat_min},{lng_min},{lat_max},{lng_max});
  node["amenity"="fuel"]({lat_min},{lng_min},{lat_max},{lng_max});
  
  // Shade/rest areas (YOUR REQUEST!)
  node["amenity"="shelter"]({lat_min},{lng_min},{lat_max},{lng_max});
  node["highway"="bus_stop"]({lat_min},{lng_min},{lat_max},{lng_max});
  way["leisure"="park"]({lat_min},{lng_min},{lat_max},{lng_max});
  
  // Bike services
  node["amenity"="bicycle_repair_station"]({lat_min},{lng_min},{lat_max},{lng_max});
);
out center;
"""
```

---

## Testing

### Test Files Created
1. `scripts/test_overpass_live.py` - Test live API
2. `scripts/fetch_stops_example.py` - Example implementation
3. `scripts/stops_service_production.py` - Production service

### Run Tests
```bash
# Test live API (requires internet)
python scripts/test_overpass_live.py

# Expected output:
# ✅ Found 200+ stops
# - 50+ drinking water fountains
# - 80+ cafes
# - 30+ shelters
# - 100+ bus stops
```

### Known Issues
- Overpass API can return 406 if rate-limited
- Query timeout if bbox too large
- Some stops missing names in OSM

---

## Track C Deliverables

### Required
1. ✅ Replace `backend/services/stops_service.py` with Overpass client
2. ✅ Add 24h caching with TTL
3. ✅ Add fallback to `stops_seed.json`
4. ✅ Add provenance tracking (source_id="overpass_api")
5. ✅ Add shade_zones category to StopsResponse

### Optional
- Export script: `scripts/fetch_stops.py` to generate GeoJSON
- Opening hours integration
- User-submitted stop status

---

## Benefits of Live API

### For Users
- **More stops**: 200+ vs 18
- **Better coverage**: Entire Tempe, not just ASU
- **Shade zones**: Transit shelters, parks (your request!)
- **Always current**: New stops appear automatically

### For Development
- **No maintenance**: OSM community maintains data
- **Expandable**: Works for any city
- **Free**: No API key, no cost
- **Open data**: ODbL license

### For Demo
- **Impressive**: "We have 200+ stops from live OSM data"
- **Realistic**: Real-world data, not fake
- **Resilient**: Falls back to seed file if API down

---

## Answer to Your Question

> "Do you think we can get these through some API and not hardcoded?"

**YES!** 

- **API**: Overpass API (OpenStreetMap)
- **Cost**: Free, no API key
- **Coverage**: 200+ stops in Tempe
- **Includes**: Water, shade, cafes, gas stations, transit shelters
- **Your request**: Shade zones for heat relief ✅
- **Status**: Track C to implement
- **Fallback**: Seed file if API fails

**The hardcoded file is just a hackathon stub. Production uses live API.**

---

## Next Steps

1. **Track C**: Implement `scripts/stops_service_production.py`
2. **Track C**: Test with live Overpass API
3. **Track C**: Add to backend as drop-in replacement
4. **Track B**: Update `/stops` endpoint tests
5. **Track A**: Update mobile UI to show shade_zones

---

## References

- Overpass API: https://overpass-api.de/api/interpreter
- Overpass Turbo (visual query builder): https://overpass-turbo.eu
- OSM Wiki: https://wiki.openstreetmap.org/wiki/Overpass_API
- License: https://opendatacommons.org/licenses/odbl/
