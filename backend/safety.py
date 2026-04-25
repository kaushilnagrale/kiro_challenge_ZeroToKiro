"""
SafetyGate — Accountability Logic Gate for PulseRoute.

Function: validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None

The gate enforces provenance requirements before any safety alert reaches the UI:
1. bio_source is not None
2. bio_source.age_seconds < 60
3. env_source is not None
4. env_source.age_seconds < 1800
5. route_segment_id is not None

If all pass: log success + return alert.
If any fail: log failure with reason + return None.

Every gate decision is logged via structlog with fields:
- result: "pass" or "fail"
- rule_failed: which rule failed (if any)
- session context (if available)

Owner: Track B (Sai)
Status: Production — non-negotiable demo centerpiece
"""

import structlog

from shared.schema import SafetyAlert

logger = structlog.get_logger()


def validate_safety_alert(alert: SafetyAlert) -> SafetyAlert | None:
    """
    Validate a SafetyAlert candidate against the Accountability Logic Gate.

    Returns the alert if all provenance checks pass, None otherwise.
    Every decision is logged with structlog.
    """
    prov = alert.provenance

    # Rule 1: bio_source is not None
    if prov.bio_source is None:
        logger.warning(
            "safety_gate.fail",
            result="fail",
            rule_failed="bio_source_missing",
            alert_message=alert.message,
        )
        return None

    # Rule 2: bio_source.age_seconds < 60
    if prov.bio_source.age_seconds >= 60:
        logger.warning(
            "safety_gate.fail",
            result="fail",
            rule_failed="bio_source_too_old",
            age_seconds=prov.bio_source.age_seconds,
            alert_message=alert.message,
        )
        return None

    # Rule 3: env_source is not None
    if prov.env_source is None:
        logger.warning(
            "safety_gate.fail",
            result="fail",
            rule_failed="env_source_missing",
            alert_message=alert.message,
        )
        return None

    # Rule 4: env_source.age_seconds < 1800
    if prov.env_source.age_seconds >= 1800:
        logger.warning(
            "safety_gate.fail",
            result="fail",
            rule_failed="env_source_too_old",
            age_seconds=prov.env_source.age_seconds,
            alert_message=alert.message,
        )
        return None

    # Rule 5: route_segment_id is not None
    if prov.route_segment_id is None:
        logger.warning(
            "safety_gate.fail",
            result="fail",
            rule_failed="route_segment_id_missing",
            alert_message=alert.message,
        )
        return None

    # All checks passed
    logger.info(
        "safety_gate.pass",
        result="pass",
        alert_message=alert.message,
        bio_age=prov.bio_source.age_seconds,
        env_age=prov.env_source.age_seconds,
        segment_id=prov.route_segment_id,
    )
    return alert
