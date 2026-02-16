// ── Unified backend configuration ────────────────────────
// Single source of truth for the API base URL across the app.
// All HTTP clients (api.ts, query-client.ts, auth-context.tsx)
// import from here instead of reading env vars independently.

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.rinzo.app";
