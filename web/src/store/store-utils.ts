// Store utilities for MobX stores
// Provides request deduplication, error handling, and other common patterns

export class StoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "StoreError";
  }

  static isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
  }

  static wrap(code: string, error: unknown, customMessage?: string): StoreError {
    if (error instanceof StoreError) {
      return error;
    }

    const message = customMessage || (error instanceof Error ? error.message : "Unknown error");
    return new StoreError(code, message, error);
  }
}

// Request deduplication manager - prevents multiple identical requests
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async execute<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if this request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Create new request
    const promise = requestFn().finally(() => {
      // Clean up after request completes (success or failure)
      this.pendingRequests.delete(key);
    });

    // Store the pending request
    this.pendingRequests.set(key, promise);

    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }

  isPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  get size(): number {
    return this.pendingRequests.size;
  }
}

export function createRequestKey(prefix: string, params?: Record<string, any>): string {
  if (!params) {
    return prefix;
  }

  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, any>,
    );

  return `${prefix}:${JSON.stringify(sortedParams)}`;
}

// Optimistic update helper with rollback on error
export class OptimisticUpdate<T> {
  constructor(
    private getCurrentState: () => T,
    private setState: (state: T) => void,
  ) {}

  async execute<R>(optimisticState: T, updateFn: () => Promise<R>): Promise<R> {
    const previousState = this.getCurrentState();

    try {
      // Apply optimistic update immediately
      this.setState(optimisticState);

      // Perform actual update
      const result = await updateFn();

      return result;
    } catch (error) {
      // Rollback on error
      this.setState(previousState);
      throw error;
    }
  }
}
