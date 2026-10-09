import { useEffect, useState } from "react";
import type { TimeControl } from "@eval-guess/shared";
import { Button } from "./components/Button";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { API_BASE_URL } from "./config/env";
import type { MatchClient } from "./game/MatchClient";
import { SocketMatchClient } from "./game/SocketMatchClient";
import { loadName, saveName } from "./game/storage";
import { useConnectionStatus, useMatchView } from "./game/useMatch";
import { Home } from "./screens/Home";
import { Screen } from "./screens/Layout";
import { MatchScreen } from "./screens/MatchScreen";
import { CreateMatch, JoinMatch } from "./screens/OnlineSetup";
import { Summary } from "./screens/Summary";
import { TimeControlSelect } from "./screens/TimeControlSelect";
import { Tutorial } from "./screens/Tutorial";
import { WaitingRoom } from "./screens/WaitingRoom";

type Route = "home" | "tutorial" | "practiceTime" | "create" | "join" | "match";

/** One connection to the game server for the whole session. */
const client: MatchClient | null = API_BASE_URL ? new SocketMatchClient(API_BASE_URL) : null;

/** A share link looks like /?join=K7QPX. Read it once, then tidy the URL. */
function takeJoinCode(): string {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("join") ?? "";
  if (code) window.history.replaceState(null, "", window.location.pathname);
  return code;
}

export function App() {
  if (!client) {
    return (
      <Screen>
        <div className="mx-auto grid max-w-md gap-3 pt-16">
          <h1 className="text-2xl font-semibold">Server not configured</h1>
          <p className="text-ink-muted">Set VITE_API_BASE_URL to the game server's URL and rebuild.</p>
        </div>
      </Screen>
    );
  }
  return <Game client={client} />;
}

/**
 * Navigation only. Match state lives on the server and arrives through the
 * MatchClient; this component decides which screen to show.
 */
function Game({ client }: { client: MatchClient }) {
  const [joinCode] = useState(takeJoinCode);
  const [route, setRoute] = useState<Route>(joinCode ? "join" : "home");
  const [practiceTc, setPracticeTc] = useState<TimeControl | null>("blitz");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const view = useMatchView(client);
  const status = useConnectionStatus(client);

  // After a reload, go straight back into a match this tab was playing.
  useEffect(() => {
    void client.resume().then((resumed) => resumed && setRoute("match"));
  }, [client]);

  // The opponent left or never came back.
  useEffect(
    () =>
      client.onAbandoned((reason) => {
        setNotice(
          reason === "opponent_left" ? "Opponent left." : "Opponent disconnected.",
        );
        setRoute("home");
      }),
    [client],
  );

  const go = (next: Route) => {
    setError(null);
    setNotice(null);
    setRoute(next);
  };

  /** Run a create/join request with a busy flag; on success show the match. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setRoute("match");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  /** tc = null starts endless mode (no clock, no position limit). */
  const startPractice = (tc: TimeControl | null) => {
    setPracticeTc(tc);
    void run(() =>
      client.create({ mode: tc ? "practice" : "endless", timeControl: tc, name: loadName() || "You" }),
    );
  };

  const leaveToHome = () => {
    client.leave();
    go("home");
  };

  const page = (() => {
    switch (route) {
      case "home":
        return (
          <Home
            onPractice={() => go("practiceTime")}
            onPlayFriend={() => go("create")}
            onJoinFriend={() => go("join")}
            onTutorial={() => go("tutorial")}
            notice={notice}
          />
        );
      case "tutorial":
        return <Tutorial onBack={() => go("home")} onStart={() => go("practiceTime")} />;
      case "practiceTime":
        return <TimeControlSelect onBack={() => go("home")} onPick={startPractice} busy={busy} error={error} />;
      case "create":
        return (
          <CreateMatch
            initialName={loadName()}
            busy={busy}
            error={error}
            onBack={() => go("home")}
            onCreate={(name, tc) => {
              saveName(name);
              void run(() => client.create({ mode: "online", timeControl: tc, name }));
            }}
          />
        );
      case "join":
        return (
          <JoinMatch
            initialName={loadName()}
            initialCode={joinCode}
            busy={busy}
            error={error}
            onBack={() => go("home")}
            onJoin={(name, code) => {
              saveName(name);
              void run(() => client.join(code, name));
            }}
          />
        );
      case "match":
        if (!view) return <MatchSkeleton />;
        if (view.phase === "lobby") return <WaitingRoom view={view} onCancel={leaveToHome} />;
        if (view.phase === "finished") {
          return (
            <Summary
              view={view}
              onPlayAgain={() =>
                view.mode === "online" ? void client.rematch().catch(() => {}) : startPractice(practiceTc)
              }
              onHome={leaveToHome}
            />
          );
        }
        return <MatchScreen key={`${view.id}-${view.roundIndex}`} view={view} client={client} onQuit={leaveToHome} />;
    }
  })();

  return (
    <>
      <ConnectionBanner status={status} />
      {page}
    </>
  );
}

/** Loading state shaped like the match screen. */
function MatchSkeleton() {
  return (
    <Screen split>
      <div className="h-11 lg:col-span-2" />
      <div className="grid gap-3" aria-busy="true" aria-label="Loading match">
        <div className="h-5 w-28 animate-pulse rounded bg-line" />
        <div className="aspect-square w-full animate-pulse rounded-md bg-line" />
      </div>
      <div className="grid gap-4">
        <div className="h-10 animate-pulse rounded bg-line" />
        <div className="h-12 animate-pulse rounded-xl bg-line" />
      </div>
    </Screen>
  );
}
