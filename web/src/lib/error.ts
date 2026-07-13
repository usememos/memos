import { Code, ConnectError } from "@connectrpc/connect";

export function isInvalidUsernameError(error: unknown): boolean {
  return error instanceof ConnectError && error.code === Code.InvalidArgument && error.rawMessage.startsWith("invalid username:");
}

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return fallback;
}

export function handleError(
  error: unknown,
  toast: (message: string) => void,
  options?: {
    context?: string;
    fallbackMessage?: string;
    onError?: (error: unknown) => void;
  },
): void {
  const contextPrefix = options?.context ? `${options.context}: ` : "";
  const fallback = options?.fallbackMessage;

  const errorMessage = options?.context ? `${contextPrefix}${getErrorMessage(error, fallback)}` : getErrorMessage(error, fallback);

  console.error(error);
  toast(errorMessage);
  options?.onError?.(error);
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
