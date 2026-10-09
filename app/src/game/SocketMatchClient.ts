/**
 * MatchClient backed by the game server over Socket.IO.
 *
 * The server pushes a full MatchView after every change, so this class only
 * forwards actions and remembers the seat (in sessionStorage) to rejoin after
 * a dropped connection or a page reload.
 */
import { io, type Socket } from "socket.io-client";
import type { Ack, ClientToServerEvents, MatchView, Seat, ServerToClientEvents } from "@eval-guess/shared";
import type { AbandonReason, ConnectionStatus, CreateMatchOptions, MatchClient } from "./MatchClient";
import { loadSeat, saveSeat } from "./storage";

/** After this long without a first connection, tell the player the server is waking up. */
const WAKING_AFTER_MS = 3000;
/** Joining may have to wait for a sleeping free-tier server (~50s) to start. */
const SETUP_TIMEOUT_MS = 75_000;
const ACTION_TIMEOUT_MS = 10_000;

/** Readable messages for the server's error codes. */
const MESSAGES: Record<string, string> = {
  MATCH_NOT_FOUND: "No match with that code. Check it and try again.",
  MATCH_FULL: "That match is already full.",
  NOT_IN_LOBBY: "That match has already started.",
  TOO_LATE: "Time was up before your guess arrived.",
  ALREADY_GUESSED: "Your guess is already locked in.",
  SERVER_BUSY: "The server is busy. Try again in a minute.",
  INVALID_REQUEST: "Something was wrong with that request.",
  TIMEOUT: "The server didn't answer. Check your connection and try again.",
};

export class ServerError extends Error {
  constructor(public readonly code: string) {
    super(MESSAGES[code] ?? `Server error (${code})`);
  }
}

export class SocketMatchClient implements MatchClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private view: MatchView | null = null;
  private status: ConnectionStatus = "connecting";
  private seat: Seat | null = loadSeat();
  private viewListeners = new Set<(view: MatchView | null) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private abandonListeners = new Set<(reason: AbandonReason) => void>();

  constructor(url: string) {
    this.socket = io(url, { transports: ["websocket", "polling"] });
    const waking = setTimeout(() => this.status === "connecting" && this.setStatus("waking"), WAKING_AFTER_MS);

    this.socket.on("connect", () => {
      clearTimeout(waking);
      const wasReconnect = this.status === "reconnecting";
      this.setStatus("connected");
      // A new connection has no seat on the server: re-attach automatically.
      if (wasReconnect && this.seat) void this.resume();
    });
    this.socket.on("disconnect", () => this.setStatus("reconnecting"));
    this.socket.on("match:state", (view) => this.setView(view));
    this.socket.on("match:abandoned", ({ reason }) => {
      this.forgetSeat();
      this.abandonListeners.forEach((l) => l(reason));
    });
  }

  subscribe(listener: (view: MatchView | null) => void): () => void {
    this.viewListeners.add(listener);
    listener(this.view);
    return () => this.viewListeners.delete(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onAbandoned(listener: (reason: AbandonReason) => void): () => void {
    this.abandonListeners.add(listener);
    return () => this.abandonListeners.delete(listener);
  }

  async create(opts: CreateMatchOptions): Promise<void> {
    this.setView(null);
    this.rememberSeat(await this.call(this.socket.timeout(SETUP_TIMEOUT_MS).emitWithAck("match:create", opts)));
  }

  async join(matchId: string, name: string): Promise<void> {
    this.setView(null);
    this.rememberSeat(
      await this.call(this.socket.timeout(SETUP_TIMEOUT_MS).emitWithAck("match:join", { matchId, name })),
    );
  }

  async resume(): Promise<boolean> {
    if (!this.seat) return false;
    try {
      await this.call(this.socket.timeout(SETUP_TIMEOUT_MS).emitWithAck("match:rejoin", this.seat));
      return true;
    } catch {
      this.forgetSeat(); // the match is gone (finished and cleaned up, or called off)
      return false;
    }
  }

  async submitGuess(guess: number): Promise<void> {
    await this.call(this.socket.timeout(ACTION_TIMEOUT_MS).emitWithAck("guess:submit", { guess }));
  }

  async ready(): Promise<void> {
    await this.call(this.socket.timeout(ACTION_TIMEOUT_MS).emitWithAck("round:ready"));
  }

  async rematch(): Promise<void> {
    await this.call(this.socket.timeout(ACTION_TIMEOUT_MS).emitWithAck("match:rematch"));
  }

  leave(): void {
    this.socket.emit("match:leave");
    this.forgetSeat();
    this.setView(null);
  }

  /**
   * Await an ack and unwrap it. Socket.IO buffers emits made while disconnected
   * and sends them on reconnect; the timeout covers a server that never answers.
   */
  private async call<T>(pending: Promise<Ack<T>>): Promise<T> {
    let res: Ack<T>;
    try {
      res = await pending;
    } catch {
      throw new ServerError("TIMEOUT");
    }
    if (!res.ok) throw new ServerError(res.error);
    return res.data;
  }

  private rememberSeat(seat: Seat): void {
    this.seat = seat;
    saveSeat(seat);
  }

  private forgetSeat(): void {
    this.seat = null;
    saveSeat(null);
  }

  private setView(view: MatchView | null): void {
    this.view = view;
    this.viewListeners.forEach((l) => l(view));
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }
}
