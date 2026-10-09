"""
Offline position pipeline: candidate positions -> Stockfish analysis -> positions.json.

Runs only on a developer machine with a local Stockfish binary. The output is a
JSON file read by the game server (server/data/positions.json). It is NOT
shipped to the browser: evals are answers, so the server only reveals each one
after every player has locked in a guess.

Usage:
    python scripts/generate_positions.py --stockfish "C:/path/to/stockfish.exe"
    python scripts/generate_positions.py --input scripts/lichess_candidates.jsonl --count 200 --balance

Parallel analysis: --workers Stockfish processes run side by side, each with
--threads threads, so several positions are analysed at once. Every position
still gets --time seconds; fewer threads per position means slightly lower
depth, in exchange for a much faster run.

Evals are recorded in centipawns from White's perspective (positive = White
better). Positions where Stockfish reports a forced mate are skipped.
Press Ctrl+C at any time to stop and save the positions kept so far.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path

import chess
import chess.engine

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = REPO_ROOT / "scripts" / "positions_input.txt"
DEFAULT_OUTPUT = REPO_ROOT / "server" / "data" / "positions.json"
CPUS = os.cpu_count() or 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyse positions with Stockfish and write positions.json.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="A .jsonl file from fetch_lichess_positions.py, or a text file with one FEN per line.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Where to write positions.json.")
    parser.add_argument("--stockfish", default=os.environ.get("STOCKFISH_PATH"),
                        help="Path to the Stockfish binary (default: $STOCKFISH_PATH).")
    parser.add_argument("--time", type=float, default=5.0, help="Seconds of analysis per position (default: 5).")
    parser.add_argument("--count", type=int, default=None,
                        help="Stop after this many usable positions (default: use every input).")
    parser.add_argument("--workers", type=int, default=4,
                        help="Positions analysed at the same time, one Stockfish process each (default: 4).")
    parser.add_argument("--threads", type=int, default=None,
                        help=f"Stockfish threads per worker (default: spread {CPUS - 1} threads over the workers).")
    parser.add_argument("--hash", type=int, default=256, help="Stockfish hash per worker, in MB (default: 256).")
    parser.add_argument("--line-plies", type=int, default=5,
                        help="Half-moves of Stockfish's main line to store (default: 5).")
    parser.add_argument("--balance", action="store_true",
                        help="Even split of near-equal, White-better and Black-better positions.")
    parser.add_argument("--equal-window", type=float, default=1.0,
                        help="With --balance: |eval| up to this many pawns counts as near equal (default: 1.0).")
    parser.add_argument("--max-eval", type=float, default=None,
                        help="Skip positions more lopsided than this many pawns, e.g. 6 (default: no limit).")
    parser.add_argument("--verbose", action="store_true", help="Also print every skipped position.")
    args = parser.parse_args()
    args.workers = max(1, args.workers)
    if args.threads is None:
        args.threads = max(1, (CPUS - 1) // args.workers)
    return args


# ---------------------------------------------------------------------------
# Inputs and outputs
# ---------------------------------------------------------------------------

def read_inputs(path: Path) -> list[tuple[str, dict | None]]:
    """
    Return (fen, source) pairs from the input file.

    Two formats: a .jsonl file with {"fen": ..., "source": {...}} per line
    (from fetch_lichess_positions.py), or plain text with one FEN per line
    ('#' comments allowed) and no source.
    """
    lines = [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines()]
    if path.suffix == ".jsonl":
        rows = [json.loads(ln) for ln in lines if ln]
        return [(row["fen"], row.get("source")) for row in rows]
    return [(ln, None) for ln in lines if ln and not ln.startswith("#")]


def write_atomic(path: Path, positions: list[dict]) -> None:
    """Write to a temp file first so a crash never leaves a half-written JSON behind."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(positions, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def load_board(fen: str) -> chess.Board | None:
    """Parse a FEN, returning None if it is malformed, illegal, or already game over."""
    try:
        board = chess.Board(fen)
    except ValueError:
        return None
    if not board.is_valid() or board.is_game_over():
        return None
    return board


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def pv_to_san(board: chess.Board, pv: list[chess.Move], plies: int) -> list[str]:
    """The first `plies` moves of a principal variation, in SAN (e.g. ["Nf3", "d5", "c4"])."""
    line, b = [], board.copy(stack=False)
    for move in pv[:plies]:
        if move not in b.legal_moves:  # defensive: stop at anything unexpected
            break
        line.append(b.san(move))
        b.push(move)
    return line


def analyse(engine: chess.engine.SimpleEngine, board: chess.Board, seconds: float, line_plies: int) -> dict | None:
    """Analyse one position. Returns None if Stockfish sees a forced mate."""
    info = engine.analyse(board, chess.engine.Limit(time=seconds))
    score = info["score"].white()  # always from White's perspective
    if score.is_mate():
        return None
    line = pv_to_san(board, info.get("pv", []), line_plies)
    return {
        "eval_cp": score.score(),
        "depth_reached": info.get("depth"),
        "best_move": line[0] if line else None,  # SAN, e.g. "Nf3"
        "line": line,  # Stockfish's main line from this position, SAN, best move first
    }


class EnginePool:
    """One Stockfish process per worker; a worker borrows an engine for each position."""

    def __init__(self, path: str, workers: int, threads: int, hash_mb: int):
        self.engines: list[chess.engine.SimpleEngine] = []
        self.free: queue.Queue[chess.engine.SimpleEngine] = queue.Queue()
        for _ in range(workers):
            engine = chess.engine.SimpleEngine.popen_uci(path)
            engine.configure({"Threads": threads, "Hash": hash_mb})
            self.engines.append(engine)
            self.free.put(engine)

    @property
    def name(self) -> str:
        return self.engines[0].id.get("name", "unknown") if self.engines else "unknown"

    def analyse(self, board: chess.Board, seconds: float, line_plies: int) -> dict | None:
        engine = self.free.get()
        try:
            return analyse(engine, board, seconds, line_plies)
        finally:
            self.free.put(engine)

    def close(self) -> None:
        for engine in self.engines:
            try:
                engine.quit()
            except Exception:  # already gone (e.g. after Ctrl+C)
                pass


# ---------------------------------------------------------------------------
# Progress display
# ---------------------------------------------------------------------------

def fmt_duration(seconds: float) -> str:
    seconds = int(max(0, seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h{m:02d}m" if h else f"{m}m{s:02d}s"


class Progress:
    """
    A live status line (rewritten in place in a terminal, printed every few
    positions when output goes to a file), with kept positions logged above it.
    """

    def __init__(self, total_inputs: int, target: int, quota: int | None):
        self.total_inputs, self.target, self.quota = total_inputs, target, quota
        self.analysed = 0
        self.kept = 0
        self.groups = {"equal": 0, "white": 0, "black": 0}
        self.skipped = {"invalid": 0, "duplicate": 0, "mate": 0, "lopsided": 0, "group full": 0}
        self.started = time.time()
        self.tty = sys.stdout.isatty()
        self._width = 0
        self._last_printed = -1  # when not a terminal: last 'analysed' count printed

    def status(self) -> str:
        elapsed = time.time() - self.started
        rate = self.analysed / elapsed * 60 if elapsed > 0 else 0.0
        keep_rate = self.kept / elapsed if elapsed > 0 else 0.0
        eta = fmt_duration((self.target - self.kept) / keep_rate) if keep_rate > 0 else "?"
        groups = ""
        if self.quota is not None:
            g = self.groups
            groups = f" [= {g['equal']}/{self.quota}  W {g['white']}/{self.quota}  B {g['black']}/{self.quota}]"
        skips = "  ".join(f"{k} {v}" for k, v in self.skipped.items() if v)
        return (f"analysed {self.analysed}/{self.total_inputs} | kept {self.kept}/{self.target}{groups}"
                f" | skipped {sum(self.skipped.values())}{f' ({skips})' if skips else ''}"
                f" | {rate:.1f}/min | {fmt_duration(elapsed)} elapsed, ~{eta} left")

    def _clear(self) -> None:
        if self.tty and self._width:
            sys.stdout.write("\r" + " " * self._width + "\r")

    def log(self, message: str) -> None:
        """Print a line above the status line."""
        self._clear()
        print(message)
        if self.tty:
            self.refresh()

    def refresh(self) -> None:
        line = self.status()
        if self.tty:
            # One line, rewritten in place.
            self._clear()
            sys.stdout.write(line)
            sys.stdout.flush()
            self._width = len(line)
        elif self.analysed % 10 == 0 and self.analysed != self._last_printed:
            # Output going to a file: a status line every 10 positions.
            print(line)
            self._last_printed = self.analysed

    def done(self) -> None:
        if self.tty:
            sys.stdout.write("\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    sys.stdout.reconfigure(line_buffering=True)
    args = parse_args()
    if not args.stockfish:
        print("No Stockfish binary given. Use --stockfish or set STOCKFISH_PATH.", file=sys.stderr)
        return 1

    inputs = read_inputs(args.input)
    target = args.count or len(inputs)
    # With --balance, each group (near equal / White better / Black better) gets a third of the target.
    quota = -(-target // 3) if args.balance else None
    equal_cp = round(args.equal_window * 100)
    max_cp = round(args.max_eval * 100) if args.max_eval is not None else None

    progress = Progress(len(inputs), target, quota)

    # Cheap checks first (in this thread), so workers only get real work.
    jobs: list[tuple[int, chess.Board, dict | None]] = []
    seen: set[str] = set()
    for n, (fen, source) in enumerate(inputs, start=1):
        board = load_board(fen)
        if board is None:
            progress.skipped["invalid"] += 1
            continue
        key = board.epd()  # ignores move counters, so the same position isn't asked twice
        if key in seen:
            progress.skipped["duplicate"] += 1
            continue
        seen.add(key)
        jobs.append((n, board, source))

    print(f"Engine: {args.workers} worker(s) x {args.threads} thread(s) = {args.workers * args.threads} "
          f"of {CPUS} CPU threads, {args.hash} MB hash each, {args.time:g}s per position.")
    print(f"Input: {len(inputs)} positions in {args.input.name} ({len(jobs)} after removing invalid/duplicates).")
    print(f"Target: {target} positions"
          + (f", balanced {quota} per group (near equal = within +/-{args.equal_window:g})" if quota else "")
          + (f", skipping evals beyond +/-{args.max_eval:g}" if max_cp is not None else "") + ".")
    print(f"Output: {args.output}   (Ctrl+C stops and saves what's kept so far)\n")

    positions: list[dict] = []

    def full() -> bool:
        if len(positions) >= target:
            return True
        return quota is not None and all(v >= quota for v in progress.groups.values())

    def accept(n: int, board: chess.Board, source: dict | None, result: dict | None) -> None:
        progress.analysed += 1
        if result is None:
            progress.skipped["mate"] += 1
            if args.verbose:
                progress.log(f"  skip  #{n}: forced mate")
            return
        cp = result["eval_cp"]
        if max_cp is not None and abs(cp) > max_cp:
            progress.skipped["lopsided"] += 1
            if args.verbose:
                progress.log(f"  skip  #{n}: {cp / 100:+.2f}, beyond +/-{args.max_eval:g}")
            return
        group = "equal" if abs(cp) <= equal_cp else ("white" if cp > 0 else "black")
        if quota is not None and progress.groups[group] >= quota:
            progress.skipped["group full"] += 1
            if args.verbose:
                progress.log(f"  skip  #{n}: {cp / 100:+.2f}, '{group}' group full")
            return
        if full():
            return  # finished while this one was still running
        progress.groups[group] += 1
        entry = {
            "id": len(positions) + 1,
            "fen": board.fen(),
            "side_to_move": "white" if board.turn == chess.WHITE else "black",
            **result,
        }
        if source:
            entry["source"] = source  # where the position came from, shown after the reveal
        positions.append(entry)
        progress.kept = len(positions)
        progress.log(f"  keep  {cp / 100:+6.2f}  depth {entry['depth_reached']:>2}  "
                     f"[{len(positions)}/{target}]  {' '.join(entry['line'])}")
        if len(positions) % 20 == 0:
            write_atomic(args.output, positions)  # checkpoint long runs

    pool = EnginePool(args.stockfish, args.workers, args.threads, args.hash)
    print(f"Started {args.workers} x {pool.name}.\n")
    executor = ThreadPoolExecutor(max_workers=args.workers)
    pending: dict[Future, tuple[int, chess.Board, dict | None]] = {}
    next_job = 0
    interrupted = False
    try:
        while True:
            # Keep every worker busy, without queueing far ahead (so we stop promptly when done).
            while not full() and next_job < len(jobs) and len(pending) < args.workers:
                n, board, source = jobs[next_job]
                next_job += 1
                pending[executor.submit(pool.analyse, board, args.time, args.line_plies)] = (n, board, source)
            if not pending:
                break
            finished, _ = wait(pending, timeout=1.0, return_when=FIRST_COMPLETED)
            for future in finished:
                n, board, source = pending.pop(future)
                accept(n, board, source, future.result())
            progress.refresh()
    except KeyboardInterrupt:
        interrupted = True
        progress.log("\nStopping: saving the positions kept so far...")
    finally:
        executor.shutdown(wait=not interrupted, cancel_futures=True)
        pool.close()
        progress.done()

    if not positions:
        # Never replace a working pool with an empty one (the server refuses to start without positions).
        print(f"\nNo positions kept; {args.output} was left unchanged.")
        return 130 if interrupted else 1
    write_atomic(args.output, positions)
    g = progress.groups
    print(f"\n{'Stopped' if interrupted else 'Done'}: kept {len(positions)}/{target} positions "
          f"from {progress.analysed} analysed in {fmt_duration(time.time() - progress.started)}.")
    if quota is not None:
        print(f"Groups: {g['equal']} near equal, {g['white']} White better, {g['black']} Black better.")
    skips = ", ".join(f"{v} {k}" for k, v in progress.skipped.items() if v)
    if skips:
        print(f"Skipped: {skips}.")
    if len(positions) < target and not interrupted:
        print(f"Only {len(positions)} of {target}: fetch more candidates (fetch_lichess_positions.py --count).")
    if positions:
        depths = sorted(p["depth_reached"] for p in positions)
        print(f"Depth: min {depths[0]}, median {depths[len(depths) // 2]}, max {depths[-1]}.")
    print(f"Wrote {args.output}. Restart the game server to load it.")
    return 130 if interrupted else 0


if __name__ == "__main__":
    sys.exit(main())
