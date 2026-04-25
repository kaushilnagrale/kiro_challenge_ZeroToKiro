# How PulseRoute Decides When You Need Water/Rest

## Your Question

> "How do we decide if a person requires water? Are we doing ML prediction based on previous fitness levels?"

## Short Answer

**NO ML. Rule-based system using real-time biosignals + weather.**

We use a **point-scoring system** that combines:
1. **Your body's signals** (heart rate, HRV, skin temp) from smartwatch
2. **Environmental conditions** (heat index, temperature)
3. **Ride context** (how long you've been riding)

---

## The Decision System

### Input Data (3 Sources)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BIOSIGNAL (from smartwatch or simulator)                │
│    - Heart Rate (HR): 72 bpm                               │
│    - Heart Rate Variability (HRV): 62 ms                   │
│    - Skin Temperature: 36.4°C                              │
│    - Timestamp: when measured                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. WEATHER (from Open-Meteo + NWS)                         │
│    - Ambient Temperature: 35°C                             │
│    - Heat Index: 37°C (feels-like temp)                    │
│    - Humidity: 20%                                         │
│    - UV Index: 9                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. RIDE CONTEXT (from app)                                 │
│    - Ride Duration: 20 minutes                             │
│    - Current Location: lat/lng                             │
│    - Baseline HR: 65 bpm (your resting rate)               │
└─────────────────────────────────────────────────────────────┘
```

### Point Scoring Rules (Current Backend - 10 Rules)

```python
# HEART RATE (higher = more stress)
if HR > 170 bpm:        +40 points  # CRITICAL
elif HR > 155 bpm:      +25 points  # VERY HIGH
elif HR > 140 bpm:      +10 points  # ELEVATED

# SKIN TEMPERATURE (higher = overheating)
if skin_temp > 38.0°C:  +30 points  # CRITICAL
elif skin_temp > 37.5°C: +15 points  # ELEVATED

# HEART RATE VARIABILITY (lower = more stress)
if HRV < 20 ms:         +20 points  # CRITICAL
elif HRV < 35 ms:       +10 points  # LOW

# RIDE DURATION (longer = more fatigue)
if ride_minutes > 45:   +10 points  # EXTENDED

# HEAT INDEX (environmental stress)
if heat_index > 40°C:   +15 points  # EXTREME
elif heat_index > 35°C:  +8 points  # HIGH
```

### Risk Level Thresholds

```
┌──────────────────────────────────────────────────────────┐
│ TOTAL POINTS → RISK LEVEL → ACTION                      │
├──────────────────────────────────────────────────────────┤
│ 0-19 points  → 🟢 GREEN  → "You're good, keep riding"   │
│ 20-44 points → 🟡 YELLOW → "Consider a water break"     │
│ 45+ points   → 🔴 RED    → "Stop now, find shade/water" │
└──────────────────────────────────────────────────────────┘
```

---

## Real-World Examples

### Example 1: Healthy Baseline (GREEN)

**Scenario**: Morning ride, cool weather, feeling good

```
Biosignal:
  HR: 72 bpm          → 0 points (normal)
  HRV: 62 ms          → 0 points (healthy)
  Skin temp: 36.4°C   → 0 points (normal)

Weather:
  Heat index: 32°C    → 0 points (comfortable)

Ride:
  Duration: 20 min    → 0 points (short)

TOTAL: 0 points → 🟢 GREEN
Message: "All metrics within normal range"
```

### Example 2: Moderate Stress (YELLOW)

**Scenario**: Afternoon ride, hot day, working hard

```
Biosignal:
  HR: 145 bpm         → +10 points (elevated)
  HRV: 32 ms          → +10 points (low)
  Skin temp: 37.0°C   → 0 points

Weather:
  Heat index: 37°C    → +8 points (high)

Ride:
  Duration: 30 min    → 0 points

TOTAL: 28 points → 🟡 YELLOW
Message: "Heart rate elevated (145 bpm)"
Action: Show nearby water stops, suggest break
```

### Example 3: Dehydration Risk (RED)

**Scenario**: Long ride, extreme heat, body struggling

```
Biosignal:
  HR: 168 bpm         → +25 points (very high)
  HRV: 19 ms          → +20 points (critically low)
  Skin temp: 38.2°C   → +30 points (critically high)

Weather:
  Heat index: 37°C    → +8 points (high)

Ride:
  Duration: 50 min    → +10 points (extended)

TOTAL: 93 points → 🔴 RED
Message: "Skin temperature critically high (38.2°C)"
Action: URGENT - Navigate to nearest stop, send notification
```

---

## Why Rule-Based, Not ML?

### Advantages of Rules

✅ **Explainable**: "Your HR is 168 bpm, that's why we're alerting"
✅ **No training data needed**: Works day 1
✅ **Deterministic**: Same inputs = same output
✅ **Fast**: No model inference latency
✅ **Auditable**: Can verify every decision
✅ **Medical basis**: Rules based on physiology research

### Why NOT ML?

❌ **Need training data**: Would need thousands of rides with outcomes
❌ **Black box**: Can't explain "why" to user
❌ **Liability**: Hard to audit for safety-critical decisions
❌ **Overfitting**: Might learn spurious patterns
❌ **Complexity**: Overkill for well-understood physiology

### The Science Behind the Rules

The thresholds are based on:
- **HR zones**: 140+ = vigorous exercise, 170+ = max effort
- **HRV**: <20ms indicates high stress/fatigue
- **Skin temp**: >38°C indicates thermoregulation failure
- **Heat index**: >35°C = extreme caution, >40°C = danger

---

## What About Fitness Levels?

### Current System (Hackathon)

**No personalization yet.** Rules are the same for everyone.

### Future Enhancement (Post-Hackathon)

**Personalized baseline** using:

```python
# Store user's baseline metrics
user_profile = {
    "resting_hr": 58,      # Athlete vs 72 (average)
    "max_hr": 185,         # Age-based formula
    "fitness_level": "high" # low/medium/high
}

# Adjust thresholds based on fitness
if fitness_level == "high":
    hr_threshold = baseline_hr + 80  # Allow higher HR
else:
    hr_threshold = baseline_hr + 60  # More conservative
```

**How it would work**:
1. **Onboarding**: User does 5-minute baseline test
2. **Learning**: App tracks your typical HR/HRV over first week
3. **Personalization**: Thresholds adjust to YOUR normal
4. **Adaptation**: System learns your patterns over time

**Example**:
- **Athlete** (resting HR 55): Alert at HR 160
- **Average** (resting HR 72): Alert at HR 145
- **Beginner** (resting HR 85): Alert at HR 130

---

## Track C's 6-Rule System (Simpler)

Track C spec proposes a **simpler 6-rule system**:

```python
# Track C Rules (0-8 points max)
if hr_delta > 30:       +2 points  # HR above baseline
if hrv_ms < 20:         +2 points  # Low HRV
if skin_temp > 36:      +1 point   # Elevated skin temp
if ambient_temp > 38:   +1 point   # Hot weather
if uv_index > 8:        +1 point   # High UV
if ride_minutes > 30:   +1 point   # Extended ride

# Thresholds
0-2 points  → GREEN
3-4 points  → YELLOW
5+ points   → RED
```

**Simpler but less granular.** We need to decide which to use.

---

## The Accountability Logic Gate

**CRITICAL**: Before ANY alert reaches the user, it passes through `validate_safety_alert()`:

```python
def validate_safety_alert(alert: SafetyAlert) -> bool:
    """
    The gate. No alert reaches UI without passing these checks.
    """
    # 1. Bio data exists and is fresh (<60s old)
    if alert.provenance.bio_source is None:
        return False
    if alert.provenance.bio_source.age_seconds > 60:
        return False
    
    # 2. Weather data exists and is fresh (<30min old)
    if alert.provenance.env_source is None:
        return False
    if alert.provenance.env_source.age_seconds > 1800:
        return False
    
    # 3. Route segment is specified
    if alert.provenance.route_segment_id is None:
        return False
    
    return True
```

**Why this matters**:
- Never alert based on stale data
- Never alert without knowing WHERE you are
- Every alert is traceable to source data
- If gate fails → show "Sensor data unavailable" instead

---

## Summary

### How We Decide

1. **Collect** real-time biosignals (HR, HRV, skin temp)
2. **Collect** weather data (heat index, temp)
3. **Collect** ride context (duration, location)
4. **Score** using 10 rules (or 6 in Track C version)
5. **Classify** as green/yellow/red
6. **Validate** through safety gate
7. **Alert** user with specific reason

### No ML Because

- Rules are explainable
- No training data needed
- Deterministic and auditable
- Based on physiology research
- Fast and reliable

### Future Personalization

- Learn YOUR baseline over time
- Adjust thresholds to YOUR fitness
- Track patterns in YOUR rides
- Still rule-based, just personalized rules

---

## Code Location

- **Current classifier**: `backend/services/hydration_service.py`
- **Track C spec**: `.kiro/specs/data/requirements.md` (FR-C2)
- **Tests**: `backend/tests/test_hydration.py` (10 tests, 100% coverage)
- **Safety gate**: `backend/safety.py`

---

## The Bottom Line

**We use your body's signals + weather + ride duration to calculate a risk score.**

**No ML. Just smart rules based on physiology.**

**Every decision is explainable: "Your HR is 168 bpm, that's why we're alerting."**

**Future: Personalize thresholds to YOUR fitness level, but still rule-based.**
