import { useState } from "react";
import type { TimeControl } from "@eval-guess/shared";
import { Button } from "./components/Button";
import { LocalMatchClient } from "./game/LocalMatchClient";
import type { MatchClient } from "./game/MatchClient";
import { useMatchView } from "./game/useMatch";
import { Home } from "./screens/Home";
import { Screen } from "./screens/Layout";
import { MatchScreen } from "./screens/MatchScreen";
import { Summary } from "./screens/Summary";
import { TimeControlSelect } from "./screens/TimeControlSelect";
import { Tutorial } from "./screens/Tutorial";

type Route = "home" | "tutorial" | "timeControl" | "match";

/**
 * Navigation only. Match state lives in the MatchClient (src/game/);
 * this component decides which screen to show.
 */
export function App() {
  const [route, setRoute] = useState<Route>("home");
  const [timeControl, setTimeControl] = useState<TimeControl>("blitz");
  // A fresh client per match, so replaying always starts from a clean state.
  const [client, setClient] = useState<MatchClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useMatchView(client);

  const startPractice = async (tc: TimeControl) => {
    client?.leave();
    const next = new LocalMatchClient();
    setClient(next);
    setTimeControl(tc);
    setError(null);
    setRoute("match");
    try {
      await next.create({ mode: "practice", timeControl: tc, name: "You" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the match.");
    }
  };

  const goHome = () => {
    client?.leave();
    setClient(null);
    setRoute("home");
  };

  switch (route) {
    case "home":
      return <Home onPractice={() => setRoute("timeControl")} onTutorial={() => setRoute("tutorial")} />;
    case "tutorial":
      return <Tutorial onBack={() => setRoute("home")} onStart={() => setRoute("timeControl")} />;
    case "timeControl":
      return <TimeControlSelect onBack={() => setRoute("home")} onPick={(tc) => void startPractice(tc)} />;
    case "match":
      if (error) {
        return (
          <Screen>
            <div className="mx-auto grid max-w-md gap-4 pt-10">
              <h1 className="text-2xl font-semibold">Something went wrong</h1>
              <p role="alert" className="text-ink-muted">
                {error}
              </p>
              <Button onClick={() => void startPractice(timeControl)}>Try again</Button>
              <Button variant="secondary" onClick={goHome}>
                Home
              </Button>
            </div>
          </Screen>
        );
      }
      if (!view || !client) return <MatchSkeleton />;
      if (view.phase === "finished") {
        return <Summary view={view} onPlayAgain={() => void startPractice(timeControl)} onHome={goHome} />;
      }
      return <MatchScreen key={`${view.id}-${view.roundIndex}`} view={view} client={client} onQuit={goHome} />;
  }
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
