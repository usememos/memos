import { BinaryReader } from "@bufbuild/protobuf/wire";
import { type Code, ConnectError } from "@connectrpc/connect";

/** google.rpc.ErrorInfo, the mandatory detail on every server error (AIP-193). */
export interface ErrorInfo {
  reason: string;
  domain: string;
  metadata: Record<string, string>;
}

export const ERROR_REASON_RATE_LIMITED = "RATE_LIMITED";
export const ERROR_REASON_CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED";

const ERROR_INFO_TYPE = "google.rpc.ErrorInfo";

// The api protos never reference google.rpc, so its TypeScript schema is not
// generated; ErrorInfo is three fields, decoded here by hand.
function decodeErrorInfo(bytes: Uint8Array): ErrorInfo {
  const info: ErrorInfo = { reason: "", domain: "", metadata: {} };
  const reader = new BinaryReader(bytes);
  while (reader.pos < reader.len) {
    const [field, wireType] = reader.tag();
    switch (field) {
      case 1:
        info.reason = reader.string();
        break;
      case 2:
        info.domain = reader.string();
        break;
      case 3: {
        const entry = new BinaryReader(reader.bytes());
        let key = "";
        let value = "";
        while (entry.pos < entry.len) {
          const [entryField, entryWireType] = entry.tag();
          if (entryField === 1) key = entry.string();
          else if (entryField === 2) value = entry.string();
          else entry.skip(entryWireType, entryField);
        }
        info.metadata[key] = value;
        break;
      }
      default:
        reader.skip(wireType, field);
    }
  }
  return info;
}

/** Returns the ErrorInfo detail carried by a Connect error, if any. */
export function getErrorInfo(error: unknown): ErrorInfo | undefined {
  if (!(error instanceof ConnectError)) {
    return undefined;
  }
  for (const detail of error.details) {
    if ("type" in detail && detail.type === ERROR_INFO_TYPE && "value" in detail && detail.value instanceof Uint8Array) {
      try {
        return decodeErrorInfo(detail.value);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function hasErrorReason(error: unknown, reason: string): boolean {
  return getErrorInfo(error)?.reason === reason;
}

/** Seconds to wait before retrying a rate-limited request, or undefined. */
export function getRetryAfterSeconds(error: unknown): number | undefined {
  const info = getErrorInfo(error);
  if (info?.reason !== ERROR_REASON_RATE_LIMITED) {
    return undefined;
  }
  const seconds = Number.parseInt(info.metadata.retry_after_seconds ?? "", 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`;
}

export function hasConnectCode(error: unknown, ...codes: Code[]): error is ConnectError {
  return error instanceof ConnectError && codes.includes(error.code);
}

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof ConnectError) {
    const retryAfter = getRetryAfterSeconds(error);
    if (retryAfter !== undefined) {
      return `Too many requests. Try again in ${formatWait(retryAfter)}.`;
    }
    if (hasErrorReason(error, ERROR_REASON_CHALLENGE_REQUIRED)) {
      return "Complete the verification challenge and try again.";
    }
    return error.rawMessage || fallback;
  }

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
