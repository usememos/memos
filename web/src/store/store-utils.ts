/**
 * Store utilities for MobX stores
 * Provides request deduplication, error handling, and other common patterns
 */

/**
 * Custom error class for store operations
 * Provides structured error information for better debugging and error handling
 */
export class StoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "StoreError";
  }

  /**
   * Check if an error is an AbortError from a cancelled request
   */
  static isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
  }

  /**
   * Wrap an unknown error in a StoreError for consistent error handling
   */
  static wrap(code: string, error: unknown, customMessage?: string): StoreError {
    if (error instanceof StoreError) {
      return error;
    }

    const message = customMessage || (error instanceof Error ? error.message : "Unknown error");
    return new StoreError(code, message, error);
  }
}

/**
 * Request deduplication manager
 * Prevents multiple identical requests from being made simultaneously
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Execute a request with deduplication
   * If the same request key is already pending, returns the existing promise
   *
   * @param key - Unique identifier for this request (e.g., JSON.stringify(params))
   * @param requestFn - Function that executes the actual request
   * @returns Promise that resolves with the request result
   */
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

  /**
   * Cancel all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Check if a request with the given key is pending
   */
  isPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  /**
   * Get the number of pending requests
   */
  get size(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Create a request key from parameters
 * Useful for generating consistent keys for request deduplication
 */
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

/**
 * Optimistic update helper
 * Handles optimistic updates with rollback on error
 */
export class OptimisticUpdate<T> {
  constructor(
    private getCurrentState: () => T,
    private setState: (state: T) => void,
  ) {}

  /**
   * Execute an update with optimistic UI updates
   *
   * @param optimisticState - State to apply immediately
   * @param updateFn - Async function that performs the actual update
   * @returns Promise that resolves with the update result
   */
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
