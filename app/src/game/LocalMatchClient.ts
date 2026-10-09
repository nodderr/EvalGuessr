/**
 * Runs a practice match entirely in the browser using the shared state machine.
 * It plays the server's role: owns the MatchState, checks the clock, and emits
 * viewFor(...) snapshots, so screens behave the same as they will online.
 */
import {
  addPlayer,
  createMatch,
  markReady,
  pickPositions,
  revealRound,
  shouldReveal,
  startMatch,
  submitGuess,
  viewFor,
  type MatchState,
  type MatchView,
} from "@eval-guess/shared";
import { getPositions } from "../data/positions";
import type { CreateMatchOptions, MatchClient } from "./MatchClient";

const PLAYER_ID = "you";
const TICK_MS = 250;

export class LocalMatchClient implements MatchClient {
  private state: MatchState | null = null;
  private listeners = new Set<(view: MatchView) => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;

  subscribe(listener: (view: MatchView) => void): () => void {
    this.listeners.add(listener);
    if (this.state) listener(viewFor(this.state, PLAYER_ID, Date.now()));
    return () => this.listeners.delete(listener);
  }

  async create({ mode, timeControl, name }: CreateMatchOptions): Promise<void> {
    if (mode !== "practice") throw new Error("Online matches need the game server.");
    const positions = pickPositions(await getPositions());
    let state = createMatch({ id: "local", mode, timeControl, positions });
    state = addPlayer(state, { id: PLAYER_ID, name });
    this.setState(startMatch(state, Date.now()));
    this.ticker ??= setInterval(() => this.tick(), TICK_MS);
  }

  async submitGuess(guess: number): Promise<void> {
    this.setState(submitGuess(this.requireState(), PLAYER_ID, guess, Date.now()));
    this.tick();
  }

  async ready(): Promise<void> {
    this.setState(markReady(this.requireState(), PLAYER_ID, Date.now()));
  }

  leave(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.state = null;
  }

  /** The server's job: close the round once everyone guessed or time ran out. */
  private tick(): void {
    if (this.state && shouldReveal(this.state, Date.now())) {
      this.setState(revealRound(this.state));
    }
  }

  private setState(state: MatchState): void {
    this.state = state;
    const view = viewFor(state, PLAYER_ID, Date.now());
    this.listeners.forEach((l) => l(view));
  }

  private requireState(): MatchState {
    if (!this.state) throw new Error("No match in progress.");
    return this.state;
  }
}
