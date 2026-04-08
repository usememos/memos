import { Code, ConnectError } from "@connectrpc/connect";

const AUTH_INIT_MAX_RETRIES = 3;
const AUTH_INIT_INITIAL_DELAY_MS = 500;

function shouldRetryAuthInitialization(error: unknown): boolean {
  return !(error instanceof ConnectError && error.code === Code.Unauthenticated);
}

const defaultSleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
};

interface RetryAuthInitializationOptions<T> {
  operation: () => Promise<T>;
  sleep?: (delayMs: number) => Promise<void>;
}

export async function retryAuthInitialization<T>({ operation, sleep = defaultSleep }: RetryAuthInitializationOptions<T>): Promise<T> {
  let delayMs = AUTH_INIT_INITIAL_DELAY_MS;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!shouldRetryAuthInitialization(error)) {
        throw error;
      }
      if (attempt >= AUTH_INIT_MAX_RETRIES) {
        throw error;
      }
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}
