import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type NotifType =
  | "ticket_win"
  | "withdrawal_paid"
  | "withdrawal_pending"
  | "withdrawal_cancelled"
  | "referral_ticket";

interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  amount?: number;
  currency?: string;
  createdAt: string;
  seen: boolean;
}

interface NotifResponse {
  count: number;
  items: NotifItem[];
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const TYPE_META: Record<NotifType, { icon: string; color: string }> = {
  ticket_win:             { icon: "star",          color: "#F5C518" },
  withdrawal_paid:        { icon: "check-circle",  color: "#22c55e" },
  withdrawal_pending:     { icon: "clock",         color: "#f59e0b" },
  withdrawal_cancelled:   { icon: "x-circle",      color: "#ef4444" },
  referral_ticket:        { icon: "users",         color: "#38bdf8" },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;

  const [data, setData] = useState<NotifResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/notifications`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as NotifResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const items = data?.items ?? [];

  const renderItem = ({ item }: { item: NotifItem }) => {
    const meta = TYPE_META[item.type] ?? { icon: "bell", color: colors.primary };
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: item.seen ? colors.card : `${meta.color}10`,
            borderColor: item.seen ? colors.border : `${meta.color}30`,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${meta.color}18` }]}>
          <Feather name={meta.icon as never} size={18} color={meta.color} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.seen && (
              <View style={[styles.dot, { backgroundColor: meta.color }]} />
            )}
          </View>
          <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        {item.amount != null && (
          <Text style={[styles.amount, { color: meta.color }]}>
            +{item.amount.toLocaleString("fr-FR")} {item.currency ?? "FC"}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Notifications</Text>
        {(data?.count ?? 0) > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{data!.count}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={[styles.retryBtn, { borderColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>Réessayer</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Feather name="bell" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucune notification</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Vos gains, retraits et parrainages apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{
            padding: 12,
            paddingBottom: (isWeb ? 34 : insets.bottom) + 90,
            gap: 8,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  screenTitle: { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  retryText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  textWrap: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  amount: { fontSize: 14, fontFamily: "Inter_700Bold", flexShrink: 0, alignSelf: "center" },
});
