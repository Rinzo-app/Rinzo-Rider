import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { request, requestRaw, ApiError } from "./http-client";

// ── Shared API helpers (backed by lib/http-client.ts) ────

/**
 * Make an authenticated request and return the raw Response.
 * Delegates to the unified HTTP client.
 */
export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
): Promise<Response> {
  return requestRaw(method, route, data);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  return async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    // Ensure the path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    try {
      return await request<T>("GET", normalizedPath);
    } catch (err) {
      if (
        options.on401 === "returnNull" &&
        err instanceof ApiError &&
        err.status === 401
      ) {
        return null as unknown as T;
      }
      throw err;
    }
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 60_000,          // 1 min — sane default; override per-query for hot data
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
