import { create } from "@bufbuild/protobuf";
import type { UsageLimitEntry } from "@/hooks/useUsageLimitQueries";
import { InstanceSetting_UsageLimitsSetting_UsageLimitSchema } from "@/types/proto/api/instance_service_pb";
import { formatFileSize } from "@/utils/format";

/** The metrics an entry can limit, in display order. */
export const USAGE_METRICS = ["memoCount", "memoContentBytes", "storageBytes", "uploadBytes"] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export function newUsageLimitEntry(
  init: { users?: string[]; allUsers?: boolean } & Partial<Record<UsageMetric, bigint | undefined>>,
): UsageLimitEntry {
  return create(InstanceSetting_UsageLimitsSetting_UsageLimitSchema, init);
}

const MIB = 1024 * 1024;
const inputUnit = (metric: UsageMetric) => (metric === "memoContentBytes" ? 1024 : MIB);

/** Whether the metric counts bytes. Forms enter content limits in KiB and other byte limits in MiB. */
export const isByteMetric = (metric: UsageMetric) => metric !== "memoCount";

/** Whether the value restricts anything. Unset and 0 both mean unlimited. */
export const isLimited = (value: bigint | undefined): value is bigint => value !== undefined && value > 0n;

/**
 * Formats a limit for a form field: memos as a count, content in KiB, other
 * bytes in MiB. Unlimited is empty. Byte sizes are shown with at most two
 * decimals, so the text is not always exact; a form keeps the stored value for
 * a field the admin did not touch.
 */
export function toLimitInput(metric: UsageMetric, value: bigint | undefined): string {
  if (!isLimited(value)) return "";
  if (!isByteMetric(metric)) return value.toString();
  const size = Number(value) / inputUnit(metric);
  if (Number.isInteger(size)) return String(size);
  const rounded = Number(size.toFixed(2));
  // A limit too small to show in two decimals must not display as 0, which
  // would read as unlimited; show it in full, as plain decimals.
  return rounded > 0 ? String(rounded) : size.toFixed(20).replace(/0+$/, "");
}

/**
 * Parses a form field into a limit value. An empty field, or 0, is unlimited
 * and stored as unset. Returns null when the input is not a valid limit.
 */
export function parseLimitInput(metric: UsageMetric, input: string): bigint | undefined | null {
  const text = input.trim();
  if (text === "") return undefined;
  let value: bigint;
  if (!isByteMetric(metric)) {
    if (!/^\d+$/.test(text)) return null;
    value = BigInt(text);
  } else {
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    const bytes = Math.round(Number(text) * inputUnit(metric));
    if (!Number.isSafeInteger(bytes)) return null;
    value = BigInt(bytes);
  }
  return value === 0n ? undefined : value;
}

/** Formats a limit or a usage figure for display. */
export function formatLimitValue(metric: UsageMetric, value: bigint): string {
  return isByteMetric(metric) ? formatFileSize(Number(value)) : value.toLocaleString();
}
