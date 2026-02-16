import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
  AppState,
  AppStateStatus,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

const POLL_INTERVAL_MS = 30_000;

export default function StatusBlockedScreen() {
  const insets = useSafeAreaInsets();
  const { rider, logout, refreshProfile } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [isChecking, setIsChecking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const appState = useRef(AppState.currentState);

  const isPending = rider?.status === "PENDING";

  // ── Auto-redirect when status is no longer blocked ─────
  useEffect(() => {
    if (
      rider &&
      rider.status !== "PENDING" &&
      rider.status !== "SUSPENDED"
    ) {
      router.replace("/");
    }
  }, [rider]);

  // ── Periodic auto-poll every 30 s ──────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      refreshProfile();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshProfile]);

  // ── Re-sync when app comes to foreground ───────────────
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        refreshProfile();
      }
      appState.current = nextState;
    }

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [refreshProfile]);

  // ── Manual "Check Status" ──────────────────────────────
  const handleCheckStatus = useCallback(async () => {
    setIsChecking(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await refreshProfile();
    } finally {
      setIsChecking(false);
    }
  }, [refreshProfile]);

  // ── Pull-to-refresh ────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  async function handleLogout() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await logout();
    router.replace("/login");
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset + 40,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20),
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.dark.tint}
          colors={[Colors.dark.tint]}
        />
      }
    >
      <View style={styles.content}>
        <View style={[styles.iconCircle, isPending ? styles.pendingBg : styles.suspendedBg]}>
          <Ionicons
            name={isPending ? "time-outline" : "ban-outline"}
            size={48}
            color={isPending ? Colors.dark.warning : Colors.dark.danger}
          />
        </View>

        <Text style={styles.title}>
          {isPending ? "Account Under Verification" : "Account Suspended"}
        </Text>

        <Text style={styles.description}>
          {isPending
            ? "Your rider account is being reviewed. You will be able to access the app once your account is approved."
            : "Your account has been suspended. Please contact support for more information."}
        </Text>

        {isPending && (
          <Pressable
            style={({ pressed }) => [styles.checkButton, pressed && styles.pressed]}
            onPress={handleCheckStatus}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={Colors.dark.tint} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={Colors.dark.tint} />
                <Text style={styles.checkButtonText}>Check Status</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.dark.textSecondary} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
    flex: 1,
    justifyContent: "center",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pendingBg: {
    backgroundColor: "rgba(255, 183, 75, 0.12)",
  },
  suspendedBg: {
    backgroundColor: "rgba(255, 75, 110, 0.12)",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.dark.text,
    textAlign: "center",
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  logoutText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  checkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    borderWidth: 1,
    borderColor: Colors.dark.tint,
    marginTop: 8,
    minWidth: 170,
  },
  checkButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.dark.tint,
  },
});
