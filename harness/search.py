from __future__ import annotations
import fnmatch, re
from pathlib import Path
from .indexer import RepositoryIndex

def find_files(index, pattern): return [f["path"] for f in index.files if fnmatch.fnmatch(f["path"], pattern)]
def find_symbol(index, name): return index.symbols.get(name, [])
def get_dependents(index, target): return [p for p, deps in index.graph.items() if target in deps or target.removesuffix(Path(target).suffix) in deps]
def search_code(index, query, limit=20):
    result = []
    for record in index.files:
        try: lines = (index.root / record["path"]).read_text(encoding="utf-8").splitlines()
        except OSError: continue
        for n, line in enumerate(lines, 1):
            if query.lower() in line.lower() or re.search(query, line, re.I): result.append({"file": record["path"], "line": n, "snippet": line.strip()[:240]})
            if len(result) >= limit: return result
    return result
def find_references(index, symbol, limit=50): return search_code(index, rf"\b{re.escape(symbol)}\b", limit)
