import { BookOpen, Sword, Users } from "@phosphor-icons/react";
import { Board } from "../components/Board";
import { Button } from "../components/Button";
import { Screen } from "./Layout";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Props = {
  onPractice: () => void;
  onTutorial: () => void;
};

export function Home({ onPractice, onTutorial }: Props) {
  return (
    <Screen>
      <div className="grid items-center gap-8 pt-4 md:grid-cols-[1fr_minmax(0,420px)] md:gap-12 md:pt-16">
        <div className="grid gap-6">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight md:text-5xl">Guess the eval</h1>
          <p className="max-w-[45ch] text-lg leading-relaxed text-ink-muted">
            See a position, guess what Stockfish thinks, and score by how close you get.
          </p>
          <div className="grid gap-3 sm:max-w-sm">
            <Button onClick={onPractice}>
              <Sword size={20} weight="bold" aria-hidden />
              Practice
            </Button>
            <Button variant="secondary" disabled title="Online play is on the way">
              <Users size={20} weight="bold" aria-hidden />
              Play a friend
              <span className="text-sm font-normal text-ink-muted">Soon</span>
            </Button>
            <Button variant="secondary" onClick={onTutorial}>
              <BookOpen size={20} weight="bold" aria-hidden />
              How to play
            </Button>
          </div>
        </div>
        <div className="order-first mx-auto w-full max-w-[max(200px,calc(100dvh-460px))] md:order-none md:max-w-none">
          <Board fen={START_FEN} orientation="white" />
        </div>
      </div>
    </Screen>
  );
}
