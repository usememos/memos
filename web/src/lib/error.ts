import { BinaryReader } from "@bufbuild/protobuf/wire";
import { type Code, ConnectError } from "@connectrpc/connect";
import { formatFileSize } from "@/utils/format";
import { translate } from "@/utils/i18n";

/** google.rpc.ErrorInfo, the mandatory detail on every server error (AIP-193). */
export interface ErrorInfo {
  reason: string;
  domain: string;
  metadata: Record<string, string>;
}

export const ERROR_REASON_RATE_LIMITED = "RATE_LIMITED";
export const ERROR_REASON_CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED";
export const ERROR_REASON_QUOTA_EXCEEDED = "QUOTA_EXCEEDED";

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

/**
 * Describes a QUOTA_EXCEEDED refusal in words, or returns undefined for any
 * other error. A usage limit does not lift with time, so unlike a rate limit
 * the message says what to change instead of when to retry.
 */
export function getQuotaExceededMessage(error: unknown): string | undefined {
  const info = getErrorInfo(error);
  if (info?.reason !== ERROR_REASON_QUOTA_EXCEEDED) {
    return undefined;
  }
  const limit = Number(info.metadata.limit ?? "");
  const usage = Number(info.metadata.usage ?? "");
  switch (info.metadata.metric) {
    case "MEMO_COUNT":
      return translate("error.quota-memo-count", { limit });
    case "STORAGE_BYTES":
      return translate("error.quota-storage", { limit: formatFileSize(limit), usage: formatFileSize(usage) });
    case "UPLOAD_BYTES":
      return translate("error.quota-upload", { limit: formatFileSize(limit) });
    case "MEMO_CONTENT_BYTES":
      return translate("error.quota-memo-content", { limit: formatFileSize(limit) });
    default:
      return translate("error.quota-generic");
  }
}

function formatWait(seconds: number): string {
  if (seconds < 60) return translate("error.wait-seconds", { count: seconds });
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60
    ? translate("error.wait-minutes", { count: minutes })
    : translate("error.wait-hours", { count: Math.ceil(minutes / 60) });
}

export function hasConnectCode(error: unknown, ...codes: Code[]): error is ConnectError {
  return error instanceof ConnectError && codes.includes(error.code);
}

export function getErrorMessage(error: unknown, fallback = translate("common.unknown-error")): string {
  if (error instanceof ConnectError) {
    const retryAfter = getRetryAfterSeconds(error);
    if (retryAfter !== undefined) {
      return translate("error.too-many-requests", { wait: formatWait(retryAfter) });
    }
    if (hasErrorReason(error, ERROR_REASON_CHALLENGE_REQUIRED)) {
      return translate("error.challenge-required");
    }
    const limitMessage = getQuotaExceededMessage(error);
    if (limitMessage !== undefined) {
      return limitMessage;
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
