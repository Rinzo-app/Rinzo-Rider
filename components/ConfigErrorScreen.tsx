import React from "react";
import { View, Text, StyleSheet, Linking, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

// ─────────────────────────────────────────────────────────
// ConfigErrorScreen
//
// Full-screen error shown when critical config is missing
// (Firebase env vars or backend URL). Renders instead of the
// normal app tree so nothing downstream can crash.
// ─────────────────────────────────────────────────────────

interface ConfigErrorScreenProps {
  /** Short heading, e.g. "Configuration Error" */
  title?: string;
  /** Longer explanation shown below the heading */
  message: string;
  /** Optional support email — renders a "Contact Support" button */
  supportEmail?: string;
}

export function ConfigErrorScreen({
  title = "Configuration Error",
  message,
  supportEmail = "support@rinzo.app",
}: ConfigErrorScreenProps) {
  const handleContactSupport = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const subject = encodeURIComponent("Rinzo Rider – App Configuration Error");
    const body = encodeURIComponent(
      "Hi,\n\nThe Rinzo Rider app is showing a configuration error and I'm unable to sign in.\n\nPlease help!\n",
    );
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}&body=${body}`).catch(() => {
      // silently ignore if no mail client is available
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="settings-outline" size={48} color={Colors.dark.warning} />
        </View>

        {/* Text */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {/* Support button */}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={handleContactSupport}
        >
          <Ionicons name="mail-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Contact Support</Text>
        </Pressable>

        {/* Subtle hint */}
        <Text style={styles.hint}>
          If you're a developer, check that all required environment variables are set in eas.json
          or EAS Secrets.
        </Text>
      </View>
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
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 183, 75, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.dark.text,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  button: {
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
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 300,
    marginTop: 12,
  },
});
