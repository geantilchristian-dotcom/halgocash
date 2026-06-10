import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

// NativeTabs and SymbolView are iOS-only — guard against web/Android where they don't exist
let NativeTabs: React.ComponentType<React.PropsWithChildren> & {
  Trigger: React.ComponentType<{ name: string; children?: React.ReactNode }>;
} = null as unknown as typeof NativeTabs;
let Icon: React.ComponentType<{
  sf?: { default: string; selected: string };
}> = null as unknown as typeof Icon;
let Label: React.ComponentType<React.PropsWithChildren> = null as unknown as typeof Label;
let SymbolView: React.ComponentType<{
  name: string;
  tintColor: string | undefined;
  size: number;
}> = null as unknown as typeof SymbolView;

if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeTabs = require("expo-router/unstable-native-tabs");
    NativeTabs = nativeTabs.NativeTabs;
    Icon = nativeTabs.Icon;
    Label = nativeTabs.Label;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const symbols = require("expo-symbols");
    SymbolView = symbols.SymbolView;
  } catch {
    // Not available on this platform
  }
}

function NativeTabLayout() {
  if (!NativeTabs) return null;
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "ticket", selected: "ticket.fill" }} />
        <Label>Accueil</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tickets">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet.rectangle.fill" }} />
        <Label>Tickets</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) =>
            isIOS && SymbolView ? (
              <SymbolView name="ticket" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Tickets",
          tabBarIcon: ({ color }) =>
            isIOS && SymbolView ? (
              <SymbolView name="list.bullet" tintColor={color} size={24} />
            ) : (
              <Feather name="list" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) =>
            isIOS && SymbolView ? (
              <SymbolView name="person" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
