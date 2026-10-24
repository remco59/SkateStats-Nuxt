#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_duplicates.json by running the
OLD app's real deduplicate_competitions (main.py) -- including its SQL -- against an
in-memory SQLite database.

    python3 scripts/golden/duplicates.py /path/to/old/SkateStats [out.json]

Each scenario is a small old-schema database; the output records what is left
afterwards (competitions with their merged name/venue/notes, which competition each
race ended up in) plus the returned counts. main.py imports fastapi etc. at module
level, so the function and everything it (transitively) references are pulled out
of the AST and exec'd in isolation.
"""
import ast
import json
import re
import sqlite3
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_duplicates.json"
main_py = old_repo / "app/main.py"


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
        "re": re, "sqlite3": sqlite3, "datetime": datetime, "date": date,
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


old = load_with_dependencies(main_py, ["deduplicate_competitions"])


def laps(*ms):
    return ",".join(f"{v / 1000:g}" for v in ms) if ms else None


def comp(id_, owner, name, venue, date_, notes=None):
    return {"id": id_, "owner": owner, "name": name, "venue": venue, "date": date_, "notes": notes}


def race(id_, comp_id, distance, total, lap_ms=None, lane=None, opponent=None, dnf=0, notes=None, owner_skater=1):
    return {"id": id_, "competition_id": comp_id, "skater_id": owner_skater, "distance_m": distance,
            "total_time_ms": total, "lane": lane, "opponent": opponent, "laps_ms": lap_ms or [], "dnf": dnf, "notes": notes}


SCENARIOS = [
    ("different titles for the same day merge, preferring the title without a date", [
        comp(1, 1, "Herfstcup uitslag 05-10-2025", "Thialf", "2025-10-05", "Geimporteerd van OSTA: https://osta.example/1"),
        comp(2, 1, "Herfstcup", None, "2025-10-05", "Geimporteerd van OSTA: https://osta.example/2"),
        comp(3, 1, "Herfstcup 2025", "Thialf (NED)", "2025-10-05", "Geimporteerd van OSTA: https://osta.example/1"),
    ], [
        race(10, 1, 500, 40000, [10000, 30000], notes="Geimporteerd van OSTA: https://osta.example/r1"),
        race(11, 2, 500, 40000, [10000, 30000], notes="Geimporteerd van OSTA: https://osta.example/r1"),
        race(12, 2, 1000, 82000, [24000, 29000, 29000], notes="Geimporteerd van OSTA: https://osta.example/r2"),
        race(13, 3, 1500, 130000, [40000, 30000, 30000, 30000]),
    ]),
    ("two venues on the same day stay apart; a blank venue is not guessed", [
        comp(1, 1, "Clubkampioenschap", "Thialf", "2025-11-01"),
        comp(2, 1, "Clubkampioenschap", "Kardinge", "2025-11-01"),
        comp(3, 1, "Clubkampioenschap", None, "2025-11-01"),
    ], [race(10, 1, 500, 40000), race(11, 2, 500, 41000), race(12, 3, 500, 42000)]),
    ("a blank venue merges when there is only one known venue", [
        comp(1, 1, "NK Afstanden", None, "2025-12-13"),
        comp(2, 1, "nk afstanden", "Thialf", "2025-12-13"),
    ], [race(10, 1, 1500, 131000), race(11, 2, 3000, 270000)]),
    ("duplicate detection: same source url, rich fingerprint, bare distance+time, distinct urls", [
        comp(1, 1, "Wintercup", "Thialf", "2026-01-10"),
        comp(2, 1, "Wintercup", "Thialf", "2026-01-10"),
    ], [
        race(10, 1, 500, 40000, [10000, 30000], notes="Geimporteerd van OSTA: https://osta.example/a"),
        race(11, 1, 1000, 80000),
        race(12, 1, 1500, 130000, [40000, 30000, 30000, 30000], lane="Binnen"),
        race(13, 1, 3000, 270000, notes="Geimporteerd van OSTA: https://osta.example/x"),
        race(20, 2, 500, 40000, [10000, 30000], notes="Rondetijden van OSTA: https://osta.example/a"),   # same url -> duplicate
        race(21, 2, 1000, 80000),                                                                      # bare distance+time -> kept
        race(22, 2, 1500, 130000, [40000, 30000, 30000, 30000], lane="binnen"),                          # rich match -> duplicate
        race(23, 2, 3000, 270000, notes="Geimporteerd van OSTA: https://osta.example/y"),               # distinct url -> kept
        race(24, 2, 500, None, dnf=1, lane="Buiten"),                                                    # dnf, no match -> kept
    ]),
    ("users are never merged with each other", [
        comp(1, 1, "Herfstcup", "Thialf", "2025-10-05"),
        comp(2, 2, "Herfstcup", "Thialf", "2025-10-05"),
    ], [race(10, 1, 500, 40000), race(11, 2, 500, 40000, owner_skater=2)]),
    ("notes are merged line by line without repeating a line", [
        comp(1, 1, "Cup", "Thialf", "2025-10-05", "Trainer: Jan\nVideo online"),
        comp(2, 1, "Cup", "Thialf", "2025-10-05", "Video online\nWeer: koud"),
    ], []),
    ("nothing to merge", [
        comp(1, 1, "Cup A", "Thialf", "2025-10-05"),
        comp(2, 1, "Cup B", "Thialf", "2025-10-05"),
    ], [race(10, 1, 500, 40000)]),
]

results = []
for name, comps, rs in SCENARIOS:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE competition (id INTEGER PRIMARY KEY, owner_user_id INTEGER, name TEXT, venue TEXT, competition_date TEXT, notes TEXT, created_at TEXT);
        CREATE TABLE race (id INTEGER PRIMARY KEY, competition_id INTEGER REFERENCES competition(id), skater_id INTEGER, distance_m INTEGER,
                           total_time_ms INTEGER, lane TEXT, opponent TEXT, laps_csv TEXT, dnf INTEGER DEFAULT 0, notes TEXT);
        """
    )
    for c in comps:
        conn.execute("INSERT INTO competition VALUES (?,?,?,?,?,?,?)", (c["id"], c["owner"], c["name"], c["venue"], c["date"], c["notes"], "2025-01-01"))
    for r in rs:
        conn.execute("INSERT INTO race VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (r["id"], r["competition_id"], r["skater_id"], r["distance_m"], r["total_time_ms"], r["lane"], r["opponent"], laps(*r["laps_ms"]), r["dnf"], r["notes"]))
    counts = old["deduplicate_competitions"](conn)
    after_comps = [dict(row) for row in conn.execute("SELECT id, owner_user_id, name, venue, competition_date, notes FROM competition ORDER BY id")]
    after_races = [dict(row) for row in conn.execute("SELECT id, competition_id FROM race ORDER BY id")]
    results.append({
        "name": name,
        "competitions": comps,
        "races": rs,
        "expected": {
            "counts": counts,
            "competitions": [
                {"id": c["id"], "owner": c["owner_user_id"], "name": c["name"], "venue": c["venue"], "date": c["competition_date"], "notes": c["notes"]}
                for c in after_comps
            ],
            "races": {str(r["id"]): r["competition_id"] for r in after_races},
        },
    })

commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/duplicates.py against old SkateStats at {commit}: deduplicate_competitions (main.py) incl. its SQL, on in-memory databases",
    "scenarios": results,
}
out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(results)} scenarios)")
