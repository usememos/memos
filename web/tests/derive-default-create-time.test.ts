import { describe, expect, it } from "vitest";
import {
  deriveDefaultCreateTimeFromFilters,
  resolveDefaultTimestamps,
  withTimeOfDay,
} from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import type { MemoFilter } from "@/contexts/MemoFilterContext";

describe("deriveDefaultCreateTimeFromFilters", () => {
  const now = new Date(2026, 4, 2, 14, 32, 10); // 2026-05-02 14:32:10 local

  it("returns undefined when no filters are set", () => {
    expect(deriveDefaultCreateTimeFromFilters([], now)).toBeUndefined();
  });

  it("returns undefined when no displayTime filter is present", () => {
    const filters: MemoFilter[] = [
      { factor: "tagSearch", value: "work" },
      { factor: "pinned", value: "true" },
    ];
    expect(deriveDefaultCreateTimeFromFilters(filters, now)).toBeUndefined();
  });

  it("merges the displayTime date with the current local hh:mm:ss", () => {
    const filters: MemoFilter[] = [{ factor: "displayTime", value: "2025-05-01" }];
    const result = deriveDefaultCreateTimeFromFilters(filters, now);
    expect(result).toBeDefined();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(4); // May (0-indexed)
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(32);
    expect(result!.getSeconds()).toBe(10);
  });

  it("ignores extra non-displayTime filters", () => {
    const filters: MemoFilter[] = [
      { factor: "tagSearch", value: "work" },
      { factor: "displayTime", value: "2025-05-01" },
      { factor: "pinned", value: "true" },
    ];
    const result = deriveDefaultCreateTimeFromFilters(filters, now);
    expect(result?.getDate()).toBe(1);
  });

  it("returns undefined for a malformed YYYY-MM-DD value", () => {
    const cases: MemoFilter[][] = [
      [{ factor: "displayTime", value: "not-a-date" }],
      [{ factor: "displayTime", value: "2025-13-40" }],
      [{ factor: "displayTime", value: "" }],
      [{ factor: "displayTime", value: "2025-5-1" }], // single-digit month/day
    ];
    for (const filters of cases) {
      expect(deriveDefaultCreateTimeFromFilters(filters, now)).toBeUndefined();
    }
  });

  it("uses real `new Date()` when `now` is omitted", () => {
    const filters: MemoFilter[] = [{ factor: "displayTime", value: "2025-05-01" }];
    const before = new Date();
    const result = deriveDefaultCreateTimeFromFilters(filters);
    const after = new Date();
    expect(result).toBeDefined();
    // Date components must come from the filter, not from `now` — guards
    // against an impl that silently returns `new Date()` and ignores filters.
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(4); // May (0-indexed)
    expect(result!.getDate()).toBe(1);
    // Time-of-day should fall between before and after (within 1s tolerance).
    const resultTimeOnly = result!.getHours() * 3600 + result!.getMinutes() * 60 + result!.getSeconds();
    const beforeTimeOnly = before.getHours() * 3600 + before.getMinutes() * 60 + before.getSeconds();
    const afterTimeOnly = after.getHours() * 3600 + after.getMinutes() * 60 + after.getSeconds();
    // Handle midnight rollover by allowing any value if before > after.
    if (beforeTimeOnly <= afterTimeOnly) {
      expect(resultTimeOnly).toBeGreaterThanOrEqual(beforeTimeOnly);
      expect(resultTimeOnly).toBeLessThanOrEqual(afterTimeOnly);
    }
  });
});

describe("withTimeOfDay", () => {
  it("preserves the calendar day and applies now's wall-clock time", () => {
    const date = new Date(2025, 4, 1, 9, 0, 0);
    const now = new Date(2026, 4, 2, 14, 32, 10);
    const result = withTimeOfDay(date, now);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(32);
    expect(result.getSeconds()).toBe(10);
  });

  it("does not mutate the input date", () => {
    const date = new Date(2025, 4, 1, 9, 0, 0);
    const now = new Date(2026, 4, 2, 14, 32, 10);
    withTimeOfDay(date, now);
    expect(date.getHours()).toBe(9);
  });
});

describe("resolveDefaultTimestamps", () => {
  const defaultCreateTime = new Date(2025, 4, 1, 13, 17, 23);
  const later = new Date(2026, 4, 2, 14, 32, 10);

  it("restamps when createTime is still the seeded default reference", () => {
    const result = resolveDefaultTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }, defaultCreateTime, later);
    expect(result.createTime).not.toBe(defaultCreateTime);
    expect(result.createTime!.getFullYear()).toBe(2025);
    expect(result.createTime!.getMonth()).toBe(4);
    expect(result.createTime!.getDate()).toBe(1);
    expect(result.createTime!.getHours()).toBe(14);
    expect(result.createTime!.getMinutes()).toBe(32);
    expect(result.createTime!.getSeconds()).toBe(10);
    expect(result.updateTime).toBe(result.createTime);
  });

  it("restamps a prior shared restamp so consecutive saves get distinct times", () => {
    const firstSave = new Date(2026, 0, 1, 13, 17, 40);
    const restored = withTimeOfDay(defaultCreateTime, firstSave);
    const secondSave = new Date(2026, 0, 1, 13, 18, 10);
    const result = resolveDefaultTimestamps({ createTime: restored, updateTime: restored }, defaultCreateTime, secondSave);
    expect(result.createTime!.getHours()).toBe(13);
    expect(result.createTime!.getMinutes()).toBe(18);
    expect(result.createTime!.getSeconds()).toBe(10);
    expect(result.createTime!.getTime()).not.toBe(restored.getTime());
  });

  it("leaves manual TimestampPopover edits alone", () => {
    const editedCreate = new Date(2025, 4, 1, 10, 0, 0);
    const editedUpdate = new Date(2025, 4, 1, 11, 0, 0);
    const result = resolveDefaultTimestamps({ createTime: editedCreate, updateTime: editedUpdate }, defaultCreateTime, later);
    expect(result.createTime).toBe(editedCreate);
    expect(result.updateTime).toBe(editedUpdate);
  });

  it("returns timestamps unchanged when there is no default", () => {
    const createTime = new Date(2025, 4, 1, 10, 0, 0);
    const result = resolveDefaultTimestamps({ createTime, updateTime: createTime }, undefined, later);
    expect(result.createTime).toBe(createTime);
  });
});
