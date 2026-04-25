# Track C Simplified Implementation for Tempe

## Context

**What we have NOW**:
- ✅ Backend fully functional (92 tests passing)
- ✅ Simple stubs that work for demo
- ✅ 18 hardcoded stops
- ✅ Hand-curated MRT zones
- ✅ Simple biosignal simulator

**What Track C SHOULD deliver** (per PRD):
- Realistic biosignal simulator with smooth transitions
- 200+ stops from Overpass API
- MRT raster from Cool Routes / Landsat
- Bike graph with MRT-weighted edges

**The Question**: What's the SIMPLEST way to implement Track C for Tempe only?

---

## 🎯 Simplified Track C Strategy

### Priority 1: SKIP (Already Good Enough)

**What to SKIP for hackathon**:
1. ❌ **Realistic biosignal simulator** - Current stub works fine
2. ❌ **MRT raster** - Hand-curated zones are sufficient
3. ❌ **Bike graph** - Mapbox routing works

**Why skip?**:
- Current stubs are demo-ready
- These are time-intensive
- No judge will notice the difference
- Can upgrade post-hackathon

### Priority 2: DO (High Impact, Low Effort)

**What to IMPLEMENT**:
1. ✅ **Overpass API for stops** (30 minutes)
2. ✅ **Align hydration rules** (15 minutes)
3. ✅ **Add start_session() to BioService** (5 minutes)

**Why do these?**:
- Overpass API: 200+ stops vs 18 (impressive!)
- Hydration rules: Align backend with Track C spec
- start_session(): Needed for mobile app flow

---

## 📋 Implementation Plan

### Task 1: Overpass API Integration (30 min)

**Goal**: Replace 18 hardcoded stops with 200+ live stops from OSM

**What to do**:
1. Keep current `stops_service.py` as fallback
2. Add `fetch_stops_from_overpass()` function
3. Cache results for 24h
4. Fallback to seed file if API fails

**Code location**: `backend/services/stops_service.py`

**Query**:
```python
query = f"""
[out:json][timeout:25];
(
  node["amenity"="drinking_water"]({bbox});
  node["amenity"="cafe"]({bbox});
  node["amenity"="convenience"]({bbox});
  node["amenity"="fuel"]({bbox});
  node["amenity"="shelter"]({bbox});
  node["highway"="bus_stop"]({bbox});
  node["amenity"="bicycle_repair_station"]({bbox});
);
out body;
"""
```

**Tempe bbox**: `(33.38, -111.95, 33.52, -111.85)`

**Acceptance**:
- Returns 200+ stops for Tempe
- Cache hit on second request
- Falls back to seed file if API down

### Task 2: Align Hydration Rules (15 min)

**Goal**: Match Track C's 6-rule system

**Current (10 rules)**:
```python
HR > 170 → +40
HR > 155 → +25
HR > 140 → +10
skin_temp > 38.0 → +30
skin_temp > 37.5 → +15
HRV < 20 → +20
HRV < 35 → +10
ride_minutes > 45 → +10
heat_index > 40 → +15
heat_index > 35 → +8
```

**Track C (6 rules)**:
```python
hr_delta > 30 → +2
hrv_ms < 20 → +2
skin_temp_c > 36 → +1
ambient_temp_c > 38 → +1
uv_index > 8 → +1
ride_minutes > 30 → +1
```

**Thresholds**:
- Current: 0-19 green, 20-44 yellow, 45+ red
- Track C: ≤2 green, ≤4 yellow, >4 red

**What to do**:
1. Update `backend/services/hydration_service.py`
2. Update tests in `backend/tests/test_hydration.py`
3. Keep personalized thresholds (adjust based on fitness level)

### Task 3: Add start_session() (5 min)

**Goal**: Add method Track C spec requires

**What to do**:
```python
def start_session(self, mode: BioMode = "baseline") -> str:
    """Create a new session and return session_id."""
    session_id = f"session_{len(self._sessions) + 1}"
    self._sessions[session_id] = {"mode": mode, "last_ts": None}
    logger.info("bio_service.start_session", session_id=session_id, mode=mode)
    return session_id
```

**Code location**: `backend/services/bio_service.py`

---

## 🚫 What NOT to Do

### DON'T: Build MRT Raster

**Why not?**:
- Requires Landsat 9 data from Microsoft Planetary Computer
- Requires rasterio + GDAL setup
- Requires blending LST + canopy + buildings
- Takes 2-3 hours minimum
- Current hand-curated zones work fine for demo

**Current solution is better for hackathon**:
- 9 zones (5 hot, 4 cool)
- Covers key Tempe areas
- Fast lookup (no raster I/O)
- Easy to understand

### DON'T: Build Realistic Biosignal Simulator

**Why not?**:
- Requires scipy for signal generation
- Requires smooth sigmoid transitions
- Requires Gaussian noise modeling
- Takes 1-2 hours
- Current random.uniform() works for demo

**Current solution is better for hackathon**:
- 3 modes work
- Values are realistic
- Instant response
- Easy to test

### DON'T: Build Bike Graph with OSMnx

**Why not?**:
- Requires OSMnx + NetworkX
- Requires graph building (5-10 min)
- Requires MRT-weighted Dijkstra
- Takes 2-3 hours
- Mapbox routing works fine

**Current solution is better for hackathon**:
- Mapbox handles routing
- We just annotate with MRT
- Fast and reliable
- No graph management

---

## 📊 Effort vs Impact Analysis

| Task | Effort | Impact | Do It? |
|------|--------|--------|--------|
| Overpass API | 30 min | HIGH (200+ stops!) | ✅ YES |
| Align hydration rules | 15 min | MEDIUM (spec compliance) | ✅ YES |
| Add start_session() | 5 min | LOW (API completeness) | ✅ YES |
| MRT raster | 2-3 hours | LOW (zones work fine) | ❌ NO |
| Realistic biosignal | 1-2 hours | LOW (current works) | ❌ NO |
| Bike graph | 2-3 hours | LOW (Mapbox works) | ❌ NO |

**Total effort for recommended tasks**: **50 minutes**

---

## 🎯 Recommended Implementation Order

### Step 1: Overpass API (30 min)

**Why first?**: Highest impact, most impressive for demo

**Implementation**:
1. Copy `scripts/fetch_stops_example.py` logic
2. Add to `backend/services/stops_service.py`
3. Add caching (24h TTL)
4. Add fallback to seed file
5. Test with Tempe bbox

**Expected result**: 200+ stops instead of 18

### Step 2: Align Hydration Rules (15 min)

**Why second?**: Spec compliance, easy to do

**Implementation**:
1. Update `classify()` method
2. Update thresholds
3. Update tests
4. Run test suite

**Expected result**: 6-rule system matching Track C spec

### Step 3: Add start_session() (5 min)

**Why last?**: Lowest impact, quick win

**Implementation**:
1. Add method to BioService
2. Add test
3. Update router if needed

**Expected result**: Complete API matching Track C spec

---

## 🚀 What This Gets You

### Before (Current):
- 18 hardcoded stops
- 10-rule hydration system (not matching spec)
- No start_session() method

### After (50 minutes of work):
- **200+ live stops from OSM** ← IMPRESSIVE!
- **6-rule system matching spec** ← COMPLIANT!
- **Complete API** ← PROFESSIONAL!

### Still Using (and that's OK):
- Hand-curated MRT zones (9 zones)
- Simple biosignal simulator (random.uniform)
- Mapbox routing (no custom graph)

---

## 💡 Key Insights

### 1. Stubs Are Not Failures

The PRD says:
> "AWS judges care about *thinking* and *architecture*, not whether you wrote Swift."

Same applies to Track C:
- Judges care about the SYSTEM DESIGN
- Not whether you built a perfect MRT raster
- Current stubs show you understand the architecture

### 2. Overpass API is the Win

**Why it matters**:
- 200+ stops vs 18 (10x improvement!)
- Live data (not hardcoded)
- Shows you can integrate external APIs
- Impressive in demo

**Why it's easy**:
- Free, no API key
- Simple HTTP POST
- We already have the code (in scripts/)
- Just move it to the service

### 3. Spec Alignment Shows Discipline

**Why it matters**:
- Track C spec says 6 rules
- Backend has 10 rules
- Aligning shows you read the spec
- Shows team coordination

**Why it's easy**:
- Just update the scoring logic
- Update tests
- 15 minutes max

---

## 📝 Summary

### DO (50 minutes total):
1. ✅ Overpass API integration (30 min) - HIGH IMPACT
2. ✅ Align hydration rules (15 min) - MEDIUM IMPACT
3. ✅ Add start_session() (5 min) - LOW IMPACT

### DON'T (saves 6-8 hours):
1. ❌ MRT raster - zones work fine
2. ❌ Realistic biosignal - current works
3. ❌ Bike graph - Mapbox works

### Result:
- **Track C "complete enough" for hackathon**
- **200+ stops (impressive!)**
- **Spec-compliant hydration rules**
- **6-8 hours saved for mobile app**

---

## 🎬 Next Steps

**If you want to implement Track C**:

1. **Now**: Implement Overpass API (30 min)
   - Highest impact
   - Most impressive for demo
   - Easy to do

2. **Then**: Align hydration rules (15 min)
   - Spec compliance
   - Shows discipline

3. **Finally**: Add start_session() (5 min)
   - API completeness
   - Quick win

**Total time**: 50 minutes
**Total impact**: HIGH

**If you DON'T want to implement Track C**:
- Current stubs are FINE for hackathon
- Focus on mobile app instead
- Track C can wait until post-hackathon

---

## 🏆 Bottom Line

**Simplest Track C for Tempe**:
- ✅ Overpass API (30 min) - DO THIS
- ✅ Align rules (15 min) - DO THIS
- ✅ Add start_session (5 min) - DO THIS
- ❌ Everything else - SKIP IT

**Total effort**: 50 minutes
**Total impact**: HIGH
**Time saved**: 6-8 hours

**Current stubs are good enough for hackathon!**
