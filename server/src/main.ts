/**
 * Entry point. Environment:
 *   PORT              port to listen on (Render sets this; default 3001)
 *   ALLOWED_ORIGINS   comma-separated browser origins, e.g. https://evalguessr.vercel.app
 *                     Leave unset locally to allow any origin.
 *   RENDER_EXTERNAL_URL  set by Render; turns on the keep-awake ping
 *   KEEP_AWAKE=false  disable the keep-awake ping
 */
import { startKeepAwake } from "./keepAwake";
import { loadPositions } from "./positions";
import { createGameServer } from "./server";

const port = Number(process.env.PORT) || 3001;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const pool = loadPositions();
const server = createGameServer({ pool, allowedOrigins: allowedOrigins?.length ? allowedOrigins : undefined });

server.http.listen(port, () => {
  console.log(`eval-guess server on :${port} with ${pool.length} positions`);
  if (!allowedOrigins?.length) console.warn("ALLOWED_ORIGINS is not set: accepting any origin (fine for local dev only).");
});

const stopKeepAwake = startKeepAwake();

// Render sends SIGTERM on deploys and restarts.
process.on("SIGTERM", () => {
  stopKeepAwake?.();
  void server.close().then(() => process.exit(0));
});
