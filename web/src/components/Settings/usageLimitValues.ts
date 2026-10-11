import { UsageLimit_Metric } from "@/types/proto/api/instance_service_pb";
import { formatFileSize } from "@/utils/format";

const MIB = 1024 * 1024;

/** Whether the metric counts bytes. Forms enter byte limits in MiB. */
export const isByteMetric = (metric: UsageLimit_Metric) => metric !== UsageLimit_Metric.MEMOS;

/** Formats a limit for a form field: memos as a count, bytes in MiB. Unlimited is empty. */
export function toLimitInput(metric: UsageLimit_Metric, value: bigint | undefined): string {
  if (value === undefined || value === 0n) return "";
  if (!isByteMetric(metric)) return value.toString();
  const mebibytes = Number(value) / MIB;
  return Number.isInteger(mebibytes) ? String(mebibytes) : String(Number(mebibytes.toFixed(2)));
}

/**
 * Parses a form field into a limit value. An empty field is 0, which means
 * unlimited. Returns undefined when the input is not a valid limit.
 */
export function parseLimitInput(metric: UsageLimit_Metric, input: string): bigint | undefined {
  const text = input.trim();
  if (text === "") return 0n;
  if (!isByteMetric(metric)) {
    return /^\d+$/.test(text) ? BigInt(text) : undefined;
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
  return BigInt(Math.round(Number(text) * MIB));
}

/** Formats a limit or a usage figure for display. */
export function formatLimitValue(metric: UsageLimit_Metric, value: bigint): string {
  return isByteMetric(metric) ? formatFileSize(Number(value)) : value.toLocaleString();
}
