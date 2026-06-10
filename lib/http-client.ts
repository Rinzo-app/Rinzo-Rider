import { fetch } from "expo/fetch";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, firebaseReady } from "./firebase";
import { BACKEND_URL } from "./config";

// ── Shared error class ───────────────────────────────────

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ── Auth header helper ───────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Firebase not available — proceed without auth
  }
  return {};
}

// ── Force sign-out on auth failure ───────────────────────

async function forceSignOut(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Best-effort — ignore errors during forced sign-out
  }
}

// ── Unified HTTP request function ────────────────────────

/**
 * Make an authenticated request to the backend.
 *
 * - Attaches the Firebase ID token as a Bearer header.
 * - On 401 (or suspended-account 403), signs the user out and throws.
 * - Returns the parsed JSON body on success.
 *
 * @param method  HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param path    API path — will be appended to BACKEND_URL (e.g. "/api/rider/orders")
 * @param data    Optional request body (will be JSON-serialised)
 */
export async function request<T = any>(
  method: string,
  path: string,
  data?: unknown,
): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const raw = await res.json().catch(() => ({ message: res.statusText }));
    // Backend errors are nested: { error: { code, message } }
    const body = raw?.error && typeof raw.error === "object" ? raw.error : raw;

    // Only 401 (bad/expired token) or a suspended account should log the
    // user out. Plain 403s are business-rule denials (wrong order state,
    // not assigned to this order, etc.) and must not end the session.
    const isAuthFailure =
      res.status === 401 ||
      (res.status === 403 && body.code === "ERR_SUSPENDED");

    if (isAuthFailure) {
      await forceSignOut();
      throw new ApiError(
        res.status,
        body.code === "ERR_SUSPENDED"
          ? "Your account has been suspended"
          : "Authentication failed — please login again",
        body.code,
      );
    }

    throw new ApiError(
      res.status,
      body.message || `${res.status}: ${res.statusText}`,
      body.code,
    );
  }

  return res.json();
}

/**
 * Make an authenticated request and return the raw Response.
 * Useful for callers that need access to headers or streaming.
 */
export async function requestRaw(
  method: string,
  path: string,
  data?: unknown,
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 401 || text.includes("ERR_SUSPENDED")) {
      await forceSignOut();
    }
    throw new ApiError(res.status, text);
  }

  return res;
}
