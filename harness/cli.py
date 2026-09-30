import argparse, json
from .indexer import build_repo_index
from .context import ContextBuilder
from .search import search_code, find_symbol
def main():
    parser = argparse.ArgumentParser(prog="ai-harness"); sub = parser.add_subparsers(dest="command", required=True)
    for name in ("index", "refresh"): sub.add_parser(name)
    p = sub.add_parser("context"); p.add_argument("request")
    p = sub.add_parser("search"); p.add_argument("query")
    p = sub.add_parser("symbol"); p.add_argument("name")
    args = parser.parse_args(); index = build_repo_index(".", refresh=args.command in {"refresh", "index"})
    if args.command in {"index", "refresh"}: print(f"Indexed {len(index.files)} source files")
    elif args.command == "context": print(json.dumps(ContextBuilder(index).build(args.request), indent=2))
    elif args.command == "search": print(json.dumps(search_code(index, args.query), indent=2))
    else: print(json.dumps(find_symbol(index, args.name), indent=2))

if __name__ == "__main__":
    main()
