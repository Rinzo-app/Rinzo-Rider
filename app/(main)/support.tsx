import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, Dispute, DisputeStatus } from "@/lib/api";
import Colors from "@/constants/colors";

const STATUS_CONFIG: Record<DisputeStatus, { label: string; color: string; bg: string; icon: string }> = {
  OPEN: {
    label: "Open",
    color: Colors.dark.statusOpen,
    bg: "rgba(75, 139, 255, 0.12)",
    icon: "radio-button-on",
  },
  IN_REVIEW: {
    label: "In Review",
    color: Colors.dark.statusInReview,
    bg: "rgba(255, 183, 75, 0.12)",
    icon: "hourglass-outline",
  },
  RESOLVED: {
    label: "Resolved",
    color: Colors.dark.statusResolved,
    bg: "rgba(0, 212, 170, 0.12)",
    icon: "checkmark-circle-outline",
  },
  CLOSED: {
    label: "Closed",
    color: Colors.dark.statusClosed,
    bg: "rgba(90, 97, 120, 0.2)",
    icon: "close-circle-outline",
  },
};

function DisputeCard({ dispute }: { dispute: Dispute }) {
  const status = STATUS_CONFIG[dispute.status];
  const date = new Date(dispute.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryRow}>
          <Ionicons name={status.icon as any} size={16} color={status.color} />
          <Text style={styles.category}>{dispute.category}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {dispute.orderId && (
        <View style={styles.orderRef}>
          <Ionicons name="link-outline" size={14} color={Colors.dark.textMuted} />
          <Text style={styles.orderRefText}>{dispute.orderId}</Text>
        </View>
      )}

      <Text style={styles.description} numberOfLines={2}>
        {dispute.description}
      </Text>

      <Text style={styles.dateText}>{date}</Text>
    </View>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const fetchDisputes = useCallback(async () => {
    try {
      const data = await api.getDisputes();
      setDisputes(data);
    } catch {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDisputes();
    }, [fetchDisputes])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchDisputes();
  }

  function handleNewDispute() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/new-dispute");
  }

  function renderEmpty() {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbox-ellipses-outline" size={56} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No disputes</Text>
        <Text style={styles.emptyText}>
          If you face any issues during deliveries, raise a support ticket here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Support</Text>
        <Pressable
          style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
          onPress={handleNewDispute}
        >
          <Ionicons name="add" size={22} color={Colors.dark.tint} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.tint} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DisputeCard dispute={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
          ]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.dark.tint}
              colors={[Colors.dark.tint]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  screenTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.dark.text,
  },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnPressed: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  category: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.dark.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  orderRef: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  orderRefText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  dateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    maxWidth: 260,
  },
});
