/**
 * The only place the app reads environment variables.
 * Vite inlines VITE_* variables at build time; set them in Vercel's project settings.
 */
export const API_BASE_URL: string | null = import.meta.env.VITE_API_BASE_URL || null;
