from __future__ import annotations
from dataclasses import dataclass
import json, re
from .search import find_symbol, search_code

@dataclass
class ContextBudget:
    max_context_tokens: int = 8000
    max_source_files: int = 8
    max_knowledge_chunks: int = 5
    max_examples: int = 1
    max_search_results: int = 20
    max_file_characters: int = 12000

class ContextBuilder:
    def __init__(self, index, budget=None): self.index, self.budget = index, budget or ContextBudget()
    def build(self, request):
        hits = search_code(self.index, request, self.budget.max_search_results); terms = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]{2,}", request)); selected = []
        for term in terms:
            for hit in find_symbol(self.index, term):
                if hit["file"] not in selected: selected.append(hit["file"])
        for hit in hits:
            if hit["file"] not in selected: selected.append(hit["file"])
        selected = selected[:self.budget.max_source_files]; knowledge = []
        for name in ("ARCHITECTURE.md", "CODING_RULES.md", "TESTING.md", "IMPORTANT_FILES.md"):
            path = self.index.root / ".ai" / name
            if path.exists(): knowledge.append({"file": name, "content": path.read_text(encoding="utf-8")[:4000]})
        sources = []
        for rel in selected:
            try: content = (self.index.root / rel).read_text(encoding="utf-8")[:self.budget.max_file_characters]
            except OSError: continue
            sources.append({"file": rel, "content": content})
        context = {"repo": self._repo_context(), "task": request, "knowledge": knowledge[:self.budget.max_knowledge_chunks], "files": sources, "searchResults": hits, "examples": self._examples()[:self.budget.max_examples]}
        while sum(len(json.dumps(v)) for v in context.values()) // 4 > self.budget.max_context_tokens and context["examples"]:
            context["examples"].pop()
        while sum(len(json.dumps(v)) for v in context.values()) // 4 > self.budget.max_context_tokens and context["knowledge"]:
            context["knowledge"].pop()
        while sum(len(json.dumps(v)) for v in context.values()) // 4 > self.budget.max_context_tokens and context["files"]:
            context["files"].pop()
        while sum(len(json.dumps(v)) for v in context.values()) // 4 > self.budget.max_context_tokens and context["searchResults"]:
            context["searchResults"].pop()
        context["estimatedTokens"] = max(1, sum(len(json.dumps(v)) for v in context.values()) // 4); return context
    def _repo_context(self):
        path = self.index.root / ".ai" / "repo-context.json"
        return json.loads(path.read_text()) if path.exists() else {"files": len(self.index.files), "language": "mixed"}
    def _examples(self):
        directory = self.index.root / ".ai" / "EXAMPLES"
        return [{"file": p.name, "content": p.read_text(encoding="utf-8")[:2500]} for p in sorted(directory.glob("*.md"))] if directory.exists() else []
