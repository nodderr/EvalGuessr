# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A chess eval-guessing game. Players see a position, guess Stockfish's eval on an eval-bar slider, and score by how close they get. Modes: tutorial, solo practice, and online 1v1. A match is 5 positions, with a per-position time control (bullet 10s, blitz 30s, rapid 60s).

npm workspaces monorepo:

- `scripts/`: offline Python pipeline (python-chess + a local Stockfish binary, never committed or deployed). It reads `scripts/positions_input.txt` and writes `server/data/positions.json`.
- `shared/`: pure TypeScript used by both app and server: tunable config (`config.ts`), scoring (`scoring.ts`), the match state machine (`match.ts`), and the Socket.IO event types (`protocol.ts`). It has no UI, browser, or Node dependencies, and packages import its TS source directly.
- `server/`: Node + Socket.IO game server, deployed on Render. Holds match state in memory; no database yet.
- `app/`: Vite + React frontend, deployed on Vercel as a static site.

Key invariants:

- Evals are secret answers. `positions.json` lives on the server and must never be bundled into or served to the app. Clients only receive `viewFor(state, playerId)`, which hides the eval and other players' guesses until a round is revealed. Practice mode is a 1-seat match through the same server path.
- All evals, guesses, and slider values are pawns from White's perspective (positive = White better), even when the board is flipped for Black to move.
- `match.ts` functions are pure and take `now` as a parameter. Timers and I/O belong in the server.

## Commands

```
npm install                 # from the repo root, installs all workspaces
npm test                    # all workspace tests (Vitest)
npm run typecheck
npm run dev                 # game server on :3001 + app on :5173 together (the app needs the server, even for practice)
npm run dev -w app          # app only; set VITE_API_BASE_URL to use a different server
npm run dev -w server       # server only (tsx watch)
npm run build -w server     # esbuild bundle -> server/dist/main.js; `npm start -w server` runs it
npm test -w shared -- test/match.test.ts       # a single test file
npm test -w shared -- -t "guesses are final"   # a single test by name

pip install -r scripts/requirements.txt
python scripts/generate_positions.py --stockfish <path-to-stockfish>   # or set STOCKFISH_PATH; 5s/position default
```

The repo also contains project-scoped Claude Code skills (frontend and visual-design guidance), described below.

## Skills

Skills live in `.claude/skills/<name>/SKILL.md`. They were installed with the `skills` CLI, and `skills-lock.json` records each skill's upstream source and content hash:

- Most come from the GitHub repo `Leonxlnx/taste-skill`. The installed name often differs from the upstream path; for example, `minimalist-ui` comes from `skills/minimalist-skill`.
- `frontend-design` comes from `anthropics/skills`.

Install or update skills with:

```
npx -y skills add Leonxlnx/taste-skill --skill '*' -a claude-code -y
npx -y skills add https://github.com/anthropics/skills --skill frontend-design -a claude-code -y
```

Don't hand-edit installed `SKILL.md` files. A reinstall overwrites them, and the edit would no longer match the hash in `skills-lock.json`. To customize a skill, create a new one under a different name.

Several skills overlap or conflict, so load only one design-direction skill per task:

- `design-taste-frontend` is the current default. `design-taste-frontend-v1` exists only for backward compatibility.
- `minimalist-ui`, `industrial-brutalist-ui`, `high-end-visual-design`, and `gpt-taste` each impose a different, specific aesthetic.
- `imagegen-frontend-web`, `imagegen-frontend-mobile`, and `brandkit` produce images only, not code.
- `image-to-code` expects to generate design images first and then implement them. Its instructions were written for Codex.
- `stitch-design-taste` produces `DESIGN.md` files for Google Stitch.
