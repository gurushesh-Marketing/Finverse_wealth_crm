#!/usr/bin/env python3
"""
Deterministic Knowledge Freshness Helper for Finverse CRM v2.
Tracks hashes of source files, identifies modified/added/deleted files,
reports SQL indexing readiness, and runs bounded incremental Graphify extraction.
"""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[4]
MAINTENANCE_DIR = WORKSPACE_ROOT / ".maintenance"
STATE_FILE = MAINTENANCE_DIR / "knowledge_state.json"
VENV_GRAPHIFY = WORKSPACE_ROOT / ".venv-graphify" / "Scripts" / "graphify.exe"
PYTHON_BIN = WORKSPACE_ROOT / ".venv-graphify" / "Scripts" / "python.exe"

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".sql", ".json"}
EXCLUDE_DIRS = {
    ".git",
    ".venv-graphify",
    ".agents",
    ".commandcode",
    "docs",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".maintenance",
    "logs",
    "graphify-out",
    "graphify-requirements",
}

def get_file_hash(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def scan_files():
    files = {}
    for root, dirs, filenames in os.walk(WORKSPACE_ROOT):
        # Prune excluded dirs
        rel_root = os.path.relpath(root, WORKSPACE_ROOT)
        parts = rel_root.replace("\\", "/").split("/")
        if any(part in EXCLUDE_DIRS for part in parts):
            continue

        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in CODE_EXTENSIONS:
                full_path = Path(root) / filename
                rel_path = full_path.relative_to(WORKSPACE_ROOT).as_posix()
                try:
                    files[rel_path] = get_file_hash(full_path)
                except Exception:
                    pass
    return files

def check_sql_indexing():
    try:
        import tree_sitter_sql  # noqa: F401
        has_ts_sql = True
    except ImportError:
        has_ts_sql = False

    sql_files = list((WORKSPACE_ROOT / "database" / "migrations").glob("*.sql"))
    return {
        "tree_sitter_sql_installed": has_ts_sql,
        "migration_sql_files_count": len(sql_files),
        "status": "active" if has_ts_sql else "missing_dependency",
        "details": "AST parsing enabled via tree_sitter_sql" if has_ts_sql else "tree_sitter_sql absent; SQL files contribute zero AST nodes"
    }

def verify_symbol(symbol: str = "TlProspectDrillDownPage") -> bool:
    graph_path = WORKSPACE_ROOT / "graphify-out" / "graph.json"
    if not graph_path.exists():
        return False
    try:
        with open(graph_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for node in data.get("nodes", []):
            if symbol.lower() in node.get("label", "").lower() or symbol.lower() in node.get("id", "").lower():
                return True
    except Exception:
        return False
    return False

def check_freshness():
    current_files = scan_files()
    previous_state = {}
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                previous_state = json.load(f).get("files", {})
        except Exception:
            previous_state = {}

    added = [f for f in current_files if f not in previous_state]
    modified = [f for f in current_files if f in previous_state and current_files[f] != previous_state[f]]
    deleted = [f for f in previous_state if f not in current_files]

    is_fresh = (len(added) == 0 and len(modified) == 0 and len(deleted) == 0)
    sql_status = check_sql_indexing()
    tl_symbol_present = verify_symbol("TlProspectDrillDownPage")

    return {
        "is_fresh": is_fresh,
        "added": added,
        "modified": modified,
        "deleted": deleted,
        "current_file_count": len(current_files),
        "sql_indexing": sql_status,
        "tl_drill_down_symbol_verified": tl_symbol_present,
        "current_hashes": current_files
    }

def run_refresh(timeout_seconds: int = 60) -> bool:
    status = check_freshness()
    print(f"[Freshness] Status: {'FRESH' if status['is_fresh'] else 'STALE'}")
    print(f"[Freshness] Added: {len(status['added'])}, Modified: {len(status['modified'])}, Deleted: {len(status['deleted'])}")
    print(f"[SQL Indexing] {status['sql_indexing']['status']}: {status['sql_indexing']['details']}")

    # If content is unchanged and required symbols are verified, skip extraction
    if status["is_fresh"] and status["tl_drill_down_symbol_verified"]:
        print("[Graphify] No changed indexed content and symbols verified. Extraction skipped.")
        return True

    print(f"[Graphify] Triggering bounded extraction (timeout: {timeout_seconds}s)...")
    cmd = [str(VENV_GRAPHIFY), "extract", ".", "--code-only"]
    try:
        res = subprocess.run(
            cmd,
            cwd=WORKSPACE_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
    except subprocess.TimeoutExpired as e:
        print(f"[Graphify ERROR] Extraction timed out after {timeout_seconds}s: {e}")
        # Failure/timeout must not advance the freshness state
        return False
    except Exception as e:
        print(f"[Graphify ERROR] Extraction execution failed: {e}")
        # Failure must not advance the freshness state
        return False

    if res.returncode != 0:
        print(f"[Graphify ERROR] Exit code {res.returncode}: {res.stderr.strip() or res.stdout.strip()}")
        # Failed refresh must not advance freshness state
        return False

    print(res.stdout)

    # Verify that required symbols are present in the newly generated graph
    symbol_verified = verify_symbol("TlProspectDrillDownPage")
    print(f"[Symbol Verification] TlProspectDrillDownPage: {'FOUND' if symbol_verified else 'MISSING'}")
    if not symbol_verified:
        print("[Graphify ERROR] Required symbol TlProspectDrillDownPage missing from graph. State not advanced.")
        return False

    # Persist state ONLY after confirmed successful extraction and symbol verification
    MAINTENANCE_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "files": status["current_hashes"],
            "sql_indexing": check_sql_indexing(),
            "tl_drill_down_symbol_verified": True
        }, f, indent=2)

    print("[Freshness] Knowledge state successfully updated and saved.")
    return True


if __name__ == "__main__":
    if "--refresh" in sys.argv:
        success = run_refresh()
        sys.exit(0 if success else 1)
    else:
        status = check_freshness()
        print(json.dumps(status, indent=2))
