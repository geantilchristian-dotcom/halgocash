import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Ticket {
  id: number;
  code: string;
  status: string;
  price: number;
  series: string;
  isWinner: boolean;
  prizeAmount: number | null;
  drawNumber: number | null;
  soldAt: string | null;
}

const STATUS_FILTERS = ["Tous", "Vendu", "Validé", "Réclamé", "Expiré"];
const STATUS_MAP: Record<string, string> = {
  Tous: "",
  Vendu: "sold",
  Validé: "validated",
  Réclamé: "claimed",
  Expiré: "expired",
};

function statusColor(status: string, primary: string) {
  const map: Record<string, string> = {
    sold: "#ca8a04",
    validated: primary,
    claimed: "#16a34a",
    expired: "#9ca3af",
    available: "#6b7280",
  };
  return map[status] ?? "#6b7280";
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    available: "Disponible", sold: "Vendu", validated: "Validé", claimed: "Réclamé", expired: "Expiré",
  };
  return map[s] ?? s;
}

export default function TicketsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("Tous");
  const [error, setError] = useState("");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const statusParam = STATUS_MAP[filter] ? `?status=${STATUS_MAP[filter]}` : "";
      const res = await fetch(`${BASE}/api/auth/tickets${statusParam}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Ticket[];
      setTickets(data);
      setLoaded(true);
    } catch {
      setError("Impossible de charger les tickets");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    if (user) fetchTickets();
  }, [user, fetchTickets]);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad + 20 }]}>
        <Feather name="lock" size={48} color={colors.mutedForeground} />
        <Text style={[styles.lockTitle, { color: colors.foreground }]}>Connexion requise</Text>
        <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
          Connectez-vous dans l'onglet Profil pour voir vos tickets.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Mes Tickets</Text>
        <Pressable onPress={fetchTickets} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Feather name="refresh-cw" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Filter chips */}
      <FlatList
        data={STATUS_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => f}
        contentContainerStyle={styles.filtersRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setFilter(item)}
            style={[
              styles.chip,
              {
                backgroundColor: filter === item ? colors.primary : colors.muted,
                borderColor: filter === item ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: filter === item ? "#fff" : colors.mutedForeground }]}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Pressable onPress={fetchTickets} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : loaded && tickets.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucun ticket</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Achetez vos tickets chez un vendeur agréé.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ticketTop}>
                <View style={[styles.seriesBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.seriesText, { color: colors.primary }]}>{item.series}</Text>
                </View>
                {item.isWinner && (
                  <View style={[styles.winnerBadge, { backgroundColor: "#dcfce7" }]}>
                    <Feather name="award" size={12} color="#16a34a" />
                    <Text style={styles.winnerBadgeText}>Gagnant</Text>
                  </View>
                )}
                <View style={[styles.statusDot, { backgroundColor: statusColor(item.status, colors.primary) }]} />
                <Text style={[styles.statusText, { color: statusColor(item.status, colors.primary) }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
              <Text style={[styles.ticketCode, { color: colors.foreground }]}>{item.code}</Text>
              <View style={styles.ticketBottom}>
                <Text style={[styles.ticketPrice, { color: colors.mutedForeground }]}>
                  ${item.price.toFixed(2)}
                </Text>
                {item.drawNumber && (
                  <Text style={[styles.ticketDraw, { color: colors.mutedForeground }]}>
                    Tirage #{item.drawNumber}
                  </Text>
                )}
                {item.prizeAmount != null && item.prizeAmount > 0 && (
                  <Text style={[styles.ticketPrize, { color: "#16a34a" }]}>
                    Gain: ${item.prizeAmount.toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  filtersRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  ticketCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  ticketTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  seriesBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  seriesText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  winnerBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  winnerBadgeText: { color: "#16a34a", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: "auto" },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  ticketCode: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 8 },
  ticketBottom: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  ticketPrice: { fontSize: 13, fontFamily: "Inter_400Regular" },
  ticketDraw: { fontSize: 13, fontFamily: "Inter_400Regular" },
  ticketPrize: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  lockTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  lockSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
