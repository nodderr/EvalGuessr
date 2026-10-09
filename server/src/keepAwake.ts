/**
 * Render's free plan puts a web service to sleep after 15 minutes without
 * inbound traffic. Pinging our own public URL counts as inbound traffic, so
 * a ping every 10 minutes keeps the server awake.
 *
 * Render sets RENDER_EXTERNAL_URL for every web service, so this switches
 * itself on there and stays off locally. Set KEEP_AWAKE=false to disable.
 *
 * Note: free instance hours are shared per Render workspace (750/month);
 * one service awake 24/7 uses about 744.
 */
const INTERVAL_MS = 10 * 60 * 1000;

export function startKeepAwake(
  baseUrl: string | undefined = process.env.RENDER_EXTERNAL_URL,
): (() => void) | null {
  if (!baseUrl || process.env.KEEP_AWAKE === "false") return null;
  const url = new URL("/health", baseUrl).toString();
  console.log(`keep-awake: pinging ${url} every ${INTERVAL_MS / 60000} min`);

  const timer = setInterval(() => {
    fetch(url, { signal: AbortSignal.timeout(15_000) }).catch((err: unknown) => {
      console.warn("keep-awake ping failed:", err instanceof Error ? err.message : err);
    });
  }, INTERVAL_MS);
  timer.unref(); // never keep the process alive just for this
  return () => clearInterval(timer);
}
