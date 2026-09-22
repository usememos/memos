import { describe, expect, it } from "vitest";
import { getReleaseTag } from "@/lib/release-version";

describe("release version links", () => {
  it.each(["26.09", "26.09.1", "26.09.10", "26.09-rc.1", "26.09.1-rc.2", "27.01", "0.31.0", "0.31.0-rc.2"])("links release %s", (version) =>
    expect(getReleaseTag(version)).toBe(version.startsWith("0.") ? `v${version}` : version));

  it.each([
    "dev",
    "manual-abcdef0",
    "v26.09",
    "26.9",
    "26.00",
    "26.13",
    "26.09.0",
    "26.09.01",
    "26.09-rc.0",
    "26.09extra",
    "0.31.0oops",
  ])("does not link non-release %s", (version) => expect(getReleaseTag(version)).toBeUndefined());
});
