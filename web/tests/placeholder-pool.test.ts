import { describe, expect, it } from "vitest";
import { ASCII_POOL, pickPiece, type PlaceholderVariant } from "@/components/Placeholder/ascii-pool";
import { DEFAULT_MESSAGES } from "@/components/Placeholder/messages";

const VARIANTS: PlaceholderVariant[] = ["empty", "loading", "noResults", "notFound"];

describe("ASCII_POOL integrity", () => {
  it("contains at least one piece per variant", () => {
    for (const variant of VARIANTS) {
      const matches = ASCII_POOL.filter((p) => p.variant === variant);
      expect(matches.length, `variant=${variant}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses unique ids", () => {
    const ids = ASCII_POOL.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves the jgs credit on every piece", () => {
    for (const piece of ASCII_POOL) {
      expect(piece.credit, `piece=${piece.id}`).toMatch(/jgs/);
    }
  });

  it("uses a known motion style on every piece", () => {
    for (const piece of ASCII_POOL) {
      expect(["bob", "flutter", "none"]).toContain(piece.motion);
    }
  });
});

describe("pickPiece", () => {
  it("returns a piece matching the requested variant", () => {
    for (const variant of VARIANTS) {
      const piece = pickPiece(variant);
      expect(piece.variant).toBe(variant);
    }
  });

  it("returns a non-empty ascii string", () => {
    const piece = pickPiece("empty");
    expect(piece.ascii.length).toBeGreaterThan(0);
  });
});

describe("DEFAULT_MESSAGES", () => {
  it("provides a non-empty message for every variant", () => {
    for (const variant of VARIANTS) {
      expect(DEFAULT_MESSAGES[variant], `variant=${variant}`).toBeTruthy();
      expect(DEFAULT_MESSAGES[variant].trim().length).toBeGreaterThan(0);
    }
  });
});
