#!/usr/bin/env python3
"""
Smoke Validation: Verify data artifacts meet schema & sanity expectations.

Checks:
  1. unified_knowledge.json — required keys, entity counts, coordinate format, year ranges
  2. segment_year_index.json — segment count, year monotonicity
  3. juan_year_index.json — 294 juans, year range sanity

Usage:
  python scripts/smoke_validate.py
  python scripts/smoke_validate.py --fail   # Exit non-zero on any error
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Tuple

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


class ValidationResult:
    def __init__(self, name: str):
        self.name = name
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def error(self, msg: str):
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def report(self) -> str:
        lines = [f"--- {self.name} ---"]
        if self.ok and not self.warnings:
            lines.append("  PASS")
        for w in self.warnings:
            lines.append(f"  WARN: {w}")
        for e in self.errors:
            lines.append(f"  FAIL: {e}")
        return "\n".join(lines)


def validate_unified_kb() -> ValidationResult:
    """Validate unified_knowledge.json."""
    r = ValidationResult("unified_knowledge.json")
    path = DATA_DIR / "unified_knowledge.json"

    if not path.exists():
        r.error(f"File not found: {path}")
        return r

    with open(path, "r", encoding="utf-8") as f:
        kb = json.load(f)

    # Required top-level keys
    required_keys = [
        "roles",
        "locations",
        "events",
        "relations",
        "polities",
        "organizations",
        "schools",
        "name_to_role_id",
        "name_to_location_id",
        "total_roles",
        "total_events",
        "total_relations",
        "juans_processed",
        "last_updated",
    ]
    for key in required_keys:
        if key not in kb:
            r.error(f"Missing required key: {key}")

    # Entity counts match
    for entity_type in [
        "roles",
        "locations",
        "events",
        "relations",
        "polities",
        "organizations",
        "schools",
    ]:
        data = kb.get(entity_type, {})
        count_key = f"total_{entity_type}"
        if count_key in kb and isinstance(data, dict):
            actual = len(data)
            expected = kb[count_key]
            if actual != expected:
                r.error(
                    f"{count_key}={expected} but actual {entity_type} count={actual}"
                )

    # Coordinate format: [lng, lat] where lng∈[-180,180], lat∈[-90,90]
    locations = kb.get("locations", {})
    coord_count = 0
    for loc_id, loc in locations.items():
        if not isinstance(loc, dict):
            continue
        coords = loc.get("coordinates")
        if coords is None:
            continue
        coord_count += 1
        if not isinstance(coords, list) or len(coords) != 2:
            r.error(
                f"Location '{loc_id}': coordinates should be [lng, lat], got {coords}"
            )
            continue
        lng, lat = coords
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            r.warn(f"Location '{loc_id}': coordinates out of range [{lng}, {lat}]")

    total_locs = len(locations)
    if total_locs > 0:
        pct = 100 * coord_count / total_locs
        r2 = f"{coord_count}/{total_locs} ({pct:.1f}%)"
        if pct < 30:
            r.warn(
                f"Only {r2} locations have coordinates — geocoding may be incomplete"
            )
        else:
            r.warn(f"Geocoding coverage: {r2}")

    # Year range sanity
    min_year = None
    max_year = None
    for eid, event in kb.get("events", {}).items():
        if not isinstance(event, dict):
            continue
        for key in ["time_start", "time_end", "imputed_time_start", "imputed_time_end"]:
            y = event.get(key)
            if isinstance(y, (int, float)):
                if min_year is None or y < min_year:
                    min_year = y
                if max_year is None or y > max_year:
                    max_year = y

    if min_year is not None and max_year is not None:
        # Zizhi Tongjian covers -403 to 959 CE
        if min_year < -500 or max_year > 1100:
            r.warn(
                f"Year range [{min_year}, {max_year}] seems out of expected [-500, 1100]"
            )
        else:
            r.warn(f"Year range: {min_year} to {max_year}")

    # Relations have numeric year fields
    relations = kb.get("relations", {})
    rels_with_year = 0
    for rid, rel in relations.items():
        if not isinstance(rel, dict):
            continue
        if (
            rel.get("first_interaction_year") is not None
            or rel.get("last_interaction_year") is not None
        ):
            rels_with_year += 1
    total_rels = len(relations)
    if total_rels > 0:
        pct = 100 * rels_with_year / total_rels
        r.warn(
            f"Relations with numeric years: {rels_with_year}/{total_rels} ({pct:.1f}%)"
        )
        if pct < 50:
            r.warn("Low relation year coverage — time-based filtering may be limited")

    # Juan coverage
    juans_processed = kb.get("juans_processed", [])
    r.warn(
        f"Juans processed: {len(juans_processed)}/294 ({100 * len(juans_processed) / 294:.1f}%)"
    )
    if len(juans_processed) < 294:
        r.warn(
            f"Knowledge extraction incomplete — {294 - len(juans_processed)} juans missing"
        )

    return r


def validate_segment_year_index() -> ValidationResult:
    """Validate segment_year_index.json."""
    r = ValidationResult("segment_year_index.json")
    path = DATA_DIR / "segment_year_index.json"

    if not path.exists():
        r.error(f"File not found: {path}")
        return r

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    segments = data.get("segments", {})
    if not segments:
        r.error("No segments found")
        return r

    r.warn(f"Total segments: {len(segments)}")

    # Count null years
    null_years = 0
    for key, seg in segments.items():
        if not isinstance(seg, dict):
            continue
        if seg.get("year") is None:
            null_years += 1

    if null_years > 0:
        r.warn(f"Segments with null year: {null_years}/{len(segments)}")
    else:
        r.warn("All segments have year values")

    # Check year monotonicity within each juan
    juan_years = {}
    for key, seg in segments.items():
        if not isinstance(seg, dict):
            continue
        juan = seg.get("juan_index")
        year = seg.get("year")
        seg_idx = seg.get("segment_index", 0)
        if juan is None or year is None:
            continue
        if juan not in juan_years:
            juan_years[juan] = []
        juan_years[juan].append((seg_idx, year))

    violations = 0
    for juan, entries in juan_years.items():
        entries.sort()
        for i in range(1, len(entries)):
            if entries[i][1] < entries[i - 1][1]:
                violations += 1

    if violations > 0:
        r.warn(f"Year monotonicity violations: {violations}")
    else:
        r.warn("Year monotonicity: OK (no violations within juans)")

    return r


def validate_juan_year_index() -> ValidationResult:
    """Validate juan_year_index.json."""
    r = ValidationResult("juan_year_index.json")
    path = DATA_DIR / "juan_year_index.json"

    if not path.exists():
        r.error(f"File not found: {path}")
        return r

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    start_years = data.get("juan_start_year", {})
    total = len(start_years)

    if total == 0:
        r.error("No juan start years found")
        return r

    r.warn(f"Total juans with start years: {total}/294")
    if total < 294:
        r.error(f"Missing {294 - total} juan start years")

    # Year range check
    years = [v for v in start_years.values() if isinstance(v, (int, float))]
    if years:
        r.warn(f"Year range: {min(years)} to {max(years)}")
        if min(years) > -300 or max(years) < 900:
            r.warn("Year range seems unexpectedly narrow")

    return r


def main():
    parser = argparse.ArgumentParser(description="Smoke validation for data artifacts")
    parser.add_argument(
        "--fail", action="store_true", help="Exit non-zero if any errors"
    )
    args = parser.parse_args()

    print("Running smoke validations...\n")

    results = [
        validate_segment_year_index(),
        validate_juan_year_index(),
        validate_unified_kb(),
    ]

    for r in results:
        print(r.report())
        print()

    errors = sum(len(r.errors) for r in results)
    warnings = sum(len(r.warnings) for r in results)
    all_ok = all(r.ok for r in results)

    print(f"Summary: {errors} errors, {warnings} warnings")
    if all_ok:
        print("All validations passed (see warnings for informational notes)")
    else:
        print("Some validations FAILED")

    if args.fail and not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
