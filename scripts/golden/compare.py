#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_compare.json by running the
OLD app's real build_comparison_context (main.py) on a set of race pairs --
nothing is re-implemented. The output includes the narrative summary text
("Snellere opening, maar veel verval in de slotfase."), whose thresholds are
easy to get subtly wrong, so the pairs are chosen to land on and around them.

    python3 scripts/golden/compare.py /path/to/old/SkateStats [out.json]

main.py imports fastapi etc. at module level, so the function and everything
it transitively references are pulled out of the AST and exec'd in isolation.
"""
import ast
import json
import re
import subprocess
import sys
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple
import sqlite3

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_compare.json"
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
        "re": re, "mean": mean, "sqlite3": sqlite3,
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


old = load_with_dependencies(main_py, ["build_comparison_context"])


def r(distance, total, laps):
    return {"distance_m": distance, "total_time_ms": total, "laps_csv": laps}


# (name, base, compare)
CASES = [
    ("faster over nearly the whole race", r(1500, 133000, "41.0,30.5,30.8,30.7"), r(1500, 131500, "40.2,29.9,30.4,31.0")),
    ("faster opening but big fade", r(1500, 131000, "41.0,30.0,30.0,30.0"), r(1500, 131500, "40.5,29.8,30.5,30.7")),
    ("calmer start, stronger finish", r(1500, 132000, "40.0,30.5,31.0,30.5"), r(1500, 131500, "40.4,30.3,30.4,30.4")),
    ("overall faster by 250 ms, mixed splits", r(1500, 132000, "40.0,30.0,30.5,31.0"), r(1500, 131750, "40.1,29.9,30.7,30.9")),
    ("overall slower by 250 ms", r(1500, 131750, "40.0,30.0,30.5,31.0"), r(1500, 132000, "40.1,30.1,30.5,31.0")),
    ("tiny differences", r(1500, 131000, "40.0,30.0,30.5,30.5"), r(1500, 131100, "40.0,30.05,30.5,30.55")),
    ("exactly -300 ms and 75% faster splits", r(1500, 132000, "40.0,30.0,30.5,31.5"), r(1500, 131700, "39.9,29.9,30.4,31.5")),
    ("opening exactly -150 and fade delta exactly 250", r(1500, 131000, "40.5,30.0,30.0,30.0"), r(1500, 131000, "40.35,30.0,30.0,30.05")),
    ("slower opening (+200) with stronger finish (-200)", r(1500, 131500, "40.0,30.0,30.5,31.0"), r(1500, 131450, "40.2,30.1,30.8,30.8")),
    ("slower opening exactly +150, finish exactly -120", r(1500, 131500, "40.0,30.0,30.5,31.0"), r(1500, 131500, "40.15,30.1,30.8,30.88")),
    ("different lap counts", r(1500, 132000, "40.0,30.0,30.5,31.0"), r(1500, 131000, "40.0,30.0,30.5")),
    ("500 m, one full lap", r(500, 40500, "10.3,30.2"), r(500, 40100, "10.1,30.0")),
    ("3000 m, 8 laps vs 7 laps (odd lap-count quirk)", r(3000, 270000, "21.0,32.0,32.2,32.5,32.8,33.0,33.2,34.0"), r(3000, 268000, "20.8,31.9,32.0,32.4,32.6,32.9,34.2")),
    ("no laps on one side", r(1500, 133000, "41.0,30.5,30.8,30.7"), r(1500, 131500, None)),
    ("no laps at all, times differ", r(1000, 82000, None), r(1000, 81000, None)),
    ("missing total times", r(1500, None, "41.0,30.5,30.8,30.7"), r(1500, None, "40.2,29.9,30.4,31.0")),
    ("compare has no total, base has", r(1500, 133000, "41.0,30.5,30.8,30.7"), r(1500, None, "40.2,29.9,30.4,31.0")),
]

KEYS = ["summary", "splits", "highlights", "samenvatting_tekst", "pacing"]
cases = []
for name, base, compare in CASES:
    ctx = old["build_comparison_context"](base, compare)
    exp = {k: ctx[k] for k in KEYS}
    exp["onderdelen"] = {k: (v["index"] if v else None) for k, v in ctx["onderdelen"].items()}
    # What the page draws (values, not pixel coordinates).
    exp["delta_chart_points"] = len(ctx["delta_chart"]["circles"]) if ctx["delta_chart"] else 0
    exp["lap_overlay_points"] = [len(ctx["lap_overlay_chart"]["base_circles"]), len(ctx["lap_overlay_chart"]["compare_circles"])] if ctx["lap_overlay_chart"] else None
    cases.append({"name": name, "base": base, "compare": compare, "expected": exp})

commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/compare.py against old SkateStats at {commit}: build_comparison_context (main.py)",
    "cases": cases,
}
out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(cases)} cases)")
