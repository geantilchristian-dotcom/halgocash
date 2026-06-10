"use strict";
// Web no-op mock for react-native-worklets
// Prevents the native JSI/Hermes worklet runtime from initialising on web

const noop = () => {};
const identity = (fn) => fn;
const makeShareable = (val) => val;

module.exports = {
  // Deprecated helpers
  isShareableRef: () => false,
  makeShareable,
  makeShareableCloneOnUIRecursive: makeShareable,
  makeShareableCloneRecursive: makeShareable,
  shareableMappingCache: { has: () => false, set: noop, get: () => undefined },

  // Feature flags
  getStaticFeatureFlag: () => false,
  setDynamicFeatureFlag: noop,

  // Synchronizable
  isSynchronizable: () => false,

  // Runtime kind
  getRuntimeKind: () => "JS",
  RuntimeKind: { JS: "JS", Worklet: "Worklet" },

  // Runtimes
  createWorkletRuntime: () => null,
  runOnRuntime: (_runtime, fn) => fn,

  // Serializable
  createSerializable: (val) => val,
  isSerializableRef: () => false,
  serializableMappingCache: { has: () => false, set: noop, get: () => undefined },

  // Synchronizable
  createSynchronizable: (val) => val,

  // Threads — on web everything runs on JS thread
  callMicrotasks: noop,
  executeOnUIRuntimeSync: (_fn, ...args) => args[0],
  runOnJS: identity,
  runOnUI: identity,
  runOnUIAsync: identity,
  runOnUISync: identity,
  scheduleOnRN: (fn) => setTimeout(fn, 0),
  scheduleOnUI: (fn) => setTimeout(fn, 0),
  unstable_eventLoopTask: identity,

  // Worklet function
  isWorkletFunction: () => false,

  // WorkletsModule stub
  WorkletsModule: {
    createWorkletRuntime: () => null,
    scheduleOnRuntime: noop,
  },
};
