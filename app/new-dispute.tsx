import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  createDispute,
  fetchAllRiderOrders,
  DISPUTE_CATEGORIES,
  Order,
} from "@/lib/api";
import Colors from "@/constants/colors";

// ── Order picker card ────────────────────────────────────

function OrderPickerCard({
  order,
  selected,
  onPress,
}: {
  order: Order;
  selected: boolean;
  onPress: () => void;
}) {
  const date = new Date(order.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      style={[styles.orderCard, selected && styles.orderCardSelected]}
      onPress={onPress}
    >
      <View style={styles.orderCardRow}>
        <View style={styles.orderCardInfo}>
          <Text style={styles.orderShop} numberOfLines={1}>
            {order.shopName}
          </Text>
          <Text style={styles.orderMeta}>
            {date} · {order.type} · {order.status}
          </Text>
        </View>
        <Ionicons
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={selected ? Colors.dark.tint : Colors.dark.textMuted}
        />
      </View>
    </Pressable>
  );
}

// ── Main screen ──────────────────────────────────────────

export default function NewDisputeScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState("");
  const [orderId, setOrderId] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const {
    data: orders = [],
    isLoading: ordersLoading,
    isError: ordersError,
  } = useQuery<Order[]>({
    queryKey: ["all-rider-orders"],
    queryFn: fetchAllRiderOrders,
    staleTime: 60_000,
  });

  async function handleSubmit() {
    if (!category) {
      setError("Please select a category");
      return;
    }
    if (!orderId) {
      setError("Please select an order");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a description");
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      await createDispute({
        category,
        orderId,
        description: description.trim(),
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch {
      setError("Failed to submit. Please try again.");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Dispute</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.dark.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Category picker ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoriesGrid}>
            {DISPUTE_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.categoryChip,
                  category === cat && styles.categoryChipSelected,
                ]}
                onPress={() => {
                  setCategory(cat);
                  if (Platform.OS !== "web") {
                    Haptics.selectionAsync();
                  }
                }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat && styles.categoryChipTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Order picker ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Order</Text>

          {ordersLoading && (
            <View style={styles.orderLoadingBox}>
              <ActivityIndicator size="small" color={Colors.dark.tint} />
              <Text style={styles.orderLoadingText}>Loading orders…</Text>
            </View>
          )}

          {ordersError && (
            <View style={styles.orderEmptyBox}>
              <Ionicons name="warning-outline" size={20} color={Colors.dark.danger} />
              <Text style={styles.orderEmptyText}>
                Failed to load orders. Pull down to retry.
              </Text>
            </View>
          )}

          {!ordersLoading && !ordersError && orders.length === 0 && (
            <View style={styles.orderEmptyBox}>
              <Ionicons name="cube-outline" size={20} color={Colors.dark.textMuted} />
              <Text style={styles.orderEmptyText}>
                No orders found — you can only create disputes for orders you've been assigned to.
              </Text>
            </View>
          )}

          {!ordersLoading && !ordersError && orders.length > 0 && (
            <View style={styles.orderList}>
              {orders.map((o) => (
                <OrderPickerCard
                  key={o.id}
                  order={o}
                  selected={orderId === o.id}
                  onPress={() => {
                    setOrderId(o.id === orderId ? "" : o.id);
                    if (Platform.OS !== "web") {
                      Haptics.selectionAsync();
                    }
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Description ── */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={Colors.dark.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#0D0F14" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Dispute</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.dark.text,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 75, 110, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 75, 110, 0.2)",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.danger,
    flex: 1,
  },
  field: {
    gap: 10,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryChipSelected: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    borderColor: Colors.dark.tint,
  },
  categoryChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.dark.tint,
  },
  // ── Order picker styles ──
  orderLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  orderLoadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  orderEmptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  orderEmptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.textMuted,
    flex: 1,
  },
  orderList: {
    gap: 8,
  },
  orderCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  orderCardSelected: {
    backgroundColor: "rgba(0, 212, 170, 0.08)",
    borderColor: Colors.dark.tint,
  },
  orderCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  orderCardInfo: {
    flex: 1,
    gap: 2,
  },
  orderShop: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.dark.text,
  },
  orderMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  textArea: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#0D0F14",
  },
});
