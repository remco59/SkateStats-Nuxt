#!/usr/bin/env python3
"""
Regenerates reference/fixtures/calculations/golden_notes.json by running the OLD
app's real format_notes_html (main.py) on a set of note texts -- including the
legacy "Imported from ..." formats that migrated data still contains.

    python3 scripts/golden/notes.py /path/to/old/SkateStats [out.json]

The old function returns HTML; the port returns a structure that the test
renders back to the same HTML, so the comparison is exact.
"""
import ast
import html
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

old_repo = Path(sys.argv[1]).resolve()
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "reference/fixtures/calculations/golden_notes.json"
main_py = old_repo / "app/main.py"


class Markup(str):
    """Stand-in for markupsafe.Markup: str that marks itself as safe."""


def escape(value: Any) -> str:
    # markupsafe.escape: & < > ' " -> &amp; &lt; &gt; &#39; &#34;
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;").replace('"', "&#34;")


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
    ns: Dict[str, Any] = {"re": re, "json": json, "quote": quote, "escape": escape, "Markup": Markup, "Optional": Optional, "List": List, "Dict": Dict, "Any": Any}
    for node in tree.body:
        name = getattr(node, "name", None) or (node.targets[0].id if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) else None)
        if name in needed:
            exec(compile(ast.Module([node], []), str(path), "exec"), ns)
    missing = [r for r in roots if r not in ns]
    if missing:
        raise SystemExit(f"not found in old main.py: {missing}")
    return ns


old = load_with_dependencies(main_py, ["format_notes_html"])

NOTES = [
    "Kei hard ijs, goed gevoel",
    "",
    "   ",
    "Geïmporteerd van OSTA: https://www.osta.nl/index.php?pid=abc-123",
    "Geimporteerd van SpeedSkatingResults: https://speedskatingresults.com/index.php?p=3&e=1",
    "Rondetijden van OSTA: https://www.osta.nl/race?id=7",
    "Geïmporteerd van OSTA",
    "Imported from OSTA: https://www.osta.nl/index.php?pid=86651033-b5c2",
    "Imported from OSTA pid 86651033-b5c2-4819-2162-08ddeb0685e4",
    "Imported from OSTA pid weird pid/with chars!*'()",
    "OSTA sync via pid 86651033-b5c2",
    'Imported from SpeedSkatingResults: {"link": "https://speedskatingresults.com/x?a=1&b=2"}',
    'Imported from SpeedSkatingResults: {"nolink": true}',
    "Imported from SpeedSkatingResults: {kapot json",
    "Imported from SpeedSkatingResults: see https://speedskatingresults.com/r/9 for details",
    "Imported from SpeedSkatingResults: geen link",
    "Imported from SpeedSkatingResults season 2025 https://speedskatingresults.com/s/2025",
    "Imported from SpeedSkatingResults season 2025",
    "Zie https://example.com/pagina",
    "Zie https://example.com/pagina en meer tekst erna",
    "Prefix zonder spatie:https://example.com/a?b=1&c=2",
    "<script>alert('x')</script> & \"quotes\"",
    "Geïmporteerd van OSTA: https://www.osta.nl/?q=<b>",
    "Regel één\nRegel twee\n\nRegel vier",
    "Geïmporteerd van OSTA: https://www.osta.nl/index.php?pid=1\nGoed gevoel vandaag\nTrainer: https://club.example/coach",
    "  Geïmporteerd van OSTA: https://www.osta.nl/index.php?pid=1  ",
    "Imported from OSTA: https://www.osta.nl/index.php?pid=1\nOSTA sync via pid 1",
]

cases = [{"notes": n, "expected_html": str(old["format_notes_html"](n))} for n in NOTES]
commit = subprocess.run(["git", "-C", str(old_repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {
    "generated_by": f"scripts/golden/notes.py against old SkateStats at {commit}: format_notes_html / normalize_note_line (main.py); markupsafe.escape and Markup are stood in for by an equivalent escape()",
    "cases": cases,
}
out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {out_path} ({len(cases)} cases)")
