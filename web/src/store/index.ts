// Store Module - exports all application stores and their types
// Server State Stores (fetch/cache backend data): memoStore, userStore, instanceStore, attachmentStore
// Client State Stores (UI preferences): viewStore, memoFilterStore
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
