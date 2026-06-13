import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/lib/auth-context";
import { submitDocuments, type DocumentsStatus } from "@/lib/api";
import { uploadRiderDocument, type DocKind } from "@/lib/upload";
import Colors from "@/constants/colors";

interface DocSlot {
  kind: DocKind;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SLOTS: DocSlot[] = [
  {
    kind: "dl",
    label: "Driving Licence",
    hint: "Front side, all text readable",
    icon: "card-outline",
  },
  {
    kind: "rc",
    label: "Vehicle RC",
    hint: "Registration certificate of your vehicle",
    icon: "document-text-outline",
  },
  {
    kind: "selfie",
    label: "Selfie",
    hint: "A clear photo of your face",
    icon: "person-outline",
  },
];

function statusMeta(status: DocumentsStatus): {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (status) {
    case "VERIFIED":
      return {
        label: "Verified",
        color: Colors.dark.success,
        bg: "rgba(0, 212, 170, 0.12)",
        icon: "checkmark-circle-outline",
      };
    case "SUBMITTED":
      return {
        label: "Under review",
        color: Colors.dark.warning,
        bg: "rgba(255, 183, 75, 0.12)",
        icon: "time-outline",
      };
    case "REJECTED":
      return {
        label: "Action needed",
        color: Colors.dark.danger,
        bg: "rgba(255, 75, 110, 0.12)",
        icon: "alert-circle-outline",
      };
    default:
      return {
        label: "Not submitted",
        color: Colors.dark.textSecondary,
        bg: Colors.dark.surface,
        icon: "cloud-upload-outline",
      };
  }
}

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { rider, refreshProfile } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // Local picked URIs (file://) overriding the stored remote URLs.
  const [picked, setPicked] = useState<Record<DocKind, string | null>>({
    dl: null,
    rc: null,
    selfie: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const status = rider?.documentsStatus ?? "NOT_SUBMITTED";
  const meta = statusMeta(status);
  const locked = status === "SUBMITTED" || status === "VERIFIED";

  const remoteFor = useCallback(
    (kind: DocKind): string | null => {
      if (!rider) return null;
      if (kind === "dl") return rider.dlImageUrl;
      if (kind === "rc") return rider.rcImageUrl;
      return rider.selfieUrl;
    },
    [rider],
  );

  const pick = useCallback(
    async (kind: DocKind) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo access so you can attach your document.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        setPicked((p) => ({ ...p, [kind]: result.assets[0].uri }));
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    // Collect the kinds the rider has newly picked.
    const toUpload = SLOTS.filter((s) => picked[s.kind]);
    if (toUpload.length === 0) {
      Alert.alert("Nothing to submit", "Please add at least one document photo.");
      return;
    }
    setSubmitting(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const urls: { dlImageUrl?: string; rcImageUrl?: string; selfieUrl?: string } = {};
      for (const s of toUpload) {
        const url = await uploadRiderDocument(s.kind, picked[s.kind] as string);
        if (s.kind === "dl") urls.dlImageUrl = url;
        if (s.kind === "rc") urls.rcImageUrl = url;
        if (s.kind === "selfie") urls.selfieUrl = url;
      }
      await submitDocuments(urls);
      await refreshProfile();
      setPicked({ dl: null, rc: null, selfie: null });
      Alert.alert(
        "Submitted",
        "Your documents are now under review. We'll notify you once they're verified.",
      );
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [picked, refreshProfile]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset + 16,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.title}>Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
      </View>

      {status === "REJECTED" && rider?.documentsRejectionReason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>Why it was returned</Text>
          <Text style={styles.reasonText}>{rider.documentsRejectionReason}</Text>
        </View>
      )}

      <Text style={styles.intro}>
        {locked
          ? status === "VERIFIED"
            ? "Your documents have been verified. You're all set."
            : "We're reviewing your documents. This usually takes a little while."
          : "Upload clear photos of your documents. Our team reviews them before activating your account."}
      </Text>

      <View style={styles.slots}>
        {SLOTS.map((slot) => {
          const local = picked[slot.kind];
          const remote = remoteFor(slot.kind);
          const preview = local || remote;
          return (
            <Pressable
              key={slot.kind}
              style={({ pressed }) => [
                styles.slot,
                pressed && !locked && styles.pressed,
              ]}
              onPress={() => !locked && pick(slot.kind)}
              disabled={locked || submitting}
            >
              {preview ? (
                <Image source={{ uri: preview }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name={slot.icon} size={26} color={Colors.dark.textMuted} />
                </View>
              )}
              <View style={styles.slotBody}>
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <Text style={styles.slotHint}>
                  {local
                    ? "New photo ready to submit"
                    : remote
                    ? "Uploaded"
                    : slot.hint}
                </Text>
              </View>
              {!locked && (
                <Ionicons
                  name={preview ? "create-outline" : "add-circle-outline"}
                  size={22}
                  color={Colors.dark.tint}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {!locked && (
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && styles.pressed,
            submitting && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#0D0F14" />
          ) : (
            <Text style={styles.submitText}>
              {status === "REJECTED" ? "Resubmit documents" : "Submit for review"}
            </Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 24,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 16,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  reasonBox: {
    backgroundColor: "rgba(255, 75, 110, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 75, 110, 0.3)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  reasonTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.dark.danger,
    marginBottom: 4,
  },
  reasonText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
  },
  intro: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  slots: {
    gap: 12,
  },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    padding: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  slotBody: {
    flex: 1,
    gap: 3,
  },
  slotLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.dark.text,
  },
  slotHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  submitBtn: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0D0F14",
  },
  pressed: {
    opacity: 0.7,
  },
});
