"""
On-spec-change hook: regenerates the "Spec Overview" section of README.md
from the current .kiro/specs/*.md files.

Run: python scripts/sync_readme.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SPECS_DIR = Path(".kiro/specs")
README    = Path("README.md")

SECTION_START = "<!-- SPEC-OVERVIEW-START -->"
SECTION_END   = "<!-- SPEC-OVERVIEW-END -->"


def build_section() -> str:
    lines = [SECTION_START, ""]
    specs = sorted(SPECS_DIR.glob("*.md"))
    if not specs:
        lines.append("_No specs found in .kiro/specs/_")
    for spec in specs:
        content = spec.read_text(encoding="utf-8")
        first_heading = next(
            (l.lstrip("# ").strip() for l in content.splitlines() if l.startswith("# ")),
            spec.stem,
        )
        goal_match = re.search(r"## Goal\n(.+?)(?:\n##|\Z)", content, re.DOTALL)
        goal = goal_match.group(1).strip().split("\n")[0] if goal_match else ""
        lines.append(f"### [{first_heading}](.kiro/specs/{spec.name})")
        if goal:
            lines.append(f"> {goal}")
        lines.append("")

    lines.append(SECTION_END)
    return "\n".join(lines)


def main() -> int:
    if not README.exists():
        print("sync_readme: README.md not found — skipping")
        return 0

    readme_text = README.read_text(encoding="utf-8")

    if SECTION_START not in readme_text:
        print("sync_readme: no SPEC-OVERVIEW markers in README.md — skipping")
        return 0

    new_section = build_section()
    pattern = re.compile(
        re.escape(SECTION_START) + r".*?" + re.escape(SECTION_END),
        re.DOTALL,
    )
    updated = pattern.sub(new_section, readme_text)

    if updated == readme_text:
        print("sync_readme: README already up to date")
        return 0

    README.write_text(updated, encoding="utf-8")
    print(f"sync_readme: updated README.md spec overview ({len(specs := sorted(SPECS_DIR.glob('*.md')))} specs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
