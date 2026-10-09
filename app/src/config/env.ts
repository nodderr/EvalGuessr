/**
 * The only place the app reads environment variables.
 * Vite inlines VITE_* variables at build time; set them in Vercel's project settings.
 */

/**
 * Game server URL. In development it defaults to the local server
 * (`npm run dev` at the repo root starts both). Production builds read it from
 * app/.env.production (overridable in Vercel project settings).
 */
export const API_BASE_URL: string | null =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:3001" : null);
