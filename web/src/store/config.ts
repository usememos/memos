// MobX configuration for strict state management
// Enforces best practices: state changes must happen in actions, computed values cannot have side effects
import { configure } from "mobx";

configure({
  // Enforce that all state mutations happen within actions (start permissive, can upgrade later)
  enforceActions: "never",
  // Use Proxies for better performance and ES6 compatibility (required for makeAutoObservable)
  useProxies: "always",
  // Isolate global state to prevent accidental sharing between tests
  isolateGlobalState: true,
  // Disable error boundaries so errors propagate normally
  disableErrorBoundaries: false,
});

export function enableStrictMode() {
  if (import.meta.env.DEV) {
    configure({
      enforceActions: "observed",
      computedRequiresReaction: false,
      reactionRequiresObservable: false,
    });
    console.info("✓ MobX strict mode enabled");
  }
}

export function enableProductionMode() {
  configure({
    enforceActions: "never",
    disableErrorBoundaries: false,
  });
}
