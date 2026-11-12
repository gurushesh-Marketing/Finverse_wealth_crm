#!/usr/bin/env python3
"""
scripts/record_national_test_execution.py

Executes National Manager test suite and generates a cryptographically fingerprinted execution record.
Captures:
- Exact command line executed
- Exit code
- ISO execution timestamp
- Detailed test runner counts (total, pass, fail, skipped, duration_ms)
- Cryptographic SHA-256 fingerprints of:
  * Application API source (apps/api/src/)
  * Application Web source (apps/web/src/)
  * Database Migrations (database/migrations/)
  * Shared Contracts (packages/contracts/src/)
  * Test Suite File (apps/api/test/national.api.test.ts)
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
EVIDENCE_DIR = ROOT_DIR / "evidence"
RECORD_FILE = EVIDENCE_DIR / "national_test_execution_record.json"

sys.stdout.reconfigure(encoding='utf-8')

def hash_directory(directory_path: Path) -> str:
    """Compute deterministic SHA-256 hash of a directory tree."""
    hasher = hashlib.sha256()
    if not directory_path.exists():
        return hasher.hexdigest()

    file_paths = []
    for root, _, files in os.walk(directory_path):
        for f in files:
            file_paths.append(Path(root) / f)

    file_paths.sort(key=lambda p: str(p.relative_to(ROOT_DIR)).replace('\\', '/'))

    for p in file_paths:
        rel = str(p.relative_to(ROOT_DIR)).replace('\\', '/')
        hasher.update(rel.encode('utf-8'))
        try:
            hasher.update(p.read_bytes())
        except Exception:
            pass

    return hasher.hexdigest()

def hash_file(file_path: Path) -> str:
    """Compute SHA-256 hash of a single file."""
    if not file_path.exists():
        return ""
    return hashlib.sha256(file_path.read_bytes()).hexdigest()

def get_live_fingerprints():
    return {
        "api_src": hash_directory(ROOT_DIR / "apps" / "api" / "src"),
        "web_src": hash_directory(ROOT_DIR / "apps" / "web" / "src"),
        "migrations": hash_directory(ROOT_DIR / "database" / "migrations"),
        "contracts": hash_directory(ROOT_DIR / "packages" / "contracts" / "src"),
        "test_file": hash_file(ROOT_DIR / "apps" / "api" / "test" / "national.api.test.ts"),
    }

def run_national_tests():
    cmd = ["node", "--import", "tsx", "--test", "apps/api/test/national.api.test.ts"]
    cmd_str = "node --import tsx --test apps/api/test/national.api.test.ts"

    print(f"Running test command: {cmd_str}")
    start_time = time.time()
    iso_timestamp = datetime.now(timezone.utc).isoformat()

    process = subprocess.run(
        cmd,
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    duration_ms = round((time.time() - start_time) * 1000, 2)
    output = process.stdout + "\n" + process.stderr
    exit_code = process.returncode

    print(output)

    tests_match = re.search(r"ℹ\s+tests\s+(\d+)", output)
    pass_match = re.search(r"ℹ\s+pass\s+(\d+)", output)
    fail_match = re.search(r"ℹ\s+fail\s+(\d+)", output)
    skip_match = re.search(r"ℹ\s+skipped\s+(\d+)", output)
    dur_match = re.search(r"ℹ\s+duration_ms\s+([\d.]+)", output)

    total_tests = int(tests_match.group(1)) if tests_match else 0
    passed_tests = int(pass_match.group(1)) if pass_match else 0
    failed_tests = int(fail_match.group(1)) if fail_match else 0
    skipped_tests = int(skip_match.group(1)) if skip_match else 0
    reported_duration = float(dur_match.group(1)) if dur_match else duration_ms

    fingerprints = get_live_fingerprints()

    record = {
        "suite_id": "national_manager_api",
        "command": cmd_str,
        "exit_code": exit_code,
        "timestamp": iso_timestamp,
        "test_runner_results": {
            "total": total_tests,
            "pass": passed_tests,
            "fail": failed_tests,
            "skipped": skipped_tests,
            "duration_ms": reported_duration,
        },
        "fingerprints": fingerprints,
        "overall_status": "PASS" if (exit_code == 0 and failed_tests == 0 and passed_tests > 0) else "FAIL"
    }

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    RECORD_FILE.write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(f"\nExecution record saved to: {RECORD_FILE}")
    print(f"Status: {record['overall_status']} ({passed_tests}/{total_tests} passed in {reported_duration}ms)")

    return record

if __name__ == "__main__":
    rec = run_national_tests()
    if rec["overall_status"] != "PASS":
        sys.exit(1)
    sys.exit(0)
