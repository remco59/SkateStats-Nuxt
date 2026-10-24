#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_stats_extras.json by running
the OLD app's real build_stats_context (main.py) -- nothing is re-implemented.

    python3 scripts/golden/stats-extras.py /path/to/old/SkateStats [out.json]

main.py imports fastapi etc. at module level, so rather than importing it, the
function and everything it (transitively) references are pulled out of the AST
and exec'd in isolation. Two things are pinned so the output is repeatable:
  * the clock (datetime.now() -> 2025-03-01), and
  * random.choice, which the story card uses to pick ONE of three variants;
    the shim records the full candidate list and returns the first.
"""
import ast
import json
import re
import subprocess
import sys
from datetime import date, datetime, timedelta
from math import ceil
from pathlib import Path
from statistics import mean, median, pstdev
from typing import Any, Dict, List, Optional, Tuple
import sqlite3

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_stats_extras.json"
main_py = old_repo / "app/main.py"
TODAY = (2025, 3, 1)


class FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(*TODAY, 12, 0, 0)


class RandomShim:
    captured: list = []

    @staticmethod
    def choice(seq):
        RandomShim.captured = list(seq)
        return seq[0]


def load_with_dependencies(path: Path, roots: List[str]) -> Dict[str, Any]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    defs: Dict[str, ast.AST] = {}
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
            defs[node.name] = node
        elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            defs[node.targets[0].id] = node
    needed: set = set()
    stack = list(roots)
    while stack:
        name = stack.pop()
        if name in needed or name not in defs:
            continue
        needed.add(name)
        for sub in ast.walk(defs[name]):
            if isinstance(sub, ast.Name):
                stack.append(sub.id)
    ns: Dict[str, Any] = {
        "re": re, "random": RandomShim, "datetime": FixedDatetime, "date": date, "timedelta": timedelta,
        "mean": mean, "median": median, "pstdev": pstdev, "ceil": ceil, "sqlite3": sqlite3,
        "List": List, "Optional": Optional, "Dict": Dict, "Tuple": Tuple, "Any": Any,
    }
    for node in tree.body:  # keep file order so helpers precede their users
        name = getattr(node, "name", None) or (node.targets[0].id if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) else None)
        if name in needed:
            exec(compile(ast.Module([node], []), str(path), "exec"), ns)
    missing = [r for r in roots if r not in ns]
    if missing:
        raise SystemExit(f"not found in old main.py: {missing}")
    return ns


old = load_with_dependencies(main_py, ["build_stats_context"])


def race(id_, comp, distance, total, laps, date_, venue, dnf=0):
    return {"id": id_, "competition_id": comp, "distance_m": distance, "total_time_ms": total, "dnf": dnf,
            "competition_date": date_, "venue": venue, "laps_csv": laps}


# A season with several distances, venues, months, a DNF, races without laps, a
# tie for best opening (the LATER-dated race has the LOWER id) and a PR miss.
RICH = [
    race(10, 1, 1500, 140000, "42.0,31.0,31.5,32.0", "2024-09-14", "Heerenveen"),
    race(11, 1, 500, 41200, "10.4,30.8", "2024-09-14", "Heerenveen"),
    race(12, 2, 1500, 137000, "41.0,30.5,31.2,31.5", "2024-10-05", "Heerenveen"),
    race(13, 2, 1000, 83500, "24.5,29.5,29.5", "2024-10-05", "Heerenveen"),
    race(14, 3, 1500, 133900, "41.5,30.2,30.8,31.4", "2024-11-16", "Alkmaar"),
    race(15, 3, 500, 40800, "10.2,30.6", "2024-11-16", "Alkmaar"),
    race(16, 3, 1500, None, "42.0,31.0", "2024-11-16", "Alkmaar", dnf=1),
    race(17, 4, 1500, 138000, None, "2024-12-14", "Deventer"),
    race(18, 4, 3000, 275000, "21.0,32.0,32.2,32.5,32.8,33.0,33.2,34.0", "2024-12-14", "Deventer"),
    race(5, 5, 1500, 132500, "41.5,30.0,30.5,30.5", "2025-01-11", "Heerenveen"),
    race(19, 5, 500, 40550, "10.2,30.35", "2025-01-11", "Heerenveen"),
    race(20, 6, 1000, 82000, "24.2,28.9,28.9", "2025-02-08", "Thialf"),
]
OLDER = [
    race(1, 90, 1500, 150000, "44.0,32.5,33.0,34.0", "2023-10-07", "Heerenveen"),
    race(2, 90, 500, 43000, "10.9,32.1", "2023-10-07", "Heerenveen"),
    race(3, 91, 1500, 148000, "43.5,32.0,32.5,33.0", "2024-01-20", "Deventer"),
]
NO_LAPS = [
    race(30, 1, 500, 41500, None, "2024-11-02", "Thialf"),
    race(31, 1, 500, 41100, None, "2024-11-30", "Thialf"),
    race(32, 2, 1000, 84000, None, "2024-12-14", "Thialf", dnf=1),
]

CASES = [
    ("explicit season", RICH + OLDER, "2024-2025", "", False),
    ("all seasons, no default", RICH + OLDER, "", "", False),
    ("default to current season (2024-2025 at 2025-03-01)", RICH + OLDER, "", "", True),
    ("default to current but current has no data", OLDER, "", "", True),
    ("unknown season falls back to current", RICH + OLDER, "2019-2020", "", False),
    ("unknown season, current has no data", OLDER, "2019-2020", "", False),
    ("distance filter", RICH + OLDER, "2024-2025", "1500", False),
    ("races without laps: only calendar fun stats", NO_LAPS, "", "", False),
    ("no races at all", [], "", "", False),
]

KEYS = ["season_options", "selected_season", "selected_distance", "distance_options", "basic_stats",
        "distance_overview_rows", "consistency_rows", "progress_rows", "track_rows",
        "best_track_summary", "worst_track_summary", "fun_stats", "sb_reference_season"]

cases = []
for name, rows, season, distance, default_to_current in CASES:
    RandomShim.captured = []
    # The old route queries ORDER BY competition_date ASC, id ASC; the stats
    # function relies on that order (e.g. for PR detection), so feed it the same.
    rows = sorted(rows, key=lambda r: (r["competition_date"], r["id"]))
    result = old["build_stats_context"](rows, season, distance, default_to_current)
    story = RandomShim.captured or result["story_variants"]
    cases.append({
        "name": name,
        "today": "%04d-%02d-%02d" % TODAY,
        "rows": rows,
        "params": {"season": season, "distance_m": distance, "default_to_current": default_to_current},
        "expected": {k: result[k] for k in KEYS},
        "expected_story_candidates": story,
    })

commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/stats-extras.py against old SkateStats at {commit}: build_stats_context (main.py), clock pinned to 2025-03-01, random.choice intercepted to capture every story variant",
    "cases": cases,
}
out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(cases)} cases)")
