#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_targets.json by running the
OLD app's real code (the Python target-progress functions in main.py and the
JavaScript split-plan functions in templates/goals.html) -- nothing is
re-implemented here, so the outputs are real old-app behavior.

    python3 scripts/golden/targets.py /path/to/old/SkateStats [out.json]

The old app imports fastapi etc. at module level, so instead of importing
main.py the needed functions are pulled out of its AST and exec'd in
isolation. Fixture was generated against the old repo at the commit recorded
in the output's "generated_by" field.
"""
import ast
import json
import subprocess
import sys
from math import ceil
from pathlib import Path
from statistics import mean, median, pstdev
from typing import Any, Dict, List, Optional, Tuple
import sqlite3

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_targets.json"
main_py = old_repo / "app/main.py"
goals_html = old_repo / "app/templates/goals.html"

NEEDED = [
    "laps_from_csv",
    "opening_split_m",
    "segment_distances",
    "per400_times",
    "compute_race_metrics",
    "build_distance_stats",
    "build_goal_progress",
]


def load_old_functions(path: Path, names: List[str]) -> Dict[str, Any]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    ns: Dict[str, Any] = {
        "mean": mean, "median": median, "pstdev": pstdev, "ceil": ceil,
        "List": List, "Optional": Optional, "Dict": Dict, "Tuple": Tuple, "Any": Any, "sqlite3": sqlite3,
    }
    found = set()
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in names:
            exec(compile(ast.Module([node], []), str(path), "exec"), ns)
            found.add(node.name)
    missing = set(names) - found
    if missing:
        raise SystemExit(f"functions not found in old main.py: {sorted(missing)}")
    return ns


old = load_old_functions(main_py, NEEDED)


def race(id_, distance, total_ms, laps_csv, dnf=0, date="2025-01-01"):
    return {"id": id_, "distance_m": distance, "total_time_ms": total_ms, "laps_csv": laps_csv, "dnf": dnf, "competition_date": date}


def goal(distance, time=None, opening=None, avg=None, last=None, fade=None):
    return {"distance_m": distance, "target_time_ms": time, "target_opening_ms": opening,
            "target_avg_400_ms": avg, "target_last_400_ms": last, "target_fade_400_ms": fade}


CASES = [
    ("1500m with a DNF and a race without laps", 1500, [
        race(1, 1500, 133900, "41.5,30.2,30.8,31.4", date="2024-11-16"),
        race(2, 1500, 131200, "40.9,30.0,30.5,29.8", date="2024-12-14"),
        race(3, 1500, 129800, "40.1,29.8,30.1,29.8", date="2025-01-11"),
        race(4, 1500, None, "41.0,30.0", dnf=1, date="2025-01-18"),
        race(5, 1500, 135000, None, date="2025-02-01"),
    ], goal(1500, 130000, 40000, 30000, 29500, 400)),
    ("500m (100 m opening, one full lap)", 500, [
        race(10, 500, 40550, "10.3,30.25", date="2024-11-16"),
        race(11, 500, 39980, "10.1,29.88", date="2024-12-14"),
    ], goal(500, 39500, 10000, 29500, 29500, 200)),
    ("target with only a time, no races at all", 1000, [], goal(1000, 80000)),
    ("only splits, no overall time", 1500, [
        race(20, 1500, 128000, "40.0,30.0,29.5,28.5"),
    ], goal(1500, None, 39500, 29800, 28000, 1200)),
    ("negative-split fade (last lap faster than first)", 1500, [
        race(30, 1500, 127000, "41.0,30.5,30.0,25.5"),
    ], goal(1500, 126000, None, None, None, -300)),
    ("3000m with 7 laps (odd lap-count quirk)", 3000, [
        race(40, 3000, 270000, "20.5,31.0,31.2,31.5,31.8,32.0,33.0"),
        race(41, 3000, 268500, "20.2,30.8,31.0,31.4,31.6,31.9,32.1,32.4"),
    ], goal(3000, 265000, 20000, 31000, 32000, 900)),
    ("two distances, only one has a goal", 1000, [
        race(50, 1000, 81500, "24.1,28.9,28.5"),
        race(51, 500, 40000, "10.0,30.0"),
    ], goal(1000, 80000, 24000, 28000, 28000, 100)),
]

target_progress = []
for name, distance, rows, g in CASES:
    stats = old["build_distance_stats"](rows, set())
    stat = next((s for s in stats if s["distance_m"] == distance), None)
    progress = old["build_goal_progress"](g, stat or {})
    keep = ["best_time_ms", "best_opening_s", "avg_400_s", "best_last_400_s", "avg_fade_s"]
    target_progress.append({
        "name": name,
        "distance_m": distance,
        "rows": rows,
        "goal": g,
        "expected_stat": {k: stat[k] for k in keep} if stat else None,
        "expected_progress": progress,
    })

js = subprocess.run(["node", str(Path(__file__).with_name("old-goals-js.mjs")), str(goals_html)], check=True, capture_output=True, text=True)
split_plan = json.loads(js.stdout)

commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/targets.py against old SkateStats at {commit}: build_distance_stats + build_goal_progress (main.py) and segmentDistancesForTarget / buildTargetSplitPlan / rebalanceTargetSplits (templates/goals.html)",
    "target_progress": target_progress,
    "split_plan": split_plan,
}
out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(target_progress)} progress cases, {len(split_plan['plans'])} plans, {len(split_plan['rebalances'])} rebalances)")
