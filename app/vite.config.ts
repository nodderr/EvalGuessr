import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const POSITIONS_FILE = fileURLToPath(new URL("../server/data/positions.json", import.meta.url));

/**
 * Dev-only: serve server/data/positions.json at /dev-data/positions.json so the
 * in-browser LocalMatchClient can run practice matches before the game server
 * exists. `apply: "serve"` means this never runs during `vite build`, so the
 * production bundle contains no evals.
 */
function devPositions(): Plugin {
  return {
    name: "dev-positions",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/dev-data/positions.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(POSITIONS_FILE));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devPositions()],
});
