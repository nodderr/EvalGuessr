"""
Sample candidate positions from real games in the Lichess open database.

Streams a monthly dump (https://database.lichess.org, CC0) and stops as soon as
enough candidates are collected, so only the first few MB are downloaded.
One position per game, picked at a random move, with the game's metadata kept
so the app can show where each position came from.

Output is JSON Lines, one candidate per line, ready for generate_positions.py:
    {"fen": "...", "source": {"site": "lichess", "game_id": "...", ...}}

Usage:
    python scripts/fetch_lichess_positions.py --count 600
    python scripts/generate_positions.py --input scripts/lichess_candidates.jsonl --count 200 --balance
"""

from __future__ import annotations

import argparse
import io
import json
import random
import sys
import time
import urllib.request
from pathlib import Path

import chess
import chess.pgn
import zstandard

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "scripts" / "lichess_candidates.jsonl"
DB_URL = "https://database.lichess.org/standard/lichess_db_standard_rated_{month}.pgn.zst"

SPEEDS = ("Bullet", "Blitz", "Rapid", "Classical")  # from the Event header; skips UltraBullet and Correspondence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sample positions from Lichess games.")
    parser.add_argument("--month", default="2026-09", help="Database month, YYYY-MM (default: 2026-09).")
    parser.add_argument("--count", type=int, default=600, help="Candidates to collect (default: 600).")
    parser.add_argument("--min-elo", type=int, default=1500, help="Both players at least this rated (default: 1500).")
    parser.add_argument("--min-move", type=int, default=6, help="Earliest move number to sample (default: 6).")
    parser.add_argument("--max-move", type=int, default=40, help="Latest move number to sample (default: 40).")
    parser.add_argument("--seed", type=int, default=None, help="Random seed, for a reproducible sample.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def stream_games(month: str):
    """Yield games from the monthly dump, decompressing on the fly."""
    url = DB_URL.format(month=month)
    req = urllib.request.Request(url, headers={"User-Agent": "eval-guess position sampler"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        reader = zstandard.ZstdDecompressor().stream_reader(resp)
        text = io.TextIOWrapper(reader, encoding="utf-8", errors="replace")
        while (game := chess.pgn.read_game(text)) is not None:
            yield game


def speed_of(event: str) -> str | None:
    """'Rated Blitz game' -> 'Blitz'. None for anything we don't want."""
    return next((s for s in SPEEDS if f" {s} " in f" {event} "), None)


def elo(headers: chess.pgn.Headers, side: str) -> int | None:
    try:
        return int(headers.get(f"{side}Elo", ""))
    except ValueError:
        return None


def pick_position(game: chess.pgn.Game, args: argparse.Namespace, rng: random.Random) -> tuple[dict | None, str]:
    """
    One random position from a game that passes the filters, with its metadata.
    Returns (candidate, "") or (None, reason it was rejected).
    """
    h = game.headers
    speed = speed_of(h.get("Event", ""))
    white_elo, black_elo = elo(h, "White"), elo(h, "Black")
    if speed is None:
        return None, "speed"
    if white_elo is None or black_elo is None or min(white_elo, black_elo) < args.min_elo:
        return None, "rating"
    if h.get("Variant", "Standard") != "Standard" or h.get("Termination") != "Normal":
        return None, "abandoned"  # skip abandoned and time-forfeit-on-move-1 games

    moves = list(game.mainline_moves())
    first_ply = (args.min_move - 1) * 2
    # Leave a few moves after the sample so the position isn't in the final mating sequence.
    last_ply = min((args.max_move - 1) * 2 + 1, len(moves) - 6)
    if last_ply < first_ply:
        return None, "too short"
    ply = rng.randint(first_ply, last_ply)

    board = game.board()
    for move in moves[:ply]:
        board.push(move)
    if board.is_check() or board.is_game_over():
        return None, "in check"

    game_id = h.get("Site", "").rsplit("/", 1)[-1]
    if not game_id:
        return None, "no game id"
    return {
        "fen": board.fen(),
        "source": {
            "site": "lichess",
            "game_id": game_id,
            "ply": ply,  # half-moves played before this position (for the #ply link)
            "move_number": board.fullmove_number,
            "white_elo": white_elo,
            "black_elo": black_elo,
            "speed": speed,
            "time_control": h.get("TimeControl", ""),
            "month": h.get("UTCDate", h.get("Date", ""))[:7].replace(".", "-"),
            "opening": h.get("Opening", ""),
            "result": h.get("Result", ""),
        },
    }, ""


def main() -> int:
    sys.stdout.reconfigure(line_buffering=True)
    args = parse_args()
    rng = random.Random(args.seed)
    seen: set[str] = set()
    out: list[dict] = []
    scanned = 0
    rejected: dict[str, int] = {}
    started = time.time()
    tty = sys.stdout.isatty()

    def status() -> str:
        why = "  ".join(f"{k} {v}" for k, v in sorted(rejected.items(), key=lambda kv: -kv[1]))
        return (f"scanned {scanned} games | kept {len(out)}/{args.count} | rejected {sum(rejected.values())}"
                f"{f' ({why})' if why else ''} | {time.time() - started:.0f}s")

    print(f"Streaming lichess {args.month}; collecting {args.count} positions "
          f"(both players {args.min_elo}+, moves {args.min_move}-{args.max_move}). Ctrl+C stops and saves.")
    try:
        for game in stream_games(args.month):
            scanned += 1
            cand, reason = pick_position(game, args, rng)
            if cand is not None:
                key = " ".join(cand["fen"].split()[:4])  # ignore move counters when deduping
                if key in seen:
                    cand, reason = None, "duplicate"
                else:
                    seen.add(key)
                    out.append(cand)
            if cand is None:
                rejected[reason] = rejected.get(reason, 0) + 1
            if tty:
                sys.stdout.write("\r" + status())
                sys.stdout.flush()
            elif scanned % 200 == 0:
                print(status())
            if len(out) >= args.count:
                break
    except KeyboardInterrupt:
        print("\nStopped early.")
    if tty:
        sys.stdout.write("\n")

    args.output.write_text("".join(json.dumps(c) + "\n" for c in out), encoding="utf-8")
    print(status())
    print(f"Wrote {len(out)} candidates to {args.output}")
    return 0 if out else 1


if __name__ == "__main__":
    sys.exit(main())
