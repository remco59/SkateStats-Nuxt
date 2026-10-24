#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_dashboard.json by running the
OLD app's real build_home_trend_context + build_sparkline (main.py) -- nothing is
re-implemented.

    python3 scripts/golden/dashboard.py /path/to/old/SkateStats [out.json]

main.py imports fastapi etc. at module level, so the functions and everything they
(transitively) reference are pulled out of the AST and exec'd in isolation. The
clock is pinned (datetime.now() -> 2025-03-01) so the "current season" default is
repeatable.
"""
import ast
import json
import re
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import sqlite3

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_dashboard.json"
main_py = old_repo / "app/main.py"
TODAY = (2025, 3, 1)


class FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(*TODAY, 12, 0, 0)


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
        "re": re, "datetime": FixedDatetime, "date": date, "timedelta": timedelta, "sqlite3": sqlite3,
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


old = load_with_dependencies(main_py, ["build_home_trend_context"])


def race(id_, distance, total, date_, name, dnf=0):
    return {"id": id_, "competition_id": id_, "distance_m": distance, "total_time_ms": total, "dnf": dnf,
            "competition_name": name, "competition_date": date_, "venue": "Thialf", "lane": None}


# Several seasons; a distance with many points across months (tick spacing +
# de-duplication), one with a single point, one whose only valid race is a DNF,
# two races on the same day, and a December/January wrap.
ROWS = [
    race(1, 1500, 150000, "2023-10-07", "Herfstcup 23"),
    race(2, 500, 43000, "2023-10-07", "Herfstcup 23"),
    race(3, 1500, 148000, "2024-01-20", "Nieuwjaarscup"),
    race(10, 1500, 140000, "2024-09-14", "Opening"),
    race(11, 500, 41200, "2024-09-14", "Opening"),
    race(12, 1500, 137000, "2024-10-05", "Herfstcup"),
    race(13, 1000, 83500, "2024-10-05", "Herfstcup"),
    race(14, 1500, 133900, "2024-11-16", "Wintercup"),
    race(15, 500, 40800, "2024-11-16", "Wintercup"),
    race(16, 1500, None, "2024-11-16", "Wintercup", dnf=1),
    race(17, 1500, 138000, "2024-11-30", "Decembercup"),
    race(18, 3000, 275000, "2024-12-14", "NK afstanden", dnf=1),
    race(19, 1500, 132500, "2025-01-11", "Nieuwjaar"),
    race(20, 500, 40550, "2025-01-11", "Nieuwjaar"),
    race(21, 500, 40300, "2025-01-11", "Nieuwjaar (2)"),
    race(22, 1000, 82000, "2025-02-08", "Thialf Trophy"),
]
ONLY_OLD = [r for r in ROWS if r["competition_date"] < "2024-09-01"]
SAME_DAY = [race(40, 1500, 130000 + i * 100, "2025-02-01", f"Rit {i}") for i in range(3)]

CASES = [
    ("default to current season", ROWS, "", True),
    ("all seasons (explicit empty)", ROWS, "", False),
    ("older season", ROWS, "2023-2024", False),
    ("unknown season falls back to current", ROWS, "2019-2020", False),
    ("default to current but no data this season", ONLY_OLD, "", True),
    ("unknown season, current has no data", ONLY_OLD, "2019-2020", False),
    ("several points on one day", SAME_DAY, "", False),
    ("no races", [], "", True),
]

cases = []
for name, rows, season, default_to_current in CASES:
    # The old routes query ORDER BY competition_date ASC, r.id ASC.
    rows = sorted(rows, key=lambda r: (r["competition_date"], r["id"]))
    ctx = old["build_home_trend_context"](rows, season, default_to_current)
    cases.append({
        "name": name,
        "today": "%04d-%02d-%02d" % TODAY,
        "rows": rows,
        "params": {"trend_season": season, "default_to_current": default_to_current},
        "expected": {
            "trend_season_options": ctx["trend_season_options"],
            "selected_trend_season": ctx["selected_trend_season"],
            "trend_rows": ctx["trend_rows"],
        },
    })

commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/dashboard.py against old SkateStats at {commit}: build_home_trend_context + build_sparkline (main.py), clock pinned to 2025-03-01",
    "cases": cases,
}
out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(cases)} cases)")
