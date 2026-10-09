/**
 * Loads the position pool (with evals) from server/data/positions.json.
 * This file never leaves the server; clients only see positions through viewFor().
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PositionRecord } from "@eval-guess/shared";

// Resolves to server/data from both src/ (dev, tsx) and dist/ (built).
const POSITIONS_FILE = fileURLToPath(new URL("../data/positions.json", import.meta.url));

export function loadPositions(file: string = POSITIONS_FILE): PositionRecord[] {
  const pool = JSON.parse(readFileSync(file, "utf-8")) as PositionRecord[];
  if (!Array.isArray(pool) || pool.length === 0) throw new Error(`No positions in ${file}`);
  return pool;
}
