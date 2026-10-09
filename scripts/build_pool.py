"""
One command to rebuild the position pool from real Lichess games:

  1. fetch_lichess_positions.py  samples candidate positions (+ game metadata)
  2. generate_positions.py       analyses them with Stockfish and writes
                                 server/data/positions.json, balanced

Example (PowerShell, from the repo root):
    python scripts/build_pool.py --stockfish "C:/path/to/stockfish.exe" --count 200

Every option of the two steps can be set here; run with --help for the list.
Restart the game server afterwards so it loads the new pool.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CANDIDATES = HERE / "lichess_candidates.jsonl"
CPUS = os.cpu_count() or 2


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fetch Lichess positions and analyse them into positions.json.")
    p.add_argument("--stockfish", default=os.environ.get("STOCKFISH_PATH"),
                   help="Path to the Stockfish binary (default: $STOCKFISH_PATH).")
    p.add_argument("--count", type=int, default=200, help="Positions in the final pool (default: 200).")
    p.add_argument("--candidates", type=int, default=None,
                   help="Candidates to fetch (default: 3x --count, since some are skipped).")
    p.add_argument("--month", default="2026-09", help="Lichess database month, YYYY-MM (default: 2026-09).")
    p.add_argument("--min-elo", type=int, default=1500, help="Both players at least this rated (default: 1500).")
    p.add_argument("--seed", type=int, default=None, help="Random seed for the sample.")
    p.add_argument("--time", type=float, default=5.0, help="Seconds of analysis per position (default: 5).")
    p.add_argument("--workers", type=int, default=4, help="Positions analysed at once (default: 4).")
    p.add_argument("--threads", type=int, default=None,
                   help=f"Stockfish threads per worker (default: {CPUS - 1} spread over the workers).")
    p.add_argument("--max-eval", type=float, default=None, help="Skip evals beyond ±this many pawns, e.g. 6.")
    p.add_argument("--no-balance", action="store_true", help="Don't balance near-equal / White / Black.")
    p.add_argument("--skip-fetch", action="store_true", help="Reuse the existing lichess_candidates.jsonl.")
    return p.parse_args()


def run(step: str, cmd: list[str]) -> None:
    print(f"\n=== {step} ===\n> {' '.join(cmd)}\n", flush=True)
    code = subprocess.call(cmd)
    if code != 0:
        sys.exit(f"{step} failed (exit code {code}).")


def main() -> None:
    args = parse_args()
    if not args.stockfish:
        sys.exit("No Stockfish binary given. Use --stockfish or set STOCKFISH_PATH.")

    if not args.skip_fetch:
        fetch = [sys.executable, str(HERE / "fetch_lichess_positions.py"),
                 "--month", args.month, "--count", str(args.candidates or args.count * 3),
                 "--min-elo", str(args.min_elo), "--output", str(CANDIDATES)]
        if args.seed is not None:
            fetch += ["--seed", str(args.seed)]
        run("Step 1/2: fetch candidates from Lichess", fetch)

    analyse = [sys.executable, str(HERE / "generate_positions.py"),
               "--stockfish", args.stockfish, "--input", str(CANDIDATES), "--count", str(args.count),
               "--time", str(args.time), "--workers", str(args.workers)]
    if args.threads is not None:
        analyse += ["--threads", str(args.threads)]
    if args.max_eval is not None:
        analyse += ["--max-eval", str(args.max_eval)]
    if not args.no_balance:
        analyse.append("--balance")
    run("Step 2/2: analyse with Stockfish", analyse)

    print("\nAll done. Restart the game server (npm run dev) to load the new pool.")


if __name__ == "__main__":
    main()
