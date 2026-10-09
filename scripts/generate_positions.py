"""
Offline position pipeline: FEN list -> Stockfish analysis -> positions.json.

Runs only on a developer machine with a local Stockfish binary. The output is a
static JSON file that ships with the frontend (app/public/data/positions.json).

Usage:
    python scripts/generate_positions.py --stockfish "C:/path/to/stockfish.exe"
    python scripts/generate_positions.py --count 10 --time 5

The Stockfish path can also come from the STOCKFISH_PATH environment variable.
Evals are recorded in centipawns from White's perspective
(positive = White better, negative = Black better). Positions where Stockfish
reports a forced mate are skipped; the next FEN in the input takes their place.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import chess
import chess.engine

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / "scripts" / "positions_input.txt"
DEFAULT_OUTPUT = REPO_ROOT / "app" / "public" / "data" / "positions.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyse FENs with Stockfish and write positions.json.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="Text file with one FEN per line ('#' comments allowed).")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help="Where to write positions.json.")
    parser.add_argument("--stockfish", default=os.environ.get("STOCKFISH_PATH"),
                        help="Path to the Stockfish binary (default: $STOCKFISH_PATH).")
    parser.add_argument("--time", type=float, default=5.0,
                        help="Seconds of analysis per position (default: 5).")
    parser.add_argument("--count", type=int, default=None,
                        help="Stop after this many usable positions (default: use every FEN).")
    parser.add_argument("--threads", type=int, default=max(1, (os.cpu_count() or 2) - 1),
                        help="Stockfish Threads option.")
    parser.add_argument("--hash", type=int, default=256, help="Stockfish Hash option in MB.")
    return parser.parse_args()


def read_fens(path: Path) -> list[str]:
    """Return FENs from the input file, skipping blank lines and comments."""
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]


def load_board(fen: str) -> chess.Board | None:
    """Parse a FEN, returning None if it is malformed, illegal, or already game over."""
    try:
        board = chess.Board(fen)
    except ValueError:
        return None
    if not board.is_valid() or board.is_game_over():
        return None
    return board


def analyse(engine: chess.engine.SimpleEngine, board: chess.Board, seconds: float) -> dict | None:
    """Analyse one position. Returns None if Stockfish sees a forced mate."""
    info = engine.analyse(board, chess.engine.Limit(time=seconds))
    score = info["score"].white()  # always from White's perspective
    if score.is_mate():
        return None
    best = info.get("pv", [None])[0]
    return {
        "eval_cp": score.score(),
        "depth_reached": info.get("depth"),
        "best_move": board.san(best) if best else None,  # SAN, e.g. "Nf3"
    }


def main() -> int:
    args = parse_args()
    if not args.stockfish:
        print("No Stockfish binary given. Use --stockfish or set STOCKFISH_PATH.", file=sys.stderr)
        return 1

    fens = read_fens(args.input)
    target = args.count or len(fens)
    print(f"{len(fens)} FENs in {args.input.name}; aiming for {target} positions at {args.time}s each.")

    positions: list[dict] = []
    seen: set[str] = set()
    started = time.time()

    with chess.engine.SimpleEngine.popen_uci(args.stockfish) as engine:
        engine.configure({"Threads": args.threads, "Hash": args.hash})
        print(f"Engine: {engine.id.get('name', 'unknown')}")

        for line_no, fen in enumerate(fens, start=1):
            if len(positions) >= target:
                break

            board = load_board(fen)
            if board is None:
                print(f"  skip  #{line_no}: invalid or finished position")
                continue
            # Dedupe on the piece placement + side + castling + en passant,
            # ignoring move counters, so the same position isn't asked twice.
            key = board.epd()
            if key in seen:
                print(f"  skip  #{line_no}: duplicate position")
                continue
            seen.add(key)

            result = analyse(engine, board, args.time)
            if result is None:
                print(f"  skip  #{line_no}: forced mate (out of scope)")
                continue

            entry = {
                "id": len(positions) + 1,
                "fen": board.fen(),
                "side_to_move": "white" if board.turn == chess.WHITE else "black",
                **result,
            }
            positions.append(entry)
            print(f"  keep  #{line_no}: {entry['eval_cp']:+5d} cp  depth {entry['depth_reached']:>2}  "
                  f"best {entry['best_move']}")

    if len(positions) < target:
        print(f"Warning: only {len(positions)} usable positions (wanted {target}). Add more FENs.",
              file=sys.stderr)

    # Write to a temp file first so a crash never leaves a half-written JSON behind.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.output.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(positions, indent=2) + "\n", encoding="utf-8")
    tmp.replace(args.output)

    print(f"Wrote {len(positions)} positions to {args.output} in {time.time() - started:.0f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
