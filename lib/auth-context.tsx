import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { fetch } from "expo/fetch";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { isFirebaseConfigured, firebaseReady, getFirebaseAuth } from "./firebase";
import { queryClient } from "./query-client";
import { BACKEND_URL } from "./config";
import type { RiderProfile } from "@/lib/api";
import { fetchRiderProfile as fetchRiderProfileFromApi } from "@/lib/api";
import { ConfigErrorScreen } from "@/components/ConfigErrorScreen";
import { registerForPushNotifications } from "./push-notifications";

// ── Startup config validation ────────────────────────────
// Check once at module level so the error screen is deterministic
// and doesn't depend on render timing.
const isBackendUrlConfigured =
  !!BACKEND_URL && BACKEND_URL !== "" && BACKEND_URL !== "undefined";

function getConfigError(): string | null {
  if (!isFirebaseConfigured && !isBackendUrlConfigured) {
    return "The app is missing both Firebase and backend server configuration. Please contact support or try updating the app.";
  }
  if (!isFirebaseConfigured) {
    return "The app's authentication service is not configured. You won't be able to sign in until this is resolved. Please contact support.";
  }
  if (!isBackendUrlConfigured) {
    return "The app cannot connect to the Rinzo server because the server address is not configured. Please contact support or try updating the app.";
  }
  return null;
}

const CONFIG_ERROR = getConfigError();

interface AuthContextValue {
  rider: RiderProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Non-null when the backend profile fetch failed after login */
  profileError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    phone: string,
    vehicleType: string,
    email: string,
    password: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Retry fetching the profile after a failure */
  retryProfileFetch: () => Promise<void>;
  updateRider: (rider: RiderProfile) => void;
  emailVerified: boolean;
  /** False until the verification status has been determined — avoids a
   *  flash of the "verify email" banner before the check resolves. */
  emailChecked: boolean;
  resendVerification: () => Promise<void>;
  reloadEmailStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Register with the unified backend. 409 = already registered.
 * Returns true when the account exists in the backend afterwards.
 */
async function registerWithBackend(
  idToken: string,
  payload: { name: string; email: string; phone: string; vehicleType: string },
): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/register/rider`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 409) return true;
    console.warn("Backend rider registration:", res.status);
    return false;
  } catch (err) {
    console.warn("Backend rider registration failed:", err);
    return false;
  }
}

/**
 * Build a minimal RiderProfile from the Firebase user.
 * Used only as a placeholder while the real profile is being fetched
 * from the backend. The status is set to a safe "PENDING" default
 * so that the status gate blocks access until the backend responds.
 */
function buildPlaceholderProfile(firebaseUser: any): RiderProfile {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Rider",
    email: firebaseUser.email || "",
    phone: firebaseUser.phoneNumber || "",
    status: "PENDING", // safe default — backend will override
    vehicleType: "Motorcycle",
    vehicleNumber: "",
    licenseNumber: "",
    availability: "OFFLINE",
    joinedDate: firebaseUser.metadata?.creationTime || new Date().toISOString(),
    totalDeliveries: 0,
    rating: 0,
    totalRatings: 0,
    dlImageUrl: null,
    rcImageUrl: null,
    selfieUrl: null,
    documentsStatus: "NOT_SUBMITTED",
    documentsRejectionReason: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // ── If critical config is missing, short-circuit with a friendly screen ──
  if (CONFIG_ERROR) {
    return <ConfigErrorScreen message={CONFIG_ERROR} />;
  }

  return <AuthProviderInner>{children}</AuthProviderInner>;
}

/** Inner provider — only rendered when all config is present. */
function AuthProviderInner({ children }: { children: ReactNode }) {
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const appState = useRef(AppState.currentState);
  // True while register() is mid-flight. createUserWithEmailAndPassword
  // fires onAuthStateChanged immediately, which would fetch the profile
  // before the backend row exists (→ 401 → destructive sign-out).
  // register() owns the fetch in that window.
  const isRegistering = useRef(false);

  // ── Fetch the real rider profile from the backend ──────
  const syncProfileFromBackend = useCallback(async () => {
    try {
      setProfileError(null);
      const profile = await fetchRiderProfileFromApi();
      setRider(profile);
      return profile;
    } catch (err: any) {
      // One account = one role: a 404 here means the account exists
      // but is not a rider (customer/shop owner) — wrong app.
      if (err?.code === "ERR_RIDER_NOT_FOUND") {
        const auth = getFirebaseAuth();
        if (auth) await signOut(auth).catch(() => {});
        setRider(null);
        setProfileError(
          "This account is not a rider account — please use the Rinzo customer or shop owner app.",
        );
        return null;
      }
      const message =
        err?.message || "Failed to load your rider profile. Please try again.";
      console.error("Backend profile fetch failed:", message);
      setProfileError(message);
      return null;
    }
  }, []);

  // ── Bootstrap: listen to Firebase auth state ───────────
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    firebaseReady
      .then(async () => {
        const auth = getFirebaseAuth();
        if (!auth) {
          setIsLoading(false);
          return;
        }
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
          // During registration the Firebase account exists before the
          // backend row does — setting the rider placeholder here makes
          // the app "authenticated" too early and queries 401 into the
          // gap. register() owns all state updates until it completes.
          if (firebaseUser && isRegistering.current) return;

          if (firebaseUser) {
            // Seed verification from the (persisted) Firebase user so the
            // banner doesn't flash before reloadEmailStatus resolves.
            setEmailVerified(!!firebaseUser.emailVerified);
            setEmailChecked(true);
            // Set a safe placeholder while the backend profile loads
            setRider(buildPlaceholderProfile(firebaseUser));
            await syncProfileFromBackend();
            // Register this device for push notifications (never throws)
            registerForPushNotifications();
          } else {
            setRider(null);
            setProfileError(null);
            setEmailVerified(false);
            setEmailChecked(false);
          }
          setIsLoading(false);
        });
      })
      .catch(() => {
        setIsLoading(false);
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [syncProfileFromBackend]);

  // ── AppState listener: refetch profile on foreground ───
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active" &&
        rider
      ) {
        // App came to foreground — silently sync the profile
        syncProfileFromBackend();
      }
      appState.current = nextState;
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [rider, syncProfileFromBackend]);

  // ── Email / password sign-in ────────────────────────────
  async function login(email: string, password: string) {
    setIsLoading(true);
    setProfileError(null);
    try {
      await firebaseReady;
      const auth = getFirebaseAuth();

      if (!auth) {
        throw new Error(
          "Unable to initialise the sign-in service. Please try again later or contact support.",
        );
      }

      await signInWithEmailAndPassword(auth, email, password);

      // Fetch the real rider profile from the backend
      // (onAuthStateChanged also fires, but we fetch here to
      //  ensure the profile is ready before login() resolves)
      await syncProfileFromBackend();
    } catch (err: any) {
      setIsLoading(false);
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        throw new Error("Invalid email or password");
      } else if (code === "auth/user-not-found") {
        throw new Error("No account found with this email");
      } else if (code === "auth/too-many-requests") {
        throw new Error("Too many attempts. Please try again later");
      } else if (code === "auth/invalid-email") {
        throw new Error("Please enter a valid email");
      } else if (code === "auth/network-request-failed") {
        throw new Error("Network error. Please check your connection and try again");
      }
      // Re-throw our own friendly messages as-is
      if (err?.message?.startsWith("Unable to initialise")) {
        throw err;
      }
      throw new Error("Sign in failed. Please try again");
    }
  }

  // ── Email / password sign-up ────────────────────────────
  async function register(
    name: string,
    phone: string,
    vehicleType: string,
    email: string,
    password: string,
  ) {
    setIsLoading(true);
    setProfileError(null);
    isRegistering.current = true;
    try {
      await firebaseReady;
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error(
          "Unable to initialise the sign-in service. Please try again later or contact support.",
        );
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name }).catch(() => {});
      sendEmailVerification(cred.user).catch(() => {});

      const idToken = await cred.user.getIdToken();
      const registered = await registerWithBackend(idToken, {
        name,
        email,
        phone,
        vehicleType,
      });
      if (!registered) {
        // Roll back the orphaned Firebase account so the user can retry
        await cred.user.delete().catch(() => {});
        throw new Error("REGISTRATION_FAILED");
      }

      // Backend row now exists — safe to fetch the profile.
      await syncProfileFromBackend();
      registerForPushNotifications();
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        throw new Error("An account with this email already exists — sign in instead");
      } else if (code === "auth/weak-password") {
        throw new Error("Password is too weak — use at least 6 characters");
      } else if (code === "auth/invalid-email") {
        throw new Error("Please enter a valid email");
      } else if (code === "auth/network-request-failed") {
        throw new Error("Network error. Please check your connection and try again");
      } else if (err?.message === "REGISTRATION_FAILED") {
        throw new Error("Could not create your account. Please try again");
      }
      if (err?.message?.startsWith("Unable to initialise")) {
        throw err;
      }
      throw new Error("Sign up failed. Please try again");
    } finally {
      isRegistering.current = false;
    }
  }

  // ── Sign out ───────────────────────────────────────────
  async function logout() {
    try {
      if (isFirebaseConfigured) {
        await firebaseReady;
        const auth = getFirebaseAuth();
        if (auth) {
          await signOut(auth);
        }
      }
      setRider(null);
      setProfileError(null);
      queryClient.clear();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  /** Refresh the rider profile from the backend */
  async function refreshProfile() {
    await syncProfileFromBackend();
  }

  /** Retry fetching the profile after a failure */
  async function retryProfileFetch() {
    setIsLoading(true);
    setProfileError(null);
    try {
      await syncProfileFromBackend();
    } finally {
      setIsLoading(false);
    }
  }

  function updateRider(updated: RiderProfile) {
    setRider(updated);
  }

  async function resetPassword(email: string) {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");
    await sendPasswordResetEmail(auth, email);
  }

  async function resendVerification() {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) throw new Error("Not authenticated");
    await sendEmailVerification(auth.currentUser);
  }

  async function reloadEmailStatus() {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return;
    await auth.currentUser.reload();
    // Force a fresh ID token so the backend sees email_verified=true.
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true).catch(() => {});
    }
    setEmailVerified(!!auth.currentUser.emailVerified);
    setEmailChecked(true);
  }

  const value = useMemo(
    () => ({
      rider,
      isLoading,
      isAuthenticated: !!rider,
      profileError,
      login,
      register,
      resetPassword,
      logout,
      refreshProfile,
      retryProfileFetch,
      updateRider,
      emailVerified,
      emailChecked,
      resendVerification,
      reloadEmailStatus,
    }),
    [rider, isLoading, profileError, emailVerified, emailChecked],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
