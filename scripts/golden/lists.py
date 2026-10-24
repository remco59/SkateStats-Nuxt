#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_lists.json by running the OLD
app's real build_races_context and build_competitions_context (main.py) --
including their actual SQL -- against an in-memory SQLite database.

    python3 scripts/golden/lists.py /path/to/old/SkateStats [out.json]

That pins the parts that are easy to get subtly wrong when re-implementing a
SQL query as array code: filter semantics (case-insensitive exact vs LIKE),
inclusive date bounds, option lists, and the exact row ordering with its
tie-breakers.
"""
import ast
import os
import json
import re
import sqlite3
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_lists.json"
main_py = old_repo / "app/main.py"

conn = sqlite3.connect(":memory:")
conn.row_factory = sqlite3.Row
conn.executescript(
    """
    CREATE TABLE competition (id INTEGER PRIMARY KEY, name TEXT, venue TEXT, competition_date TEXT, notes TEXT, owner_user_id INTEGER);
    CREATE TABLE race (id INTEGER PRIMARY KEY, competition_id INTEGER, skater_id INTEGER, distance_m INTEGER,
                       total_time_ms INTEGER, laps_csv TEXT, dnf INTEGER DEFAULT 0, lane TEXT, opponent TEXT,
                       notes TEXT, tag_key TEXT, category TEXT, class_name TEXT);
    """
)


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
        "os": os, "re": re, "mean": mean, "sqlite3": sqlite3, "datetime": datetime, "date": date,
        "List": List, "Optional": Optional, "Dict": Dict, "Tuple": Tuple, "Any": Any,
    }
    for node in tree.body:
        name = getattr(node, "name", None) or (node.targets[0].id if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) else None)
        if name in needed:
            exec(compile(ast.Module([node], []), str(path), "exec"), ns)
    missing = [r for r in roots if r not in ns]
    if missing:
        raise SystemExit(f"not found in old main.py: {missing}")
    return ns


old = load_with_dependencies(main_py, ["build_races_context", "build_competitions_context"])
old["db"] = lambda: conn  # the real queries, against our in-memory data

USER = {"id": 1, "skater_id": 1}
COMPETITIONS = [
    (1, "Herfstcup", "Thialf", "2024-10-05"),
    (2, "NK Afstanden", "Thialf", "2024-12-14"),
    (3, "Clubwedstrijd", "thialf", "2024-12-14"),   # same date, venue differs only in case
    (4, "Kardinge Open", "Kardinge", "2025-01-11"),
    (5, "Zonder locatie", None, "2025-02-01"),
    (6, "Lege locatie", "  ", "2025-02-08"),
]
# (id, competition, distance, time, lane, tag)
RACES = [
    (1, 1, 500, 40800, "Binnen", "training"),
    (2, 1, 1500, 133900, "buiten", None),
    (3, 2, 500, 40500, "binnen", "important"),
    (4, 2, 500, 40500, "Buiten", "test"),           # tie on date + distance + time with race 3
    (5, 2, 1000, 83000, None, None),
    (6, 3, 500, 41000, "Binnen", "training"),
    (7, 4, 1500, 132000, "  ", "bad_ice"),
    (8, 4, 500, 40100, "Buiten", "training"),
    (9, 4, 500, 40100, "Buiten", None),             # tie with race 8 -> higher id first
    (10, 5, 3000, 275000, "gl", "sick"),
    (11, 6, 500, 39900, "Binnen", "fallen"),
    (12, 1, 1000, 82500, "Binnen", "injured"),
]
conn.executemany("INSERT INTO competition(id,name,venue,competition_date,owner_user_id) VALUES(?,?,?,?,1)", COMPETITIONS)
for rid, comp, distance, total, lane, tag in RACES:
    conn.execute(
        "INSERT INTO race(id,competition_id,skater_id,distance_m,total_time_ms,lane,tag_key,dnf) VALUES(?,?,1,?,?,?,?,0)",
        (rid, comp, distance, total, lane, tag),
    )

RACE_CASES = [
    {},
    {"distance_m": "500"},
    {"tag_key": "training"},
    {"lane": "binnen"},
    {"lane": "BUITEN"},
    {"venue": "thialf"},
    {"venue": "Kardinge"},
    {"date_from": "2024-12-14"},
    {"date_to": "2024-12-14"},
    {"date_from": "2024-12-14", "date_to": "2025-01-11"},
    {"distance_m": "500", "lane": "buiten", "venue": "kardinge"},
    {"distance_m": "500", "tag_key": "training", "date_from": "2024-11-01"},
    {"tag_key": "no_such_tag"},
    {"venue": "nowhere"},
]
COMP_CASES = [
    {},
    {"q": "thialf"},
    {"q": "CUP"},
    {"q": "open"},
    {"venue": "Thialf"},
    {"venue": "kardinge"},
    {"date_from": "2024-12-14"},
    {"date_to": "2024-12-14"},
    {"date_from": "2024-12-14", "date_to": "2025-01-11"},
    {"q": "thialf", "date_from": "2024-12-01"},
    {"q": "zzz"},
]

races_out = []
for params in RACE_CASES:
    ctx = old["build_races_context"](USER, **params)
    races_out.append({
        "params": params,
        "race_ids": [r["id"] for r in ctx["races"]],
        "lane_options": [r["lane"] for r in ctx["lane_options"]],
        "venue_options": [r["venue"] for r in ctx["venue_options"]],
    })
comps_out = []
for params in COMP_CASES:
    ctx = old["build_competitions_context"](USER, **params)
    comps_out.append({
        "params": params,
        "competition_ids": [c["id"] for c in ctx["comps"]],
        "venue_options": [v["venue"] for v in ctx["venue_options"]],
    })

commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/lists.py against old SkateStats at {commit}: build_races_context + build_competitions_context (main.py) incl. their SQL, on an in-memory database",
    "competitions": [{"id": c[0], "name": c[1], "venue": c[2], "date": c[3]} for c in COMPETITIONS],
    "races": [{"id": r[0], "competition_id": r[1], "distance_m": r[2], "total_time_ms": r[3], "lane": r[4], "tag": r[5]} for r in RACES],
    "race_cases": races_out,
    "competition_cases": comps_out,
}
out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(races_out)} race cases, {len(comps_out)} competition cases)")
