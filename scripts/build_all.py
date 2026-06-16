#!/usr/bin/env python3
"""
Build All: Single entrypoint to run the data pipeline end-to-end.

Pipeline stages:
  1. Extract    — LLM knowledge extraction (optional, requires DEEPSEEK_API_KEY)
  2. Segment Year Index — Parse segment years from adapted_book.json
  3. Juan Year Index    — Build juan start-year index
  4. Unify      — Entity resolution & merge from store/ → unified_knowledge.json
  5. Geocode    — Geocode locations with Amap API (optional, requires AMAP_KEY)
  6. Merge      — Merge geocoding back into unified KB
  7. Publish    — Copy artifacts to visualization/public/data/

Usage:
  python scripts/build_all.py                     # Run all stages (skip extract if no key)
  python scripts/build_all.py --skip extract       # Skip extraction stage
  python scripts/build_all.py --only segment,juan  # Run only specified stages
  python scripts/build_all.py --simulate           # Simulate geocoding (no API key needed)
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
STORE_DIR = DATA_DIR / "store"
VIS_PUBLIC = ROOT / "visualization" / "public" / "data"

STAGES = ["extract", "segment", "juan", "unify", "geocode", "merge", "publish"]


def stage_segment(args):
    """Build segment year index from adapted_book.json."""
    adapted = ROOT / "adapted_book.json"
    output = DATA_DIR / "segment_year_index.json"
    overrides = DATA_DIR / "segment_year_overrides.json"

    if not adapted.exists():
        print(f"[segment] ERROR: {adapted} not found")
        return False

    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "build_segment_year_index.py"),
        "--input",
        str(adapted),
        "--output",
        str(output),
    ]
    if overrides.exists():
        cmd += ["--overrides", str(overrides)]

    print(f"[segment] Building segment year index...")
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"[segment] FAILED (exit code {result.returncode})")
        return False
    print(f"[segment] Done: {output}")
    return True


def stage_juan(args):
    """Build juan start-year index from segment year index."""
    seg_index = DATA_DIR / "segment_year_index.json"
    output = DATA_DIR / "juan_year_index.json"

    if not seg_index.exists():
        print(f"[juan] ERROR: {seg_index} not found (run 'segment' first)")
        return False

    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "build_juan_year_index.py"),
        "--input",
        str(seg_index),
        "--output",
        str(output),
    ]
    print(f"[juan] Building juan year index...")
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"[juan] FAILED (exit code {result.returncode})")
        return False
    print(f"[juan] Done: {output}")
    return True


def stage_extract(args):
    """Run LLM knowledge extraction (requires DEEPSEEK_API_KEY)."""
    if not os.getenv("DEEPSEEK_API_KEY"):
        print("[extract] SKIP: DEEPSEEK_API_KEY not set")
        return True  # Not an error — just skip

    print("[extract] Running knowledge extraction (this may take a long time)...")
    print("[extract] NOTE: knowledge_extraction.py is a Jupyter notebook script.")
    print(
        "[extract]       Run it manually: jupyter nbconvert --to script knowledge_extraction.py && python knowledge_extraction.py"
    )
    return True


def stage_unify(args):
    """Run entity resolution to build unified_knowledge.json."""
    # entity_resolution.py needs pydantic
    try:
        import pydantic  # noqa: F401
    except ImportError:
        print("[unify] ERROR: pydantic not installed. Run: pip install pydantic")
        return False

    if not STORE_DIR.exists() or not list(STORE_DIR.glob("juan_*.json")):
        print(f"[unify] WARNING: No juan_*.json files in {STORE_DIR}")
        print(
            "[unify]         The unified KB will be empty. Run 'extract' first or copy store data."
        )
        # Still continue — maybe unified_knowledge.json already exists

    output = DATA_DIR / "unified_knowledge.json"
    seg_index = DATA_DIR / "segment_year_index.json"

    cmd = [
        sys.executable,
        str(ROOT / "entity_resolution.py"),
        "--store-dir",
        str(STORE_DIR),
        "--output",
        str(output),
    ]
    if seg_index.exists():
        cmd += ["--segment-year-index", str(seg_index)]

    print(f"[unify] Building unified knowledge base...")
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"[unify] FAILED (exit code {result.returncode})")
        return False
    print(f"[unify] Done: {output}")
    return True


def stage_geocode(args):
    """Geocode locations using Amap API."""
    kb_path = DATA_DIR / "unified_knowledge.json"
    output = DATA_DIR / "location_geocoding.json"

    if not kb_path.exists():
        print(f"[geocode] ERROR: {kb_path} not found (run 'unify' first)")
        return False

    if not os.getenv("AMAP_KEY") and not args.simulate:
        print("[geocode] SKIP: AMAP_KEY not set (use --simulate for dry run)")
        return True

    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "geocode_locations_amap.py"),
        "--kb",
        str(kb_path),
        "--out",
        str(output),
    ]
    if args.simulate:
        cmd += ["--simulate"]

    print(f"[geocode] Geocoding locations...")
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"[geocode] FAILED (exit code {result.returncode})")
        return False
    print(f"[geocode] Done: {output}")
    return True


def stage_merge(args):
    """Merge geocoding results into unified KB."""
    kb_path = DATA_DIR / "unified_knowledge.json"
    geocoding = DATA_DIR / "location_geocoding.json"

    if not kb_path.exists():
        print(f"[merge] ERROR: {kb_path} not found (run 'unify' first)")
        return False
    if not geocoding.exists():
        print(f"[merge] SKIP: {geocoding} not found (run 'geocode' first)")
        return True

    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "merge_geocoding_into_unified_kb.py"),
        "--kb",
        str(kb_path),
        "--geocoding",
        str(geocoding),
    ]
    # If --require-review-ok, only merge confirmed entries
    if args.require_review_ok:
        cmd += ["--require-review-ok"]

    print(f"[merge] Merging geocoding into unified KB...")
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"[merge] FAILED (exit code {result.returncode})")
        return False
    print(f"[merge] Done")
    return True


def stage_publish(args):
    """Copy data artifacts to visualization/public/data/ for frontend serving."""
    VIS_PUBLIC.mkdir(parents=True, exist_ok=True)

    artifacts = [
        "unified_knowledge.json",
        "juan_year_index.json",
        "segment_year_index.json",
    ]

    published = 0
    for name in artifacts:
        src = DATA_DIR / name
        dst = VIS_PUBLIC / name
        if src.exists():
            shutil.copy2(src, dst)
            size_mb = src.stat().st_size / (1024 * 1024)
            print(f"[publish] {name} ({size_mb:.1f} MB) → {dst}")
            published += 1
        else:
            print(f"[publish] SKIP: {name} not found in {DATA_DIR}")

    if published == 0:
        print("[publish] WARNING: No artifacts published")
        return False

    print(f"[publish] Done: {published}/{len(artifacts)} artifacts published")
    return True


STAGE_FUNCS = {
    "extract": stage_extract,
    "segment": stage_segment,
    "juan": stage_juan,
    "unify": stage_unify,
    "geocode": stage_geocode,
    "merge": stage_merge,
    "publish": stage_publish,
}


def main():
    parser = argparse.ArgumentParser(
        description="Build All: Run the data pipeline end-to-end",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--skip",
        nargs="+",
        default=[],
        help="Stages to skip (e.g., --skip extract geocode)",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        default=[],
        help="Run only these stages (e.g., --only segment juan publish)",
    )
    parser.add_argument(
        "--simulate", action="store_true", help="Simulate geocoding (no API key needed)"
    )
    parser.add_argument(
        "--require-review-ok",
        action="store_true",
        help="Only merge geocoding entries that passed review",
    )

    args = parser.parse_args()

    # Determine which stages to run
    if args.only:
        stages = [s for s in STAGES if s in args.only]
    else:
        stages = [s for s in STAGES if s not in args.skip]

    print(f"Pipeline stages: {' → '.join(stages)}")
    print(f"Root: {ROOT}")
    print()

    results = {}
    for stage in stages:
        func = STAGE_FUNCS[stage]
        print(f"{'=' * 50}")
        print(f"  Stage: {stage}")
        print(f"{'=' * 50}")
        ok = func(args)
        results[stage] = "OK" if ok else "FAILED"
        print()

    # Summary
    print(f"{'=' * 50}")
    print("  Pipeline Summary")
    print(f"{'=' * 50}")
    for stage, status in results.items():
        icon = "[OK]" if status == "OK" else "[!!]"
        print(f"  {icon} {stage}: {status}")

    failed = [s for s, v in results.items() if v == "FAILED"]
    if failed:
        print(f"\nFailed stages: {', '.join(failed)}")
        sys.exit(1)
    else:
        print("\nAll stages completed successfully.")


if __name__ == "__main__":
    main()
