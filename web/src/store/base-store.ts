/**
 * Base store classes and utilities for consistent store patterns
 *
 * This module provides:
 * - BaseServerStore: For stores that fetch data from APIs
 * - BaseClientStore: For stores that manage UI/client state
 * - Common patterns for all stores
 */
import { makeObservable, action } from "mobx";
import { RequestDeduplicator, StoreError } from "./store-utils";

/**
 * Base interface for all store states
 * Ensures all stores have a consistent setPartial method
 */
export interface BaseState {
  setPartial(partial: Partial<this>): void;
}

/**
 * Base class for server state stores (data fetching)
 *
 * Server stores:
 * - Fetch data from APIs
 * - Cache responses in memory
 * - Handle errors with StoreError
 * - Support request deduplication
 *
 * @example
 * class MemoState implements BaseState {
 *   memoMapByName: Record<string, Memo> = {};
 *   constructor() { makeAutoObservable(this); }
 *   setPartial(partial: Partial<this>) { Object.assign(this, partial); }
 * }
 *
 * const store = createServerStore(new MemoState());
 */
export interface ServerStoreConfig {
  /**
   * Enable request deduplication
   * Prevents multiple identical requests from running simultaneously
   */
  enableDeduplication?: boolean;

  /**
   * Store name for debugging and error messages
   */
  name: string;
}

/**
 * Create a server store with built-in utilities
 */
export function createServerStore<TState extends BaseState>(state: TState, config: ServerStoreConfig) {
  const deduplicator = config.enableDeduplication !== false ? new RequestDeduplicator() : null;

  return {
    state,
    deduplicator,
    name: config.name,

    /**
     * Wrap an async operation with error handling and optional deduplication
     */
    async executeRequest<T>(key: string, operation: () => Promise<T>, errorCode?: string): Promise<T> {
      try {
        if (deduplicator && key) {
          return await deduplicator.execute(key, operation);
        }
        return await operation();
      } catch (error) {
        if (StoreError.isAbortError(error)) {
          throw error; // Re-throw abort errors as-is
        }
        throw StoreError.wrap(errorCode || `${config.name.toUpperCase()}_OPERATION_FAILED`, error);
      }
    },
  };
}

/**
 * Base class for client state stores (UI state)
 *
 * Client stores:
 * - Manage UI preferences and transient state
 * - May persist to localStorage or URL
 * - No API calls
 * - Instant updates
 *
 * @example
 * class ViewState implements BaseState {
 *   orderByTimeAsc = false;
 *   layout: "LIST" | "MASONRY" = "LIST";
 *   constructor() { makeAutoObservable(this); }
 *   setPartial(partial: Partial<this>) {
 *     Object.assign(this, partial);
 *     localStorage.setItem("view", JSON.stringify(this));
 *   }
 * }
 */
export interface ClientStoreConfig {
  /**
   * Store name for debugging
   */
  name: string;

  /**
   * Enable localStorage persistence
   */
  persistence?: {
    key: string;
    serialize?: (state: any) => string;
    deserialize?: (data: string) => any;
  };
}

/**
 * Create a client store with optional persistence
 */
export function createClientStore<TState extends BaseState>(state: TState, config: ClientStoreConfig) {
  // Load from localStorage if enabled
  if (config.persistence) {
    try {
      const cached = localStorage.getItem(config.persistence.key);
      if (cached) {
        const data = config.persistence.deserialize ? config.persistence.deserialize(cached) : JSON.parse(cached);
        Object.assign(state, data);
      }
    } catch (error) {
      console.warn(`Failed to load ${config.name} from localStorage:`, error);
    }
  }

  return {
    state,
    name: config.name,

    /**
     * Save state to localStorage if persistence is enabled
     */
    persist(): void {
      if (config.persistence) {
        try {
          const data = config.persistence.serialize ? config.persistence.serialize(state) : JSON.stringify(state);
          localStorage.setItem(config.persistence.key, data);
        } catch (error) {
          console.warn(`Failed to persist ${config.name}:`, error);
        }
      }
    },

    /**
     * Clear persisted state
     */
    clearPersistence(): void {
      if (config.persistence) {
        localStorage.removeItem(config.persistence.key);
      }
    },
  };
}

/**
 * Standard state class implementation
 * Use this as a base for your state classes
 */
export abstract class StandardState implements BaseState {
  constructor() {
    makeObservable(this, {
      setPartial: action,
    });
  }

  setPartial(partial: Partial<this>): void {
    Object.assign(this, partial);
  }
}
