import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useAuth } from "@/lib/auth-context";
import { api, AvailabilityStatus } from "@/lib/api";
import Colors from "@/constants/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { rider, updateRider } = useAuth();
  const [isToggling, setIsToggling] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const isAvailable = rider?.availability === "AVAILABLE";
  const toggleProgress = useSharedValue(isAvailable ? 1 : 0);

  const animatedCircleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      toggleProgress.value,
      [0, 1],
      [Colors.dark.surfaceElevated, "rgba(0, 212, 170, 0.15)"]
    ),
    borderColor: interpolateColor(
      toggleProgress.value,
      [0, 1],
      [Colors.dark.border, Colors.dark.tint]
    ),
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(toggleProgress.value === 1 ? 1 : 0.6) }],
    backgroundColor: interpolateColor(
      toggleProgress.value,
      [0, 1],
      [Colors.dark.textMuted, Colors.dark.tint]
    ),
  }));

  async function handleToggle() {
    if (isToggling || !rider) return;
    setIsToggling(true);

    const newStatus: AvailabilityStatus = isAvailable ? "OFFLINE" : "AVAILABLE";

    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const updated = await api.updateAvailability(newStatus);
      updateRider(updated);
      toggleProgress.value = withTiming(newStatus === "AVAILABLE" ? 1 : 0, { duration: 300 });
    } catch {
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + webTopInset + 16 },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{rider?.name || "Rider"}</Text>
        </View>
        <View style={[styles.statusPill, isAvailable ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDotSmall, isAvailable ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.statusPillText, isAvailable ? styles.textOnline : styles.textOffline]}>
            {isAvailable ? "Online" : "Offline"}
          </Text>
        </View>
      </View>

      <View style={styles.centerContent}>
        <AnimatedPressable
          style={[styles.toggleCircle, animatedCircleStyle]}
          onPress={handleToggle}
          disabled={isToggling}
        >
          {isToggling ? (
            <ActivityIndicator size="large" color={Colors.dark.tint} />
          ) : (
            <>
              <Animated.View style={[styles.toggleDot, animatedDotStyle]} />
              <Ionicons
                name="power"
                size={48}
                color={isAvailable ? Colors.dark.tint : Colors.dark.textMuted}
                style={styles.powerIcon}
              />
            </>
          )}
        </AnimatedPressable>

        <Text style={styles.toggleLabel}>
          {isAvailable ? "You are receiving orders" : "Tap to go online"}
        </Text>
        <Text style={styles.toggleSub}>
          {isAvailable
            ? "New orders will be assigned to you"
            : "You won't receive any orders while offline"}
        </Text>
      </View>

      <View style={[styles.statsRow, { marginBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) }]}>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-done" size={22} color={Colors.dark.tint} />
          <Text style={styles.statValue}>{rider?.totalDeliveries || 0}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="bicycle" size={22} color={Colors.dark.accent} />
          <Text style={styles.statValue}>{rider?.vehicleNumber || "-"}</Text>
          <Text style={styles.statLabel}>{rider?.vehicleType || "Vehicle"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.dark.text,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOnline: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
  },
  statusOffline: {
    backgroundColor: "rgba(90, 97, 120, 0.2)",
  },
  statusDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: Colors.dark.tint,
  },
  dotOffline: {
    backgroundColor: Colors.dark.textMuted,
  },
  statusPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  textOnline: {
    color: Colors.dark.tint,
  },
  textOffline: {
    color: Colors.dark.textMuted,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 28,
  },
  toggleDot: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.15,
  },
  powerIcon: {
    zIndex: 1,
  },
  toggleLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  toggleSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    maxWidth: 260,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
