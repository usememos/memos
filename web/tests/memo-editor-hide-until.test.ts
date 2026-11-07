import { describe, expect, it } from "vitest";
import {
  isHiddenUntilFuture,
  isSameHideUntil,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from "@/components/MemoEditor/utils/hideUntil";

const hideUntil = new Date(2026, 11, 1, 9, 30);

describe("hide until helpers", () => {
  it("converts to and from the datetime-local input value", () => {
    expect(toDateTimeLocalValue(hideUntil)).toBe("2026-12-01T09:30");
    expect(parseDateTimeLocalValue("2026-12-01T09:30")).toEqual(hideUntil);
  });

  it("rejects empty and impossible dates", () => {
    expect(parseDateTimeLocalValue("")).toBeUndefined();
    expect(parseDateTimeLocalValue("2026-02-30T10:00")).toBeUndefined();
  });

  it("is hidden only while the date is in the future", () => {
    const now = new Date(2026, 10, 7, 12, 0);
    expect(isHiddenUntilFuture(hideUntil, now)).toBe(true);
    expect(isHiddenUntilFuture(new Date(2026, 10, 1), now)).toBe(false);
    expect(isHiddenUntilFuture(undefined, now)).toBe(false);
  });

  it("compares dates by value", () => {
    expect(isSameHideUntil(new Date(hideUntil), new Date(hideUntil))).toBe(true);
    expect(isSameHideUntil(hideUntil, undefined)).toBe(false);
    expect(isSameHideUntil(undefined, undefined)).toBe(true);
  });
});
