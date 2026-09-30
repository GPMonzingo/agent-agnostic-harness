import subprocess
from .search import *
def repo_tree(index): return [f["path"] for f in index.files]
def read_file(index, path): return (index.root / path).read_text(encoding="utf-8")
def read_file_range(index, path, start, end): return "\n".join(read_file(index, path).splitlines()[start-1:end])
def git_status(index): return subprocess.run(["git", "status", "--short"], cwd=index.root, text=True, capture_output=True).stdout
def git_diff(index): return subprocess.run(["git", "diff"], cwd=index.root, text=True, capture_output=True).stdout
def run_command(index, command): return subprocess.run(command, cwd=index.root, shell=True, text=True, capture_output=True)
def run_tests(index): return run_command(index, "python -m pytest")
