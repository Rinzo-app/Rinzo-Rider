import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { updateRiderProfile } from "@/lib/api";
import Colors from "@/constants/colors";

const VEHICLE_TYPES = ["Motorcycle", "Scooter", "Bicycle", "Car"];

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
  const { rider, logout, updateRider } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // ── Vehicle details editing ─────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editVehicleType, setEditVehicleType] = useState("Motorcycle");
  const [editVehicleNumber, setEditVehicleNumber] = useState("");
  const [editLicense, setEditLicense] = useState("");
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setEditVehicleType(rider?.vehicleType || "Motorcycle");
    setEditVehicleNumber(rider?.vehicleNumber || "");
    setEditLicense(rider?.licenseNumber || "");
    setShowEdit(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateRiderProfile({
        vehicleType: editVehicleType,
        vehicleNumber: editVehicleNumber.trim(),
        licenseNumber: editLicense.trim(),
      });
      if (rider) {
        updateRider({
          ...rider,
          vehicleType: updated.vehicleType,
          vehicleNumber: updated.vehicleNumber,
          licenseNumber: updated.licenseNumber,
        });
      }
      setShowEdit(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Update failed", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

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
          <InfoRow icon="calendar-outline" label="Joined" value={joinDate} />
          <View style={styles.divider} />
          <InfoRow
            icon="checkmark-done-outline"
            label="Total Deliveries"
            value={String(rider?.totalDeliveries || 0)}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderText}>Vehicle Details</Text>
            <Pressable onPress={openEdit} hitSlop={10} style={styles.editBtn}>
              <Ionicons name="pencil" size={14} color={Colors.dark.tint} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <InfoRow icon="bicycle-outline" label="Vehicle" value={rider?.vehicleType || "-"} />
          <View style={styles.divider} />
          <InfoRow icon="car-outline" label="Vehicle Number" value={rider?.vehicleNumber || "Not added"} />
          <View style={styles.divider} />
          <InfoRow icon="card-outline" label="Driving License" value={rider?.licenseNumber || "Not added"} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.dark.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vehicle Details</Text>
              <Pressable onPress={() => setShowEdit(false)} hitSlop={10} disabled={saving}>
                <Ionicons name="close" size={22} color={Colors.dark.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.formLabel}>Vehicle Type</Text>
            <View style={styles.vehicleRow}>
              {VEHICLE_TYPES.map((v) => (
                <Pressable
                  key={v}
                  style={[styles.vehicleChip, editVehicleType === v && styles.vehicleChipActive]}
                  onPress={() => setEditVehicleType(v)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.vehicleChipText,
                      editVehicleType === v && styles.vehicleChipTextActive,
                    ]}
                  >
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Vehicle Number</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. KL 07 AB 1234"
              placeholderTextColor={Colors.dark.textMuted}
              value={editVehicleNumber}
              onChangeText={setEditVehicleNumber}
              autoCapitalize="characters"
              editable={!saving}
            />

            <Text style={styles.formLabel}>Driving License Number</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. KL07 20250001234"
              placeholderTextColor={Colors.dark.textMuted}
              value={editLicense}
              onChangeText={setEditLicense}
              autoCapitalize="characters"
              editable={!saving}
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0A0A0F" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
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
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.dark.tint,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    color: Colors.dark.text,
  },
  formLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.dark.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  vehicleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vehicleChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  vehicleChipActive: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    borderColor: Colors.dark.tint,
  },
  vehicleChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  vehicleChipTextActive: {
    color: Colors.dark.tint,
  },
  formInput: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.dark.text,
  },
  saveBtn: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0A0A0F",
  },
});
