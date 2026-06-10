import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";

function AuthForm() {
  const colors = useColors();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!email || !password || (mode === "register" && !username)) {
      setError("Tous les champs sont requis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>HC</Text>
        </View>
        <Text style={[styles.authTitle, { color: colors.foreground }]}>
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </Text>
        <Text style={[styles.authSub, { color: colors.mutedForeground }]}>
          {mode === "login" ? "Accédez à vos tickets et gains" : "Rejoignez Halgo Cash"}
        </Text>

        {error !== "" && (
          <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
            <Feather name="alert-circle" size={14} color="#dc2626" />
            <Text style={[styles.errorBoxText, { color: "#dc2626" }]}>{error}</Text>
          </View>
        )}

        {mode === "register" && (
          <View style={[styles.field, { borderColor: colors.border, backgroundColor: colors.muted }]}>
            <Feather name="user" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.fieldInput, { color: colors.foreground }]}
              value={username}
              onChangeText={setUsername}
              placeholder="Nom d'utilisateur"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />
          </View>
        )}

        <View style={[styles.field, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Feather name="mail" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.fieldInput, { color: colors.foreground }]}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={[styles.field, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Feather name="lock" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.fieldInput, { color: colors.foreground }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
          />
        </View>

        <Pressable
          onPress={submit}
          style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 }]}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>{mode === "login" ? "Se connecter" : "S'inscrire"}</Text>
          }
        </Pressable>

        <Pressable onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          <Text style={[styles.switchText, { color: colors.primary }]}>
            {mode === "login" ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Se connecter"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ProfileInfo() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Avatar + name */}
      <View style={[styles.avatarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user?.username}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.roleText, { color: colors.primary }]}>{user?.role}</Text>
        </View>
      </View>

      {/* Info rows */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <InfoRow icon="user" label="Identifiant" value={`#${user?.id}`} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow icon="shield" label="Rôle" value={user?.role ?? ""} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow icon="check-circle" label="Compte" value="Actif" valueColor="#16a34a" />
      </View>

      {/* KYC notice */}
      <View style={[styles.kycBanner, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
        <Feather name="file-text" size={18} color="#ca8a04" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kycTitle, { color: "#92400e" }]}>Vérification d'identité (KYC)</Text>
          <Text style={[styles.kycSub, { color: "#b45309" }]}>
            Soumettez vos documents depuis la version web pour finaliser votre profil.
          </Text>
        </View>
      </View>

      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [styles.logoutBtn, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
        disabled={loggingOut}
      >
        {loggingOut
          ? <ActivityIndicator color={colors.destructive} size="small" />
          : <>
              <Feather name="log-out" size={18} color={colors.destructive} />
              <Text style={[styles.logoutText, { color: colors.destructive }]}>Se déconnecter</Text>
            </>
        }
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, valueColor }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; valueColor?: string }) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profil</Text>
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : user ? (
        <ProfileInfo />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16, paddingBottom: bottomPad + 90 }}
          keyboardShouldPersistTaps="handled"
        >
          <AuthForm />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 22, fontFamily: "Inter_700Bold", paddingHorizontal: 16, paddingVertical: 12 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  authCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 14 },
  logoMark: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  authTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  authSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", padding: 10, borderRadius: 10, borderWidth: 1 },
  errorBoxText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  fieldInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  submitBtn: { width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  submitText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  switchText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  divider: { height: 1, marginHorizontal: 16 },
  kycBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  kycTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  kycSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14 },
  logoutText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
