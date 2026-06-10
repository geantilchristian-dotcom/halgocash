const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

process.env.EXPO_ROUTER_APP_ROOT =
  process.env.EXPO_ROUTER_APP_ROOT || "./app";
process.env.EXPO_ROUTER_IMPORT_MODE =
  process.env.EXPO_ROUTER_IMPORT_MODE || "lazy";

const config = getDefaultConfig(__dirname);

// On web:
// 1. `expo-router/_ctx` uses `require.context(process.env.EXPO_ROUTER_APP_ROOT, …)`.
//    Metro needs a string literal so we redirect to our override that hardcodes "./app".
// 2. `react-native-worklets` calls init() on import, which tries to boot a native Hermes
//    worklet runtime. On web that throws, so we redirect to a JS no-op mock.
const ctxOverridePath = path.resolve(__dirname, "_ctx-web-override.js");
const workletsWebMockPath = path.resolve(__dirname, "_worklets-web-mock.js");

const originalResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    // expo-router context override
    if (
      moduleName === "expo-router/_ctx" ||
      moduleName.endsWith("/expo-router/_ctx")
    ) {
      return { filePath: ctxOverridePath, type: "sourceFile" };
    }

    // worklets web mock — prevents native JSI runtime init crash
    if (
      moduleName === "react-native-worklets" ||
      moduleName === "react-native-worklets-core" ||
      moduleName.endsWith("/react-native-worklets") ||
      moduleName.endsWith("/react-native-worklets-core")
    ) {
      return { filePath: workletsWebMockPath, type: "sourceFile" };
    }
  }

  if (originalResolve) {
    return originalResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
