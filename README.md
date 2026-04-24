# PulseRoute

**A mobile co-pilot for cyclists in hot cities.** PulseRoute plans the coolest
and safest route between two points, monitors rider biosignals from a
smartwatch (real or simulated), and proactively suggests cool-down stops
before heat illness hits.

Built for the **Kiro Spark Challenge** at ASU, April 24, 2026.

---

## The problem

Phoenix recorded 645 heat-related deaths in 2023. Cyclists are uniquely
exposed — existing navigation apps optimize for distance, not thermal
exposure or rider physiology. A cyclist following the shortest path through
Tempe at 3 PM in July may unknowingly ride into a 60°C mean radiant
temperature corridor with no water access for two kilometers.

PulseRoute closes this gap.

## What makes it different

Three signals fused into one consumer app for the first time:

1. **Environmental** — Mean Radiant Temperature, shade coverage, heat advisories
2. **Infrastructural** — Water fountains, shaded rest stops, cafes, bike repair
3. **Physiological** — Heart rate, HRV, skin temperature → hydration risk score

When the model detects elevated risk, it suggests the right stop at the right
moment. Every recommendation carries a `provenance` object citing its sources.
If any source is unavailable, the app refuses to fabricate — it tells the user.

## The Accountability Logic Gate

Our environment-frame guardrail is a literal piece of code, not a slogan.
`backend/safety.py::validate_safety_alert()` refuses to render any safety
alert unless biosignal, environmental, and route data are all present and
fresh. This file has 100% branch coverage in its tests.

## Repo structure