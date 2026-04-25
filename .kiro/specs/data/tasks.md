# Track C Data Implementation Tasks

## Task 1: Biosignal Simulator Module (30 min) ⭐ CRITICAL

### Goal
Create realistic time-series biosignal simulator to replace random.uniform() stub.

### Sub-tasks
- [ ] 1.1 Create `backend/bio_sim.py` module with session management
- [ ] 1.2 Implement signal generators (HR, HRV, skin_temp) with physiological curves
- [ ] 1.3 Add smooth transition logic (sigmoid/exponential) for mode changes
- [ ] 1.4 Add Gaussian noise to all signals
- [ ] 1.5 Integrate into `BioService.get_current()` - replace random.uniform()
- [ ] 1.6 Create demo script showing 60s time-series with mode transitions
- [ ] 1.7 Test: Verify smooth transitions, no sudden jumps, values in range

### Acceptance
- [ ] Demo script shows realistic HR/HRV/skin-temp curves
- [ ] Mode transitions are smooth (30-60s sigmoid curves)
- [ ] BioService uses bio_sim instead of random.uniform()
- [ ] All values stay within physiological ranges

---

## Task 2: Live Stops API Integration (30 min) ⭐ HIGH IMPACT

### Goal
Replace 18 hardcoded stops with 200+ real stops from Overpass API.

### Sub-tasks
- [ ] 2.1 Add Overpass API client method to StopsService
- [ ] 2.2 Build Overpass QL query for Tempe bbox with all amenity tags
- [ ] 2.3 Parse Overpass JSON response to Stop objects
- [ ] 2.4 Add 24h in-memory cache (key: bbox+amenity)
- [ ] 2.5 Add fallback to stops_seed.json if API times out (>5s)
- [ ] 2.6 Update categorization to include shade_zones
- [ ] 2.7 Test: Verify ≥200 stops returned, cache works, fallback works

### Acceptance
- [ ] Live API returns ≥200 stops for Tempe bbox
- [ ] Cache hit on second request (verify with logs)
- [ ] Graceful degradation to seed file if API fails
- [ ] shade_zones category populated with parks/shelters/bus stops

---

## Task 3: Hydration Classifier Documentation (15 min)

### Goal
Document current 10-rule system vs Track C 6-rule spec.

### Sub-tasks
- [ ] 3.1 Add docstring to HydrationService.classify() explaining rule system
- [ ] 3.2 Create comparison table: current 10 rules vs Track C 6 rules
- [ ] 3.3 Document decision to keep current system (more sophisticated)
- [ ] 3.4 Verify 100% test coverage still passing

### Acceptance
- [ ] Docstring explains all 10 rules with point values
- [ ] Comparison table shows both systems
- [ ] All tests passing (92 tests)

---

## Task 4: Demo Integration Testing (15 min)

### Goal
End-to-end test of biosignal simulator → classifier → risk score changes.

### Sub-tasks
- [ ] 4.1 Create demo script: toggle mode baseline → moderate → dehydrating
- [ ] 4.2 Verify risk score changes: green → yellow → red
- [ ] 4.3 Verify stops API returns shade_zones
- [ ] 4.4 Test full flow: /bio/current → /risk → /stops

### Acceptance
- [ ] Demo shows smooth biosignal transitions
- [ ] Risk score changes appropriately with mode
- [ ] Stops API returns 200+ stops with shade zones
- [ ] All endpoints working together

---

## Estimated Total Time: 90 minutes (1.5 hours)

**Priority order**: Task 1 → Task 2 → Task 4 → Task 3
