import React from "react";
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { Order, OrderStatus, fetchRiderOrders } from "@/lib/api";
import Colors from "@/constants/colors";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  ASSIGNED: {
    label: "Assigned",
    color: Colors.dark.statusAssigned,
    bg: "rgba(75, 139, 255, 0.12)",
  },
  PICKED_UP: {
    label: "Picked Up",
    color: Colors.dark.statusPickedUp,
    bg: "rgba(255, 183, 75, 0.12)",
  },
  DELIVERED: {
    label: "Delivered",
    color: Colors.dark.statusDelivered,
    bg: "rgba(0, 212, 170, 0.12)",
  },
};

function OrderCard({ order }: { order: Order }) {
  const status = STATUS_CONFIG[order.status];

  function handlePress() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: "/order/[id]", params: { id: order.id } });
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>{order.id}</Text>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="storefront-outline" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>{order.shopName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>{order.customerAddress}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.typeBadge, order.type === "PICKUP" ? styles.pickupBadge : styles.deliveryBadge]}>
          <Ionicons
            name={order.type === "PICKUP" ? "arrow-up-circle-outline" : "arrow-down-circle-outline"}
            size={14}
            color={order.type === "PICKUP" ? Colors.dark.accent : Colors.dark.tint}
          />
          <Text style={[styles.typeText, order.type === "PICKUP" ? styles.pickupText : styles.deliveryText]}>
            {order.type === "PICKUP" ? "Pickup" : "Delivery"}
          </Text>
        </View>
        <View style={styles.distanceRow}>
          <Ionicons name="navigate-outline" size={13} color={Colors.dark.textMuted} />
          <Text style={styles.distanceText}>{order.distance}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const {
    data: orders = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<Order[]>({
    queryKey: ["rider-orders"],
    queryFn: fetchRiderOrders,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  function renderEmpty() {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="clipboard-outline" size={56} color={Colors.dark.textMuted} />
        <Text style={styles.emptyTitle}>No active orders</Text>
        <Text style={styles.emptyText}>
          New orders will appear here when they are assigned to you
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset + 16 }]}>
      <Text style={styles.screenTitle}>Assigned Orders</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.tint} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
          ]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
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
  screenTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    gap: 12,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderId: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
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
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pickupBadge: {
    backgroundColor: "rgba(75, 139, 255, 0.1)",
  },
  deliveryBadge: {
    backgroundColor: "rgba(0, 212, 170, 0.1)",
  },
  typeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  pickupText: {
    color: Colors.dark.accent,
  },
  deliveryText: {
    color: Colors.dark.tint,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  distanceText: {
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
