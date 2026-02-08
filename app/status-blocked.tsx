import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function StatusBlockedScreen() {
  const insets = useSafeAreaInsets();
  const { rider, logout } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const isPending = rider?.status === "PENDING";

  async function handleLogout() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await logout();
    router.replace("/login");
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset + 40,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20),
        },
      ]}
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
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.dark.textSecondary} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
