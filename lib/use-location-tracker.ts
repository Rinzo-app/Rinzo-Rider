import { useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";
import { updateLocation } from "@/lib/api";

// ─────────────────────────────────────────────────────────
// useLocationTracker
//
// Watches the rider's GPS position and sends updates to the
// backend.  Two safeguards prevent excessive traffic:
//
//   1. TIME throttle  — at most one update per MIN_INTERVAL ms
//   2. DISTANCE filter — skip if rider moved < MIN_DISTANCE m
//
// The watcher is active only while `enabled` is true (i.e.
// rider is AVAILABLE).  It is fully cleaned up on unmount or
// when the rider goes offline.
// ─────────────────────────────────────────────────────────

/** Minimum elapsed time between backend calls (ms). */
const MIN_INTERVAL_MS = 10_000; // 10 seconds

/** Minimum distance the rider must move before we send (meters). */
const MIN_DISTANCE_M = 50;

/** Haversine distance in meters between two lat/lng points. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6_371_000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Track the rider's location and push to the backend.
 *
 * @param enabled  Pass `true` when the rider is AVAILABLE.
 *                 The watcher is torn down when `false`.
 */
export function useLocationTracker(enabled: boolean) {
  // Mutable refs survive re-renders without causing them.
  const lastSentAt = useRef(0);
  const lastLat = useRef<number | null>(null);
  const lastLng = useRef<number | null>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);
  const isMounted = useRef(true);

  // ── Core send function (throttled + distance-filtered) ──
  const maybeSend = useCallback(
    async (lat: number, lng: number, force = false) => {
      if (!isMounted.current) return;

      const now = Date.now();

      // Time throttle
      if (!force && now - lastSentAt.current < MIN_INTERVAL_MS) return;

      // Distance filter
      if (
        !force &&
        lastLat.current !== null &&
        lastLng.current !== null &&
        haversineMeters(lastLat.current, lastLng.current, lat, lng) < MIN_DISTANCE_M
      ) {
        return;
      }

      try {
        await updateLocation(lat, lng);
        lastSentAt.current = now;
        lastLat.current = lat;
        lastLng.current = lng;
      } catch {
        // Non-fatal — rider still works offline
      }
    },
    [],
  );

  // ── Start / stop the watcher when `enabled` changes ────
  useEffect(() => {
    isMounted.current = true;

    if (!enabled) {
      // Clean up any existing watcher when going offline
      watchSub.current?.remove();
      watchSub.current = null;
      return;
    }

    let cancelled = false;

    async function startWatching() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      // Send one immediate update when going online
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          maybeSend(loc.coords.latitude, loc.coords.longitude, /* force */ true);
        }
      } catch {
        // Non-fatal
      }

      if (cancelled) return;

      // Start continuous watching.
      // `distanceInterval` is a hint to the OS — we still enforce
      // our own distance + time filters in `maybeSend`.
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: MIN_DISTANCE_M,
          timeInterval: MIN_INTERVAL_MS,
        },
        (loc) => {
          if (!cancelled) {
            maybeSend(loc.coords.latitude, loc.coords.longitude);
          }
        },
      );

      if (cancelled) {
        sub.remove();
      } else {
        watchSub.current = sub;
      }
    }

    startWatching();

    return () => {
      cancelled = true;
      watchSub.current?.remove();
      watchSub.current = null;
    };
  }, [enabled, maybeSend]);

  // ── Foreground resume: send a fresh update when app wakes ──
  useEffect(() => {
    if (!enabled) return;

    function handleAppState(state: AppStateStatus) {
      if (state === "active") {
        // Force an update because the rider may have moved
        // significantly while the app was backgrounded.
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then((loc) => {
            maybeSend(loc.coords.latitude, loc.coords.longitude, /* force */ true);
          })
          .catch(() => {});
      }
    }

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [enabled, maybeSend]);

  // ── Guard: mark unmounted so stale callbacks become no-ops ──
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
}
