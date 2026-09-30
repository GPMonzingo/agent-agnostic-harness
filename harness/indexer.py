"""Deterministic, local repository indexing with conservative security defaults."""
from __future__ import annotations
import fnmatch, hashlib, json, re
from dataclasses import dataclass, asdict
from pathlib import Path

DEFAULT_IGNORES = {".git", ".ai", "node_modules", "dist", "build", "coverage", ".next", "bin", "obj", "vendor", "logs", "tmp", "__pycache__", ".venv"}
SENSITIVE = {".env", ".env.local", ".env.production", "credentials", "secrets"}
SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".cs", ".rb", ".php", ".c", ".cpp", ".h", ".swift", ".kt"}

@dataclass
class FileRecord:
    path: str
    language: str
    size: int
    mtime_ns: int
    sha256: str
    symbols: list[dict]
    imports: list[str]
    is_test: bool = False

def _language(path: Path) -> str:
    return {".py":"Python", ".ts":"TypeScript", ".tsx":"TypeScript", ".js":"JavaScript", ".jsx":"JavaScript", ".go":"Go", ".rs":"Rust", ".java":"Java", ".cs":"C#"}.get(path.suffix.lower(), path.suffix.lstrip(".") or "text")

def _ignored(rel: str, patterns: list[str]) -> bool:
    parts = Path(rel).parts; name = Path(rel).name
    if any(p in DEFAULT_IGNORES for p in parts): return True
    if name in SENSITIVE or name.startswith(".env") or name.endswith((".pem", ".key")): return True
    return any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(name, p) for p in patterns)

def _patterns(root: Path) -> list[str]:
    out = []
    for file in (root / ".gitignore", root / ".aiignore"):
        if file.exists(): out += [line.strip().rstrip("/") for line in file.read_text(errors="ignore").splitlines() if line.strip() and not line.startswith("#")]
    return out

def _symbols(text: str, language: str) -> list[dict]:
    patterns = [(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", "function"), (r"^\s*(?:export\s+)?class\s+(\w+)", "class"), (r"^\s*(?:export\s+)?(?:interface|type)\s+(\w+)", "type"), (r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)", "constant"), (r"^\s*def\s+(\w+)", "function"), (r"^\s*async\s+def\s+(\w+)", "function")]
    result = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for pattern, kind in patterns:
            m = re.search(pattern, line)
            if m:
                result.append({"name": m.group(1), "type": kind, "line": line_no, "exports": bool("export" in line or language == "Python")}); break
    return result

def _imports(text: str) -> list[str]:
    patterns = [r"^\s*import\s+(?:[^'\"]+from\s+)?['\"]([^'\"]+)", r"^\s*from\s+['\"]([^'\"]+)['\"]\s+import", r"^\s*from\s+([\w.]+)\s+import"]
    found = []
    for line in text.splitlines():
        for pattern in patterns:
            m = re.search(pattern, line)
            if m and m.group(1) not in found: found.append(m.group(1))
    return found

class RepositoryIndex:
    def __init__(self, root: str | Path): self.root, self.data = Path(root).resolve(), {}
    @property
    def files(self): return self.data.get("files", [])
    @property
    def symbols(self): return self.data.get("symbols", {})
    @property
    def graph(self): return self.data.get("dependencyGraph", {})
    def scan(self):
        patterns = _patterns(self.root); records = []; symbols = {}; graph = {}
        for path in sorted(self.root.rglob("*")):
            if not path.is_file(): continue
            rel = path.relative_to(self.root).as_posix()
            if _ignored(rel, patterns) or path.suffix.lower() not in SOURCE_EXTENSIONS: continue
            try: text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError): continue
            stat = path.stat(); syms = _symbols(text, _language(path)); imports = _imports(text)
            records.append(asdict(FileRecord(rel, _language(path), stat.st_size, stat.st_mtime_ns, hashlib.sha256(text.encode()).hexdigest(), syms, imports, bool(re.search(r"(^|/)(test|tests|spec)(/|[._-])", rel, re.I)))))
            for sym in syms: symbols.setdefault(sym["name"], []).append({**sym, "file": rel})
            graph[rel] = imports
        self.data = {"version": 1, "root": str(self.root), "files": records, "symbols": symbols, "dependencyGraph": graph}; return self.data
    def save(self, destination=None):
        target = Path(destination or self.root / ".ai" / "index.json"); target.parent.mkdir(parents=True, exist_ok=True); target.write_text(json.dumps(self.data, indent=2), encoding="utf-8"); return target
    @classmethod
    def load(cls, root, source=None):
        obj = cls(root); obj.data = json.loads(Path(source or obj.root / ".ai" / "index.json").read_text(encoding="utf-8")); return obj

def build_repo_index(root, refresh=False):
    index = RepositoryIndex(root); cache = index.root / ".ai" / "index.json"
    if cache.exists() and not refresh:
        try: return RepositoryIndex.load(root)
        except (OSError, json.JSONDecodeError): pass
    index.scan(); index.save(); return index
