import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import {
  fetchRiderEarnings,
  type RiderEarningsResponse,
  type EarningsDaySummary,
  type EarningsEntry,
} from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────

function formatPaise(paise: number): string {
  return "₹" + (paise / 100).toFixed(2);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceBadgeLabel(source: string): string {
  if (source === "GEO_CUSTOMER_SHOP" || source === "GEO_RIDER_SHOP") return "GPS";
  if (source === "ESTIMATED_FROM_FEE") return "EST";
  return source;
}

// ── Summary Card ─────────────────────────────────────────

function SummaryCard({ data }: { data: RiderEarningsResponse }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Earnings Overview</Text>
      <View style={styles.summaryRow}>
        <SummaryItem
          icon="trending-up-outline"
          label="Total Earned"
          value={formatPaise(data.totalEarnings)}
          color={Colors.dark.success}
        />
        <SummaryItem
          icon="bicycle-outline"
          label="Distance"
          value={`${data.totalDistanceKm.toFixed(1)} km`}
          color={Colors.dark.accent}
        />
        <SummaryItem
          icon="layers-outline"
          label="Legs"
          value={String(data.totalLegs)}
          color={Colors.dark.warning}
        />
      </View>
    </View>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Day Section ──────────────────────────────────────────

function DaySection({ day }: { day: EarningsDaySummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.dayCard}>
      <Pressable
        style={styles.dayHeader}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
          <Text style={styles.dayMeta}>
            {day.legs} leg{day.legs !== 1 ? "s" : ""} · {day.distanceKm.toFixed(1)} km
          </Text>
        </View>
        <Text style={styles.dayAmount}>{formatPaise(day.earnings)}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.dark.textMuted}
          style={{ marginLeft: 8 }}
        />
      </Pressable>

      {expanded && (
        <View style={styles.entriesList}>
          {day.entries.map((entry, idx) => (
            <EntryRow key={`${entry.orderId}-${entry.leg}-${idx}`} entry={entry} isLast={idx === day.entries.length - 1} />
          ))}
        </View>
      )}
    </View>
  );
}

function EntryRow({ entry, isLast }: { entry: EarningsEntry; isLast: boolean }) {
  const isPickup = entry.leg === "PICKUP";
  const legColor = isPickup ? Colors.dark.accent : Colors.dark.success;
  const sourceLabel = sourceBadgeLabel(entry.distanceSource);
  const isGps = sourceLabel === "GPS";

  return (
    <View style={[styles.entryRow, !isLast && styles.entryBorder]}>
      <View style={[styles.legBadge, { backgroundColor: legColor + "18" }]}>
        <Ionicons
          name={isPickup ? "arrow-up-outline" : "arrow-down-outline"}
          size={14}
          color={legColor}
        />
        <Text style={[styles.legText, { color: legColor }]}>{entry.leg}</Text>
      </View>

      <View style={styles.entryDetails}>
        <Text style={styles.entryDistance}>
          {entry.distanceKm.toFixed(1)} km
          <Text style={styles.entryRate}>{" "}@ ₹{(entry.ratePerKm / 100).toFixed(0)}/km</Text>
        </Text>
        <View style={styles.entryMetaRow}>
          <View style={[styles.sourceBadge, isGps ? styles.sourceBadgeGps : styles.sourceBadgeEst]}>
            <Text style={[styles.sourceBadgeText, isGps ? styles.sourceBadgeTextGps : styles.sourceBadgeTextEst]}>
              {sourceLabel}
            </Text>
          </View>
          <Text style={styles.entryTime}>{formatTime(entry.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.entryAmount}>{formatPaise(entry.amount)}</Text>
    </View>
  );
}

// ── Empty State ──────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="wallet-outline" size={48} color={Colors.dark.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No earnings yet</Text>
      <Text style={styles.emptySubtitle}>
        Complete deliveries to start earning. Your earnings will appear here.
      </Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<RiderEarningsResponse>({
    queryKey: ["rider-earnings"],
    queryFn: fetchRiderEarnings,
    staleTime: 120_000,          // earnings change less frequently — 2 min
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // ── Loading ─────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopInset + 16 }]}>
        <ActivityIndicator size="large" color={Colors.dark.tint} />
        <Text style={styles.loadingText}>Loading earnings…</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────
  if (isError) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={Colors.dark.danger} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorSubtitle}>
          {error instanceof Error ? error.message : "Could not load earnings"}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Ionicons name="refresh-outline" size={18} color={Colors.dark.text} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const hasEarnings = data && data.totalLegs > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset + 16 }]}>
      <Text style={styles.screenTitle}>Wallet</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 90) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.dark.tint}
            colors={[Colors.dark.tint]}
          />
        }
      >
        {hasEarnings ? (
          <>
            <SummaryCard data={data} />
            <Text style={styles.sectionTitle}>Earnings History</Text>
            {data.days.map((day) => (
              <DaySection key={day.date} day={day} />
            ))}
          </>
        ) : (
          <EmptyState />
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.dark.text,
    marginBottom: 20,
  },
  scrollContent: {
    gap: 16,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 12,
  },

  // ── Error ─────────────────────────────────────────
  errorTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.dark.text,
    marginTop: 12,
  },
  errorSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: Colors.dark.surfaceElevated,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  retryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.dark.text,
  },

  // ── Summary ───────────────────────────────────────
  summaryCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  summaryTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  summaryValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.dark.text,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },

  // ── Section Title ─────────────────────────────────
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.dark.text,
    marginTop: 4,
  },

  // ── Day Card ──────────────────────────────────────
  dayCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  dayDate: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.dark.text,
  },
  dayMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  dayAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.dark.success,
  },

  // ── Entry Row ─────────────────────────────────────
  entriesList: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  entryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  legBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  legText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  entryDetails: {
    flex: 1,
  },
  entryDistance: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.dark.text,
  },
  entryRate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  entryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sourceBadgeGps: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
  },
  sourceBadgeEst: {
    backgroundColor: "rgba(255, 183, 75, 0.12)",
  },
  sourceBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  sourceBadgeTextGps: {
    color: Colors.dark.success,
  },
  sourceBadgeTextEst: {
    color: Colors.dark.warning,
  },
  entryTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  entryAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.dark.text,
  },

  // ── Empty State ───────────────────────────────────
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.dark.text,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
});
