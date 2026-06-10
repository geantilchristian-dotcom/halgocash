---
name: Expo web Metro fixes
description: Two mandatory Metro resolver overrides for Expo Router + react-native-reanimated to work on web in this monorepo.
---

## Fix 1 — expo-router/_ctx string literal

**Rule:** Redirect `expo-router/_ctx` → `_ctx-web-override.js` (a local file) on web.

**Why:** `_ctx.web.js` inside expo-router uses `require.context(process.env.EXPO_ROUTER_APP_ROOT, …)`. Metro's `require.context` needs a **string literal** for the directory argument, not a `process.env` reference. Without the redirect, Metro either throws or bundles only 738 modules (the bare Expo welcome screen) instead of the full app (1496 modules).

**How to apply:** In `metro.config.js` `resolver.resolveRequest`, for `platform === "web"` match `moduleName === "expo-router/_ctx"` and return `{ filePath: path.resolve(__dirname, "_ctx-web-override.js"), type: "sourceFile" }`. The override file must use a **literal** `"./app"` string:
```js
export const ctx = require.context("./app", true, /regex/);
```
(No 4th `"lazy"` argument — Metro ignores it and omitting it is safer.)

## Fix 2 — react-native-worklets web mock

**Rule:** Redirect `react-native-worklets` (and `react-native-worklets-core`) → `_worklets-web-mock.js` on web.

**Why:** `react-native-worklets` 0.5.x calls `init()` at module-load time, which tries to boot a native Hermes/JSI worklet runtime. On web, this throws `WorkletsError: [Worklets] Failed to create a worklet` and crashes the entire app before any route renders. The crash appears ONLY when the full app is loaded (i.e. after Fix 1 is applied and all routes are bundled).

**How to apply:** Same `resolver.resolveRequest` — for `platform === "web"` also match `react-native-worklets` / `react-native-worklets-core` and return the no-op mock path. The mock must export the same shape as the real package (runOnUI, runOnJS, makeShareable, createWorkletRuntime, etc.) but as identity/noop functions.

## Other web notes

- `expo-symbols` and `expo-router/unstable-native-tabs` are iOS-only. **Never import them at the module top level.** Use `Platform.OS === "ios"` guards with `require()` inside the branch, NOT static `import` statements.
- React Compiler (`experiments.reactCompiler: true` in `app.json`) can cause silent route-render failures on web. Disable it until officially stable.
- `react-native-reanimated/plugin` must be in `babel.config.js` plugins for reanimated 4.x.
