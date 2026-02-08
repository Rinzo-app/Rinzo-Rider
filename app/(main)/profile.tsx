import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={18} color={Colors.dark.tint} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { rider, logout } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  async function handleLogout() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (Platform.OS === "web") {
      await logout();
      router.replace("/login");
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  const joinDate = rider?.joinedDate
    ? new Date(rider.joinedDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset + 16 }]}>
      <Text style={styles.screenTitle}>Profile</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
        ]}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {rider?.name?.charAt(0)?.toUpperCase() || "R"}
            </Text>
          </View>
          <Text style={styles.riderName}>{rider?.name || "Rider"}</Text>
          <Text style={styles.riderId}>ID: {rider?.id || "-"}</Text>
        </View>

        <View style={styles.card}>
          <InfoRow icon="mail-outline" label="Email" value={rider?.email || "-"} />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Phone" value={rider?.phone || "-"} />
          <View style={styles.divider} />
          <InfoRow icon="bicycle-outline" label="Vehicle" value={rider?.vehicleType || "-"} />
          <View style={styles.divider} />
          <InfoRow icon="car-outline" label="Vehicle Number" value={rider?.vehicleNumber || "-"} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Joined" value={joinDate} />
          <View style={styles.divider} />
          <InfoRow
            icon="checkmark-done-outline"
            label="Total Deliveries"
            value={String(rider?.totalDeliveries || 0)}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.dark.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
  },
  screenTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.dark.text,
    marginBottom: 20,
  },
  scrollContent: {
    gap: 20,
  },
  avatarSection: {
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.dark.tint,
    marginBottom: 4,
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.dark.tint,
  },
  riderName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.dark.text,
  },
  riderId: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(0, 212, 170, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 14,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255, 75, 110, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 75, 110, 0.2)",
  },
  logoutPressed: {
    opacity: 0.7,
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.dark.danger,
  },
});
