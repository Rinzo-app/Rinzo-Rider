import React, { useState, useEffect } from "react";
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
  Image,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Order,
  OrderStatus,
  fetchOrder,
  advanceOrder,
  acceptOffer,
  declineOffer,
  collectCash,
  markDelivery,
  reportDelay,
  DELAY_REASONS,
  BACKEND_NEXT_ACTION,
  ApiError,
} from "@/lib/api";
import { uploadDeliveryProof } from "@/lib/upload";
import Colors from "@/constants/colors";
import { formatMoney } from "@/lib/money";

const STATUS_STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: "ASSIGNED", label: "Assigned", icon: "radio-button-on" },
  { key: "PICKED_UP", label: "Picked Up", icon: "cube-outline" },
  { key: "DELIVERED", label: "Delivered", icon: "checkmark-circle" },
];

/**
 * Open the device's maps app with turn-by-turn directions to a location.
 * Prefers exact coordinates; falls back to a text address search.
 */
function openDirections(
  lat: number | null,
  lng: number | null,
  fallbackAddress: string,
) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  let url: string;
  if (lat != null && lng != null) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else if (fallbackAddress?.trim()) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackAddress)}`;
  } else {
    Alert.alert("No location", "This order has no map location saved.");
    return;
  }
  Linking.openURL(url).catch(() =>
    Alert.alert("Couldn't open maps", "No maps app is available on this device."),
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [showDelay, setShowDelay] = useState(false);
  const [delayReason, setDelayReason] = useState<string | null>(null);
  const [delayNote, setDelayNote] = useState("");
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const {
    data: order,
    isLoading,
    isError,
    error,
  } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
    staleTime: 15_000,           // order status is time-critical
    refetchInterval: 30_000,     // poll while viewing
    // A 403 (offer expired / reassigned) or 404 won't fix itself by
    // retrying — fail fast and show a recovery action instead.
    retry: (count, err) => {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 403 || status === 404) return false;
      return count < 2;
    },
  });

  // Offer expired or order reassigned while viewing → not our order anymore.
  const lostAccess =
    error instanceof ApiError && (error.status === 403 || error.status === 404);

  function leaveToOrders() {
    queryClient.removeQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
    router.replace("/(main)/orders");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const wasDelivery = order!.backendStatus === "OUT_FOR_DELIVERY";
      let result;
      if (wasDelivery) {
        // Upload the optional proof-of-delivery photo first, then deliver.
        let proofUrl: string | undefined;
        if (proofUri) {
          try {
            proofUrl = await uploadDeliveryProof(id!, proofUri);
          } catch {
            // Photo upload shouldn't block the handover — deliver anyway.
          }
        }
        result = await markDelivery(id!, proofUrl);
        // COD: confirming delivery means the cash was collected —
        // record it (idempotent server-side, never blocks the flow).
        // Skipped entirely when the customer already paid online.
        if (order?.codAmount != null && order?.paymentStatus === "PENDING") {
          await collectCash(id!).catch(() => {});
        }
      } else {
        result = await advanceOrder(id!, order!.backendStatus);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      setShowConfirm(false);
      setProofUri(null);
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

  // ── Pickup offer: accept / decline + live countdown ─────
  const isOffer =
    order?.backendStatus === "PICKUP_OFFERED" ||
    order?.backendStatus === "DELIVERY_OFFERED";
  const isDeliveryOffer = order?.backendStatus === "DELIVERY_OFFERED";
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!isOffer || !order?.offerExpiresAt) {
      setSecondsLeft(null);
      return;
    }
    const deadline = new Date(order.offerExpiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        // Offer lapsed — refetch so the screen reflects reality
        queryClient.invalidateQueries({ queryKey: ["order", id] });
        queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [isOffer, order?.offerExpiresAt, id, queryClient]);

  const acceptMutation = useMutation({
    mutationFn: () => acceptOffer(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Something went wrong";
      Alert.alert("Offer unavailable", message);
      queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      router.back();
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineOffer(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      router.back();
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Something went wrong";
      Alert.alert("Error", message);
    },
  });

  const reportDelayMutation = useMutation({
    mutationFn: () => reportDelay(id!, delayReason!, delayNote.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      setShowDelay(false);
      setDelayReason(null);
      setDelayNote("");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Thanks — we've let the team know",
        "Your order won't be reassigned automatically. Support can see the delay and will help if needed.",
      );
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Something went wrong";
      Alert.alert("Couldn't report delay", message);
    },
  });

  // A rider can report a delay while actively carrying out a leg.
  const canReportDelay =
    order?.backendStatus === "PICKUP_ASSIGNED" ||
    order?.backendStatus === "PICKED_UP_FROM_CUSTOMER" ||
    order?.backendStatus === "OUT_FOR_DELIVERY";

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

  async function handleTakeProof() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera needed", "Allow camera access to take a delivery photo.");
      return;
    }
    setUploadingProof(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.6,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        setProofUri(result.assets[0].uri);
      }
    } finally {
      setUploadingProof(false);
    }
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

  if (lostAccess) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + webTopInset }]}>
        <Ionicons name="time-outline" size={48} color={Colors.dark.textMuted} />
        <Text style={styles.errorText}>This order moved on</Text>
        <Text style={styles.errorSub}>
          The offer expired or the order was assigned to another rider.
        </Text>
        <Pressable onPress={leaveToOrders} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to my orders</Text>
        </Pressable>
      </View>
    );
  }

  if (!order || isError) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + webTopInset }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.textMuted} />
        <Text style={styles.errorText}>Couldn't load this order</Text>
        <Pressable onPress={leaveToOrders} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to my orders</Text>
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
        <Text style={styles.headerTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) + (nextAction || isOffer ? 80 : 0) },
        ]}
      >
        {isOffer && (
          <View style={styles.offerBanner}>
            <View style={styles.offerIconWrap}>
              <Ionicons name="flash" size={20} color="#FFB020" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offerTitle}>{isDeliveryOffer ? "New delivery offer" : "New pickup offer"}</Text>
              <Text style={styles.offerSubtitle}>
                {secondsLeft !== null && secondsLeft > 0
                  ? `Accept within ${secondsLeft}s or it goes to the next rider`
                  : "Checking offer status…"}
              </Text>
            </View>
            {secondsLeft !== null && secondsLeft > 0 && (
              <View style={styles.offerCountdown}>
                <Text style={styles.offerCountdownText}>{secondsLeft}</Text>
              </View>
            )}
          </View>
        )}

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
            <Pressable
              style={({ pressed }) => [styles.cardRow, pressed && styles.callRowPressed]}
              onPress={() => openDirections(order.shopLat, order.shopLng, order.shopAddress)}
            >
              <Ionicons name="location-outline" size={18} color={Colors.dark.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={styles.cardRowLabel}>Address</Text>
                <Text style={styles.cardRowValue}>{order.shopAddress}</Text>
                <Text style={styles.directionsHint}>Tap to navigate</Text>
              </View>
              <Ionicons name="navigate-circle-outline" size={22} color={Colors.dark.tint} style={styles.mapIcon} />
            </Pressable>
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
            <Pressable
              style={({ pressed }) => [styles.cardRow, pressed && styles.callRowPressed]}
              onPress={() => openDirections(order.customerLat, order.customerLng, order.customerAddress)}
            >
              <Ionicons name="location-outline" size={18} color={Colors.dark.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={styles.cardRowLabel}>Address</Text>
                <Text style={styles.cardRowValue}>{order.customerAddress}</Text>
                <Text style={styles.directionsHint}>Tap to navigate</Text>
              </View>
              <Ionicons name="navigate-circle-outline" size={22} color={Colors.dark.tint} style={styles.mapIcon} />
            </Pressable>
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

        {order.backendStatus === "OUT_FOR_DELIVERY" && order.codAmount != null &&
          order.paymentStatus === "PENDING" && (
          <View style={styles.codBanner}>
            <Ionicons name="cash-outline" size={20} color="#4ADE80" />
            <View style={{ flex: 1 }}>
              <Text style={styles.codTitle}>Collect {formatMoney(order.codAmount)} in cash</Text>
              <Text style={styles.codSubtitle}>
                Cash on delivery — collect the full amount before handing over the laundry.
              </Text>
            </View>
          </View>
        )}

        {(order.paymentStatus === "COLLECTED" || order.paymentStatus === "SETTLED") &&
          order.codAmount == null && (
          <View style={styles.codBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
            <View style={{ flex: 1 }}>
              <Text style={styles.codTitle}>Paid online ✓</Text>
              <Text style={styles.codSubtitle}>
                Nothing to collect — just hand over the laundry.
              </Text>
            </View>
          </View>
        )}

        {order.delayReportedAt ? (
          <View style={styles.delayReportedBanner}>
            <Ionicons name="alert-circle" size={20} color="#FFB020" />
            <View style={{ flex: 1 }}>
              <Text style={styles.delayReportedTitle}>Delay reported</Text>
              <Text style={styles.delayReportedSub}>
                Support has been notified. This order won't be auto-reassigned.
              </Text>
            </View>
          </View>
        ) : canReportDelay ? (
          <Pressable
            style={({ pressed }) => [styles.reportDelayBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowDelay(true)}
          >
            <Ionicons name="warning-outline" size={18} color={Colors.dark.textSecondary} />
            <Text style={styles.reportDelayText}>Running late? Report a delay</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {isOffer ? (
        <View
          style={[
            styles.bottomBar,
            styles.offerBar,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.declineButton,
              pressed && { opacity: 0.8 },
              declineMutation.isPending && styles.actionButtonDisabled,
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              declineMutation.mutate();
            }}
            disabled={declineMutation.isPending || acceptMutation.isPending}
          >
            {declineMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.dark.danger} />
            ) : (
              <Text style={styles.declineButtonText}>Decline</Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && styles.actionButtonPressed,
              acceptMutation.isPending && styles.actionButtonDisabled,
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              acceptMutation.mutate();
            }}
            disabled={acceptMutation.isPending || declineMutation.isPending}
          >
            {acceptMutation.isPending ? (
              <ActivityIndicator size="small" color="#0D0F14" />
            ) : (
              <Text style={styles.actionButtonText}>
                Accept Offer{secondsLeft !== null && secondsLeft > 0 ? ` (${secondsLeft}s)` : ""}
              </Text>
            )}
          </Pressable>
        </View>
      ) : nextAction ? (
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
      ) : null}

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
              {order.backendStatus === "OUT_FOR_DELIVERY" && order.codAmount != null && order.paymentStatus === "PENDING"
                ? `Collect ${formatMoney(order.codAmount)} in cash from the customer, then confirm. This records the payment as collected.`
                : order.backendStatus === "OUT_FOR_DELIVERY" && order.paymentStatus !== "PENDING"
                ? "Already paid online — nothing to collect. Confirm the handover."
                : nextAction?.modalSubtitle || "Are you sure?"}
            </Text>

            {order.backendStatus === "OUT_FOR_DELIVERY" && (
              <Pressable
                style={({ pressed }) => [styles.proofButton, pressed && { opacity: 0.85 }]}
                onPress={handleTakeProof}
                disabled={uploadingProof || isUpdating}
              >
                {uploadingProof ? (
                  <ActivityIndicator size="small" color={Colors.dark.tint} />
                ) : proofUri ? (
                  <>
                    <Image source={{ uri: proofUri }} style={styles.proofThumb} />
                    <Text style={styles.proofButtonText}>Photo added — retake</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color={Colors.dark.tint} />
                    <Text style={styles.proofButtonText}>Take delivery photo (required)</Text>
                  </>
                )}
              </Pressable>
            )}
            {order.backendStatus === "OUT_FOR_DELIVERY" && !proofUri && (
              <Text style={styles.proofRequiredHint}>
                A photo at handover is required to confirm delivery.
              </Text>
            )}

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
                  (isUpdating || (order.backendStatus === "OUT_FOR_DELIVERY" && !proofUri)) && { opacity: 0.5 },
                ]}
                onPress={handleStatusUpdate}
                disabled={isUpdating || (order.backendStatus === "OUT_FOR_DELIVERY" && !proofUri)}
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

      {/* ── Report-a-delay modal ──────────────────────────── */}
      <Modal
        visible={showDelay}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDelay(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report a delay</Text>
            <Text style={styles.modalSubtitle}>
              Let the team know what's holding you up. Your order won't be
              reassigned and support can help if needed.
            </Text>

            <View style={styles.reasonList}>
              {DELAY_REASONS.map((r) => {
                const selected = delayReason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    style={[styles.reasonChip, selected && styles.reasonChipActive]}
                    onPress={() => setDelayReason(r.value)}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={selected ? Colors.dark.tint : Colors.dark.textMuted}
                    />
                    <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.noteInput}
              value={delayNote}
              onChangeText={setDelayNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={Colors.dark.textMuted}
              multiline
              maxLength={280}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setShowDelay(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirm,
                  pressed && { opacity: 0.85 },
                  (!delayReason || reportDelayMutation.isPending) && { opacity: 0.5 },
                ]}
                onPress={() => reportDelayMutation.mutate()}
                disabled={!delayReason || reportDelayMutation.isPending}
              >
                {reportDelayMutation.isPending ? (
                  <ActivityIndicator size="small" color="#0D0F14" />
                ) : (
                  <Text style={styles.modalConfirmText}>Submit</Text>
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
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.dark.text,
  },
  errorSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
    marginTop: 4,
  },
  backLink: {
    padding: 8,
    marginTop: 4,
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
  directionsHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.dark.tint,
    marginTop: 3,
  },
  mapIcon: {
    alignSelf: "center",
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
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: "rgba(0, 212, 170, 0.10)",
    borderWidth: 1,
    borderColor: Colors.dark.tint,
  },
  proofButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.dark.tint,
  },
  proofThumb: { width: 32, height: 32, borderRadius: 6 },
  proofRequiredHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: 14,
    marginTop: -6,
  },
  reportDelayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  reportDelayText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  delayReportedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 176, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 176, 32, 0.35)",
    borderRadius: 16,
    padding: 14,
  },
  delayReportedTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#FFB020" },
  delayReportedSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  reasonList: { width: "100%", gap: 8, marginVertical: 8 },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  reasonChipActive: {
    borderColor: Colors.dark.tint,
    backgroundColor: "rgba(0, 212, 170, 0.08)",
  },
  reasonText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.dark.textSecondary, flex: 1 },
  reasonTextActive: { color: Colors.dark.text },
  noteInput: {
    width: "100%",
    minHeight: 64,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.text,
    textAlignVertical: "top",
    marginTop: 4,
    marginBottom: 8,
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
  offerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 176, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 176, 32, 0.35)",
    borderRadius: 16,
    padding: 14,
  },
  offerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 176, 32, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  offerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFB020",
  },
  offerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  offerCountdown: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFB020",
    alignItems: "center",
    justifyContent: "center",
  },
  offerCountdownText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFB020",
  },
  offerBar: {
    flexDirection: "row",
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    paddingHorizontal: 22,
    backgroundColor: "rgba(255, 75, 110, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 75, 110, 0.3)",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.dark.danger,
  },
  codBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(74, 222, 128, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.35)",
    borderRadius: 16,
    padding: 14,
  },
  codTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#4ADE80",
  },
  codSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
});
