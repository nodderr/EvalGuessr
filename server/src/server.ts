/**
 * HTTP + Socket.IO wiring. Translates socket events into RoomManager calls,
 * validating every payload and remembering which seat each connection holds.
 */
import { createServer, type Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { Ack, ClientToServerEvents, PositionRecord, Seat, ServerToClientEvents } from "@eval-guess/shared";
import { RoomManager, errorCode } from "./rooms";
import * as validate from "./validate";

type SocketData = { seat?: Pick<Seat, "matchId" | "playerId"> };
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export type GameServer = {
  http: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  rooms: RoomManager;
  close: () => Promise<void>;
};

export function createGameServer(opts: {
  pool: PositionRecord[];
  /** Allowed browser origins (your Vercel URL). Undefined allows any origin: fine locally, not in production. */
  allowedOrigins?: string[];
}): GameServer {
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404).end();
  });

  const io: GameServer["io"] = new Server(http, {
    cors: { origin: opts.allowedOrigins ?? true },
    // Detect dead connections (phone locked, network gone) within ~25s.
    pingInterval: 10_000,
    pingTimeout: 15_000,
  });

  const rooms = new RoomManager(opts.pool, (connectionId, event, ...args) => {
    io.to(connectionId).emit(event, ...args);
  });

  io.on("connection", (socket: GameSocket) => {
    /** Run a handler and report the outcome through the ack, never throwing into Socket.IO. */
    const handle = <T>(ack: unknown, fn: () => T) => {
      const reply = typeof ack === "function" ? (ack as (res: Ack<T>) => void) : () => {};
      try {
        reply({ ok: true, data: fn() });
      } catch (err) {
        const code = errorCode(err);
        if (code) return reply({ ok: false, error: code });
        if (err instanceof validate.InvalidRequest) return reply({ ok: false, error: "INVALID_REQUEST", message: err.message });
        console.error("Unexpected error handling socket event:", err);
        reply({ ok: false, error: "INVALID_REQUEST" });
      }
    };

    const requireSeat = () => {
      if (!socket.data.seat) throw new validate.InvalidRequest("Not in a match");
      return socket.data.seat;
    };

    /** One match per connection: leaving the old seat before taking a new one. */
    const takeSeat = (seat: Seat): Seat => {
      if (socket.data.seat && socket.data.seat.matchId !== seat.matchId) rooms.leave(socket.data.seat);
      socket.data.seat = { matchId: seat.matchId, playerId: seat.playerId };
      return seat;
    };

    socket.on("match:create", (req, ack) =>
      handle(ack, () => {
        const seat = rooms.create(socket.id, validate.createRequest(req));
        return takeSeat(seat);
      }),
    );

    socket.on("match:join", (req, ack) =>
      handle(ack, () => takeSeat(rooms.join(socket.id, validate.joinRequest(req)))),
    );

    socket.on("match:rejoin", (req, ack) =>
      handle(ack, () => takeSeat(rooms.rejoin(socket.id, validate.seat(req)))),
    );

    socket.on("guess:submit", (req, ack) =>
      handle(ack, () => {
        rooms.submitGuess(requireSeat(), validate.guess(req));
        return null;
      }),
    );

    socket.on("round:ready", (ack) =>
      handle(ack, () => {
        rooms.ready(requireSeat());
        return null;
      }),
    );

    socket.on("match:rematch", (ack) =>
      handle(ack, () => {
        rooms.requestRematch(requireSeat());
        return null;
      }),
    );

    socket.on("match:finish", (ack) =>
      handle(ack, () => {
        rooms.finish(requireSeat());
        return null;
      }),
    );

    socket.on("match:leave", () => {
      if (socket.data.seat) rooms.leave(socket.data.seat);
      socket.data.seat = undefined;
    });

    socket.on("disconnect", () => {
      if (socket.data.seat) rooms.disconnected(socket.data.seat, socket.id);
    });
  });

  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        rooms.closeAll();
        io.close(() => resolve());
      }),
  };
}
