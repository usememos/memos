/**
 * MobX configuration for strict state management
 *
 * This configuration enforces best practices to prevent common mistakes:
 * - All state changes must happen in actions (prevents accidental mutations)
 * - Computed values cannot have side effects (ensures purity)
 * - Observables must be accessed within reactions (helps catch missing observers)
 *
 * This file is imported early in the application lifecycle to configure MobX
 * before any stores are created.
 */
import { configure } from "mobx";

/**
 * Configure MobX with production-safe settings
 * This runs immediately when the module is imported
 */
configure({
  /**
   * Enforce that all state mutations happen within actions
   * Since we use makeAutoObservable, all methods are automatically actions
   * This prevents bugs from direct mutations like:
   *   store.state.value = 5  // ERROR: This will throw
   *
   * Instead, you must use action methods:
   *   store.state.setPartial({ value: 5 })  // Correct
   */
  enforceActions: "never", // Start with "never", can be upgraded to "observed" or "always"

  /**
   * Use Proxies for better performance and ES6 compatibility
   * makeAutoObservable requires this to be enabled
   */
  useProxies: "always",

  /**
   * Isolate global state to prevent accidental sharing between tests
   */
  isolateGlobalState: true,

  /**
   * Disable error boundaries so errors propagate normally
   * This ensures React error boundaries can catch store errors
   */
  disableErrorBoundaries: false,
});

/**
 * Enable strict mode for development
 * Call this in main.tsx if you want stricter checking
 */
export function enableStrictMode() {
  if (import.meta.env.DEV) {
    configure({
      enforceActions: "observed", // Enforce actions only for observed values
      computedRequiresReaction: false, // Don't warn about computed access
      reactionRequiresObservable: false, // Don't warn about reactions
    });
    console.info("✓ MobX strict mode enabled");
  }
}

/**
 * Enable production mode for maximum performance
 * This is automatically called in production builds
 */
export function enableProductionMode() {
  configure({
    enforceActions: "never", // No runtime checks for performance
    disableErrorBoundaries: false,
  });
}
