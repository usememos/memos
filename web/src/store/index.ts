/**
 * Store Module
 *
 * This module exports all application stores and their types.
 *
 * ## Store Architecture
 *
 * Stores are divided into two categories:
 *
 * ### Server State Stores (Data Fetching)
 * These stores fetch and cache data from the backend API:
 * - **memoStore**: Memo CRUD operations
 * - **userStore**: User authentication and settings
 * - **instanceStore**: Instance configuration
 * - **attachmentStore**: File attachment management
 *
 * Features:
 * - Request deduplication
 * - Error handling with StoreError
 * - Optimistic updates (memo updates)
 * - Computed property memoization
 *
 * ### Client State Stores (UI State)
 * These stores manage UI preferences and transient state:
 * - **viewStore**: Display preferences (sort order, layout)
 * - **memoFilterStore**: Active search filters
 *
 * Features:
 * - localStorage persistence (viewStore)
 * - URL synchronization (memoFilterStore)
 * - No API calls
 *
 * ## Usage
 *
 * ```typescript
 * import { memoStore, userStore, viewStore } from "@/store";
 * import { observer } from "mobx-react-lite";
 *
 * const MyComponent = observer(() => {
 *   const memos = memoStore.state.memos;
 *   const user = userStore.state.currentUser;
 *
 *   return <div>...</div>;
 * });
 * ```
 */
// Server State Stores
import attachmentStore from "./attachment";
import instanceStore from "./instance";
import memoStore from "./memo";
// Client State Stores
import memoFilterStore from "./memoFilter";
import userStore from "./user";
import viewStore from "./view";

export type { BaseState, ClientStoreConfig, ServerStoreConfig } from "./base-store";
export { createClientStore, createServerStore, StandardState } from "./base-store";
// Re-export common utilities
export {
  activityNamePrefix,
  extractIdentityProviderIdFromName,
  extractMemoIdFromName,
  extractUserIdFromName,
  identityProviderNamePrefix,
  instanceSettingNamePrefix,
  memoNamePrefix,
  userNamePrefix,
} from "./common";
// Re-export instance types
export type { Theme } from "./instance";
export { isValidTheme } from "./instance";
// Re-export filter types
export type { FilterFactor, MemoFilter } from "./memoFilter";
export { getMemoFilterKey, parseFilterQuery, stringifyFilters } from "./memoFilter";
// Utilities and Types
export { createRequestKey, RequestDeduplicator, StoreError } from "./store-utils";
// Re-export view types
export type { LayoutMode } from "./view";

// Export store instances
export {
  // Server state stores
  memoStore,
  userStore,
  instanceStore,
  attachmentStore,
  // Client state stores
  memoFilterStore,
  viewStore,
};

/**
 * All stores grouped by category for convenience
 */
export const stores = {
  // Server state
  server: {
    memo: memoStore,
    user: userStore,
    instance: instanceStore,
    attachment: attachmentStore,
  },

  // Client state
  client: {
    memoFilter: memoFilterStore,
    view: viewStore,
  },
} as const;
