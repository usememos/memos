// Base store classes and utilities for consistent store patterns
// - BaseServerStore: For stores that fetch data from APIs
// - BaseClientStore: For stores that manage UI/client state
import { action, makeObservable } from "mobx";
import { RequestDeduplicator, StoreError } from "./store-utils";

export interface BaseState {
  setPartial(partial: Partial<this>): void;
}

export interface ServerStoreConfig {
  enableDeduplication?: boolean;
  name: string;
}

export function createServerStore<TState extends BaseState>(state: TState, config: ServerStoreConfig) {
  const deduplicator = config.enableDeduplication !== false ? new RequestDeduplicator() : null;

  return {
    state,
    deduplicator,
    name: config.name,

    async executeRequest<T>(key: string, operation: () => Promise<T>, errorCode?: string): Promise<T> {
      try {
        if (deduplicator && key) {
          return await deduplicator.execute(key, operation);
        }
        return await operation();
      } catch (error) {
        if (StoreError.isAbortError(error)) {
          throw error;
        }
        throw StoreError.wrap(errorCode || `${config.name.toUpperCase()}_OPERATION_FAILED`, error);
      }
    },
  };
}

export interface ClientStoreConfig {
  name: string;
  persistence?: {
    key: string;
    serialize?: (state: any) => string;
    deserialize?: (data: string) => any;
  };
}

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

    clearPersistence(): void {
      if (config.persistence) {
        localStorage.removeItem(config.persistence.key);
      }
    },
  };
}

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
