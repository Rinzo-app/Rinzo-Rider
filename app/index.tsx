import { useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { isAuthenticated, isLoading, rider, profileError, retryProfileFetch } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    // Don't navigate while there's a profile error — show retry screen
    if (profileError) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (rider && (rider.status === "PENDING" || rider.status === "SUSPENDED")) {
      router.replace("/status-blocked");
      return;
    }

    // Only allow entry when rider has an ACTIVE (or APPROVED) status
    if (rider && rider.status !== "PENDING" && rider.status !== "SUSPENDED") {
      router.replace("/(main)");
    }
  }, [isLoading, isAuthenticated, rider, profileError]);

  // ── Profile fetch error → retry screen ─────────────────
  if (profileError && isAuthenticated && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContent}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="cloud-offline-outline" size={48} color={Colors.dark.danger} />
          </View>
          <Text style={styles.errorTitle}>Connection Problem</Text>
          <Text style={styles.errorDescription}>
            We couldn't load your rider profile. Please check your internet connection and try again.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            onPress={async () => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              await retryProfileFetch();
            }}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.dark.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContent: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  errorIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 75, 110, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  errorTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.dark.text,
    textAlign: "center",
  },
  errorDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: Colors.dark.tint,
    marginTop: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
});
