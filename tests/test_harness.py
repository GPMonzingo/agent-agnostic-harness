import json
from harness.indexer import RepositoryIndex
from harness.search import find_symbol, search_code, get_dependents
from harness.context import ContextBuilder, ContextBudget

def make_repo(tmp_path):
    (tmp_path / "src").mkdir(); (tmp_path / "tests").mkdir(); (tmp_path / ".env").write_text("SECRET=x")
    (tmp_path / "src/a.py").write_text("from src.b import Thing\nclass Alpha:\n    pass\n")
    (tmp_path / "src/b.py").write_text("class Thing:\n    pass\n")
    (tmp_path / "tests/test_a.py").write_text("from src.a import Alpha\ndef test_alpha(): pass\n")
    return tmp_path

def test_scan_symbols_graph_and_sensitive_exclusion(tmp_path):
    index = RepositoryIndex(make_repo(tmp_path)); index.scan()
    assert find_symbol(index, "Alpha")[0]["file"] == "src/a.py"
    assert "src.b" in index.graph["src/a.py"]
    assert all(".env" not in x["path"] for x in index.files)
    assert get_dependents(index, "src.b") == ["src/a.py"]

def test_search_and_budgeted_context(tmp_path):
    index = RepositoryIndex(make_repo(tmp_path)); index.scan()
    assert search_code(index, "Alpha")[0]["file"] == "src/a.py"
    (tmp_path / ".ai").mkdir(); (tmp_path / ".ai/repo-context.json").write_text(json.dumps({"language":"Python"}))
    (tmp_path / ".ai/ARCHITECTURE.md").write_text("architecture")
    context = ContextBuilder(index, ContextBudget(max_source_files=1)).build("Alpha")
    assert len(context["files"]) == 1
    assert context["estimatedTokens"] > 0

def test_cache_round_trip(tmp_path):
    index = RepositoryIndex(make_repo(tmp_path)); index.scan(); path = index.save()
    loaded = RepositoryIndex.load(tmp_path)
    assert path.exists() and len(loaded.files) == len(index.files)
