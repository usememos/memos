import { describe, expect, it } from "vitest";
import { formatFileSize } from "@/utils/format";

describe("formatFileSize", () => {
  it("formats sizes in the largest unit that keeps the number under 1024", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1048524)).toBe("1023.9 KB");
  });

  it("moves to the next unit when rounding would show 1024", () => {
    expect(formatFileSize(1048575)).toBe("1.0 MB");
    expect(formatFileSize(1073741823)).toBe("1.0 GB");
    expect(formatFileSize(1024 ** 4 - 1)).toBe("1.0 TB");
  });

  it("has a unit for sizes of a petabyte and more", () => {
    expect(formatFileSize(1024 ** 5)).toBe("1.0 PB");
    expect(formatFileSize(3 * 1024 ** 6)).toBe("3072.0 PB");
  });
});
