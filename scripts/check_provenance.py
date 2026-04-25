"""
Pre-commit hook: scans staged Python files and fails if any function
returns a SafetyAlert or Route without a provenance field.

This is the Accountability Logic Gate at the development-workflow level.
Run: python scripts/check_provenance.py
"""
from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

SENTINEL_TYPES = {"SafetyAlert", "RouteObj", "RouteResponse", "RiskResponse"}


def get_staged_python_files() -> list[Path]:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        capture_output=True, text=True,
    )
    return [
        Path(f) for f in result.stdout.splitlines()
        if f.endswith(".py") and Path(f).exists()
    ]


def has_provenance(node: ast.Return) -> bool:
    """Check whether a Return node that returns a model call includes provenance."""
    value = node.value
    if not isinstance(value, ast.Call):
        return True  # not a direct model call — skip
    func_name = ""
    if isinstance(value.func, ast.Name):
        func_name = value.func.id
    elif isinstance(value.func, ast.Attribute):
        func_name = value.func.attr

    if func_name not in SENTINEL_TYPES:
        return True

    # Check for provenance keyword argument
    for kw in value.keywords:
        if kw.arg == "provenance":
            return True
    return False


def check_file(path: Path) -> list[str]:
    violations: list[str] = []
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:
        return []

    for node in ast.walk(tree):
        if isinstance(node, ast.Return) and not has_provenance(node):
            violations.append(
                f"{path}:{node.lineno} — returns sentinel type without `provenance=`"
            )
    return violations


def main() -> int:
    staged = get_staged_python_files()
    if not staged:
        print("check_provenance: no staged Python files — OK")
        return 0

    all_violations: list[str] = []
    for path in staged:
        all_violations.extend(check_file(path))

    if all_violations:
        print("\n❌ Accountability Logic Gate: provenance check FAILED\n")
        for v in all_violations:
            print(f"  {v}")
        print(
            "\nEvery SafetyAlert, RouteObj, RouteResponse, and RiskResponse "
            "must include a `provenance=` argument. See backend/safety.py.\n"
        )
        return 1

    print(f"check_provenance: checked {len(staged)} file(s) — OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
