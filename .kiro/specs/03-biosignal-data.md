# Spec: Biosignal Simulator + Data Pipeline

## Biosignal simulator

Python module `backend/bio_sim.py` exposing:

```python
simulator.start_session(mode: "baseline"|"moderate"|"dehydrating") -> session_id
simulator.get_current(session_id) -> BioReading(hr, hrv, skin_temp_c, timestamp, mode)
```

### Realistic dynamics

| Signal      | Baseline  | Moderate exertion | Dehydrating           |
|-------------|-----------|-------------------|-----------------------|
| HR (bpm)    | 65 ± 5    | +30 ramp over 5m  | +25 + 15 dehydration  |
| HRV (ms)    | 50 ± 3    | -20 ramp          | -15 ramp -25 dehyd    |
| Skin °C     | 33 ± 0.2  | +2.5 ramp         | +2.0 + 3.5 dehyd      |

- Gaussian noise on all signals (small sigma)
- Smooth transition curves using `min(t/ramp_time, 1.0)` — no step changes
- All signals clamped to physiological ranges: HR 40–200, HRV 5–100, skin 30–40

## Stops dataset

Use Overpass API for bbox covering Tempe + downtown Phoenix:
- `amenity=drinking_water` → water fountains
- `amenity=bicycle_repair_station` → bike repair stations
- `amenity=cafe` → cafes for longer-ride stops

Falls back to curated mock dataset with 8 fountains, 4 cafes, 2 repair
stations located at realistic Tempe landmarks.

## MRT proxy

Since precomputed ASU Cool Routes rasters require direct contact with
Ariane Middel's team, Phase 1 uses a synthetic MRT proxy:

- **Fastest route** gets `peak_mrt_c = 58.5°C` (exposed University Dr)
- **PulseRoute** gets `peak_mrt_c = 41.2°C` (campus trees + Apache Blvd)
- MRT differential = 17.3°C — cited as core product value in the pitch

Phase 2 will wire Landsat 9 thermal band (LST) + Sentinel-2 NDVI canopy
proxy + building footprints with Middel et al. published weights.

## Acceptance

- `bio_sim`: print 60s of synthetic data, signals vary smoothly
- Stops dataset: returns > 8 fountains within Tempe bbox
- MRT values produce meaningful differentiation between route types
- All three simulator modes produce visually distinct biosignal traces
