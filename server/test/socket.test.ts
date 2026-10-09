/**
 * End-to-end over real sockets: two clients play a full match against the server.
 */
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { MATCH, type Ack, type ClientToServerEvents, type MatchView, type Seat, type ServerToClientEvents } from "@eval-guess/shared";
import { loadPositions } from "../src/positions";
import { createGameServer, type GameServer } from "../src/server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: GameServer;
let url: string;
const clients: Client[] = [];

beforeAll(async () => {
  server = createGameServer({ pool: loadPositions() });
  await new Promise<void>((resolve) => server.http.listen(0, resolve));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await server.close();
});

async function client(): Promise<{ socket: Client; views: MatchView[] }> {
  const socket: Client = connect(url, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  const views: MatchView[] = [];
  socket.on("match:state", (v) => views.push(v));
  await new Promise<void>((resolve) => socket.on("connect", resolve));
  return { socket, views };
}

function ok<T>(res: Ack<T>): T {
  if (!res.ok) throw new Error(`Server refused: ${res.error}`);
  return res.data;
}

/** Wait until a client's latest view satisfies a condition. */
async function until(views: MatchView[], pred: (v: MatchView) => boolean): Promise<MatchView> {
  for (let i = 0; i < 200; i++) {
    const v = views[views.length - 1];
    if (v && pred(v)) return v;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Timed out waiting for match state");
}

describe("socket server", () => {
  it("answers health checks", async () => {
    const res = await fetch(`${url}/health`);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("plays a full 1v1 match", async () => {
    const ana = await client();
    const ben = await client();

    const seatA: Seat = ok(await ana.socket.emitWithAck("match:create", { mode: "online", timeControl: "blitz", name: "Ana" }));
    ok(await ben.socket.emitWithAck("match:join", { matchId: seatA.matchId.toLowerCase(), name: "  Ben  " }));

    for (let r = 0; r < MATCH.positionsPerMatch; r++) {
      await until(ana.views, (v) => v.phase === "guessing" && v.roundIndex === r);
      ok(await ana.socket.emitWithAck("guess:submit", { guess: 0.5 }));
      ok(await ben.socket.emitWithAck("guess:submit", { guess: -0.5 }));
      await until(ana.views, (v) => v.phase === "revealed" && v.roundIndex === r);
      ok(await ana.socket.emitWithAck("round:ready"));
      ok(await ben.socket.emitWithAck("round:ready"));
    }

    const final = await until(ben.views, (v) => v.phase === "finished");
    expect(final.results).toHaveLength(5);
    expect(final.players.map((p) => p.name)).toEqual(["Ana", "Ben"]); // name was trimmed

    // Neither client ever received a raw position record or a token.
    const wire = JSON.stringify([...ana.views, ...ben.views]);
    expect(wire).not.toContain("eval_cp");
    expect(wire).not.toContain(seatA.token);
  });

  it("rejects bad payloads without crashing", async () => {
    const { socket } = await client();
    const bad = await socket.emitWithAck("match:create", { mode: "ranked", timeControl: "blitz", name: "X" } as never);
    expect(bad).toMatchObject({ ok: false, error: "INVALID_REQUEST" });
    const noSeat = await socket.emitWithAck("guess:submit", { guess: 1 });
    expect(noSeat).toMatchObject({ ok: false, error: "INVALID_REQUEST" });
    const nan = await socket.emitWithAck("match:join", { matchId: "<script>", name: "" });
    expect(nan).toMatchObject({ ok: false });
  });

  it("rejoins a seat on a new connection", async () => {
    const first = await client();
    const seat = ok(await first.socket.emitWithAck("match:create", { mode: "practice", timeControl: "rapid", name: "Solo" }));
    first.socket.disconnect();

    const second = await client();
    ok(await second.socket.emitWithAck("match:rejoin", seat));
    const v = await until(second.views, (view) => view.you === seat.playerId);
    expect(v.players[0]!.connected).toBe(true);
  });
});
