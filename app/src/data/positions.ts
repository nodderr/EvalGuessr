/**
 * Data access for positions. The rest of the app never fetches positions directly.
 *
 * Evals are answers. For online play (and, once the server exists, practice too)
 * positions and their evals stay on the server, and the client only receives
 * a position's eval after a guess is locked in. This in-browser loader exists
 * only so practice can be developed before the server is built: it reads a
 * dev-only endpoint served by vite.config.ts and is unavailable in production builds.
 */
import type { PositionRecord } from "@eval-guess/shared";

export async function getPositions(): Promise<PositionRecord[]> {
  const res = await fetch("/dev-data/positions.json");
  if (!res.ok) throw new Error(`Could not load positions (${res.status})`);
  return (await res.json()) as PositionRecord[];
}
