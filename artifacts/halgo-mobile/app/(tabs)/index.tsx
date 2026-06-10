import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface DrawInfo {
  id: number;
  drawNumber: number;
  jackpotAmount: number;
  status: string;
  scheduledAt: string;
}

interface Winner {
  id: number;
  maskedCode: string;
  prizeAmount: number;
  drawNumber: number;
  claimedAt: string;
}

interface TicketResult {
  code: string;
  status: string;
  isWinner: boolean;
  prizeAmount: number | null;
  series: string;
  price: number;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function JackpotBanner({ draw }: { draw: DrawInfo | null }) {
  const colors = useColors();
  const amount = draw ? draw.jackpotAmount.toLocaleString("fr-CD") : "—";
  return (
    <LinearGradient colors={["#0d3d24", "#1a6b42"]} style={styles.banner}>
      <Text style={styles.bannerLabel}>JACKPOT ACTUEL</Text>
      <Text style={[styles.bannerAmount, { color: colors.gold }]}>${amount}</Text>
      {draw && (
        <Text style={styles.bannerDraw}>Tirage #{draw.drawNumber}</Text>
      )}
    </LinearGradient>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const [activeDraw, setActiveDraw] = useState<DrawInfo | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [ticketCode, setTicketCode] = useState("");
  const [ticketResult, setTicketResult] = useState<TicketResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState("");
  const inputRef = useRef<TextInput>(null);

  React.useEffect(() => {
    Promise.all([
      apiFetch<DrawInfo[]>("/api/draws?status=active&limit=1"),
      apiFetch<Winner[]>("/api/winners?limit=10"),
    ])
      .then(([draws, w]) => {
        setActiveDraw(draws[0] ?? null);
        setWinners(w);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  async function checkTicket() {
    const code = ticketCode.trim().toUpperCase();
    if (!code) return;
    setCheckLoading(true);
    setCheckError("");
    setTicketResult(null);
    try {
      const t = await apiFetch<TicketResult>(`/api/tickets/${code}`);
      setTicketResult(t);
      await Haptics.notificationAsync(
        t.isWinner
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch {
      setCheckError("Code introuvable. Vérifiez et réessayez.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCheckLoading(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {loadingData ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <JackpotBanner draw={activeDraw} />
      )}

      {/* Ticket Checker */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Vérifier un ticket</Text>
        <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            value={ticketCode}
            onChangeText={(t) => { setTicketCode(t.toUpperCase()); setTicketResult(null); setCheckError(""); }}
            placeholder="Code du ticket (ex: HC-XXXXX)"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={checkTicket}
          />
          <Pressable
            onPress={checkTicket}
            style={({ pressed }) => [styles.checkBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            {checkLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Feather name="search" size={20} color="#fff" />
            }
          </Pressable>
        </View>

        {checkError !== "" && (
          <View style={[styles.resultBad, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
            <Feather name="x-circle" size={18} color="#dc2626" />
            <Text style={[styles.resultText, { color: "#dc2626" }]}>{checkError}</Text>
          </View>
        )}

        {ticketResult && (
          <View style={[
            styles.resultCard,
            { backgroundColor: ticketResult.isWinner ? "#f0fdf4" : colors.muted, borderColor: ticketResult.isWinner ? "#86efac" : colors.border }
          ]}>
            <View style={styles.resultRow}>
              <Feather
                name={ticketResult.isWinner ? "award" : "tag"}
                size={24}
                color={ticketResult.isWinner ? "#16a34a" : colors.mutedForeground}
              />
              <View style={styles.resultInfo}>
                <Text style={[styles.resultCode, { color: colors.foreground }]}>{ticketResult.code}</Text>
                <Text style={[styles.resultStatus, { color: colors.mutedForeground }]}>
                  {statusLabel(ticketResult.status)}
                </Text>
              </View>
              {ticketResult.isWinner && (
                <View style={styles.prizeBadge}>
                  <Text style={styles.prizeText}>${ticketResult.prizeAmount?.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Recent Winners */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Derniers gagnants</Text>
      </View>
      {winners.length === 0 ? (
        <View style={styles.emptyWinners}>
          <Feather name="award" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucun gagnant pour l'instant</Text>
        </View>
      ) : (
        <FlatList
          data={winners}
          keyExtractor={(w) => String(w.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={[styles.winnerRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.winnerIcon, { backgroundColor: "#fef9c3" }]}>
                <Feather name="star" size={16} color="#ca8a04" />
              </View>
              <View style={styles.winnerInfo}>
                <Text style={[styles.winnerCode, { color: colors.foreground }]}>{item.maskedCode}</Text>
                <Text style={[styles.winnerDraw, { color: colors.mutedForeground }]}>Tirage #{item.drawNumber}</Text>
              </View>
              <Text style={[styles.winnerPrize, { color: "#16a34a" }]}>${item.prizeAmount.toLocaleString()}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      )}
    </ScrollView>
  );
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    available: "Disponible",
    sold: "Vendu",
    validated: "Validé",
    claimed: "Réclamé",
    expired: "Expiré",
  };
  return map[s] ?? s;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { height: 180, alignItems: "center", justifyContent: "center" },
  banner: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 24, alignItems: "center" },
  bannerLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginBottom: 8 },
  bannerAmount: { fontSize: 48, fontFamily: "Inter_700Bold" },
  bannerDraw: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  card: { margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  checkBtn: { paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center", alignItems: "center" },
  resultBad: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  resultText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  resultCard: { marginTop: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultInfo: { flex: 1 },
  resultCode: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resultStatus: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  prizeBadge: { backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  prizeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyWinners: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  winnerRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  winnerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  winnerInfo: { flex: 1 },
  winnerCode: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  winnerDraw: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  winnerPrize: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
