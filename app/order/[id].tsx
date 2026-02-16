import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Order,
  OrderStatus,
  fetchOrder,
  advanceOrder,
  BACKEND_NEXT_ACTION,
  ApiError,
} from "@/lib/api";
import Colors from "@/constants/colors";

const STATUS_STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: "ASSIGNED", label: "Assigned", icon: "radio-button-on" },
  { key: "PICKED_UP", label: "Picked Up", icon: "cube-outline" },
  { key: "DELIVERED", label: "Delivered", icon: "checkmark-circle" },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
    staleTime: 15_000,           // order status is time-critical
    refetchInterval: 30_000,     // poll while viewing
  });

  const mutation = useMutation({
    mutationFn: () => advanceOrder(id!, order!.backendStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      setShowConfirm(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Navigate back after delivery or dropoff completes (order leaves active list)
      if (
        order?.backendStatus === "OUT_FOR_DELIVERY" ||
        order?.backendStatus === "PICKED_UP_FROM_CUSTOMER"
      ) {
        setTimeout(() => router.back(), 500);
      }
    },
    onError: (err) => {
      setShowConfirm(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const message =
        err instanceof ApiError ? err.message : "Something went wrong";
      Alert.alert("Error", message);
    },
  });

  const isUpdating = mutation.isPending;

  function handleCall(phone: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  }

  async function handleStatusUpdate() {
    if (!order) return;
    mutation.mutate();
  }

  function getStatusIndex(status: OrderStatus): number {
    return STATUS_STEPS.findIndex((s) => s.key === status);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={Colors.dark.tint} />
      </View>
    );
  }

  if (!order || isError) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + webTopInset }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.textMuted} />
        <Text style={styles.errorText}>Order not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const currentStepIndex = getStatusIndex(order.status);
  const nextAction = BACKEND_NEXT_ACTION[order.backendStatus] || null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{order.id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) + (nextAction ? 80 : 0) },
        ]}
      >
        <View style={styles.progressSection}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepIndicator}>
                  <View
                    style={[
                      styles.stepDot,
                      isCompleted && styles.stepDotActive,
                      isCurrent && styles.stepDotCurrent,
                    ]}
                  >
                    {isCompleted && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={isCurrent ? "#0D0F14" : Colors.dark.tint}
                      />
                    )}
                  </View>
                  {index < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        index < currentStepIndex && styles.stepLineActive,
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelActive,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop Details</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Ionicons name="storefront-outline" size={18} color={Colors.dark.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={styles.cardRowLabel}>Shop</Text>
                <Text style={styles.cardRowValue}>{order.shopName}</Text>
              </View>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardRow}>
              <Ionicons name="location-outline" size={18} color={Colors.dark.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={styles.cardRowLabel}>Address</Text>
                <Text style={styles.cardRowValue}>{order.shopAddress}</Text>
              </View>
            </View>
            <View style={styles.cardDivider} />
            <Pressable
              style={({ pressed }) => [styles.callRow, pressed && styles.callRowPressed]}
              onPress={() => handleCall(order.shopPhone)}
            >
              <Ionicons name="call-outline" size={18} color={Colors.dark.tint} />
              <Text style={styles.callText}>Call Shop</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Ionicons name="person-outline" size={18} color={Colors.dark.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={styles.cardRowLabel}>Customer</Text>
                <Text style={styles.cardRowValue}>{order.customerName}</Text>
              </View>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardRow}>
              <Ionicons name="location-outline" size={18} color={Colors.dark.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={styles.cardRowLabel}>Address</Text>
                <Text style={styles.cardRowValue}>{order.customerAddress}</Text>
              </View>
            </View>
            <View style={styles.cardDivider} />
            <Pressable
              style={({ pressed }) => [styles.callRow, pressed && styles.callRowPressed]}
              onPress={() => handleCall(order.customerPhone)}
            >
              <Ionicons name="call-outline" size={18} color={Colors.dark.tint} />
              <Text style={styles.callText}>Call Customer</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.card}>
            {order.services.map((service, index) => (
              <React.Fragment key={index}>
                {index > 0 && <View style={styles.cardDivider} />}
                <View style={styles.serviceRow}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>x{service.quantity}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name={order.type === "PICKUP" ? "arrow-up-circle-outline" : "arrow-down-circle-outline"}
              size={16}
              color={Colors.dark.textSecondary}
            />
            <Text style={styles.metaText}>{order.type === "PICKUP" ? "Pickup" : "Delivery"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="navigate-outline" size={16} color={Colors.dark.textSecondary} />
            <Text style={styles.metaText}>{order.distance}</Text>
          </View>
        </View>
      </ScrollView>

      {nextAction && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
              isUpdating && styles.actionButtonDisabled,
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              setShowConfirm(true);
            }}
            disabled={isUpdating}
          >
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons
                name={(nextAction?.icon || "checkmark-circle-outline") as any}
                size={40}
                color={Colors.dark.tint}
              />
            </View>
            <Text style={styles.modalTitle}>
              {nextAction?.modalTitle || "Confirm"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {nextAction?.modalSubtitle || "Are you sure?"}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirm,
                  pressed && { opacity: 0.85 },
                  isUpdating && { opacity: 0.6 },
                ]}
                onPress={handleStatusUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#0D0F14" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.dark.tint,
  },
  progressSection: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  stepIndicator: {
    alignItems: "center",
    width: 24,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    borderColor: Colors.dark.tint,
    backgroundColor: "rgba(0, 212, 170, 0.15)",
  },
  stepDotCurrent: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: Colors.dark.border,
    marginVertical: 4,
  },
  stepLineActive: {
    backgroundColor: Colors.dark.tint,
  },
  stepLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.textMuted,
    paddingTop: 2,
  },
  stepLabelActive: {
    color: Colors.dark.textSecondary,
  },
  stepLabelCurrent: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  cardRowContent: {
    flex: 1,
    gap: 2,
  },
  cardRowLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  cardRowValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.text,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 14,
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  callRowPressed: {
    backgroundColor: "rgba(0, 212, 170, 0.05)",
  },
  callText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.tint,
    flex: 1,
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  serviceName: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.text,
  },
  qtyBadge: {
    backgroundColor: Colors.dark.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qtyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  actionButton: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#0D0F14",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.dark.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.dark.text,
  },
  modalSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.dark.tint,
  },
  modalConfirmText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#0D0F14",
  },
});
