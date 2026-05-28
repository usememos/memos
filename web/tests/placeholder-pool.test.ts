import { describe, expect, it } from "vitest";
import { TILE_SPRITES, pickTileSprite } from "@/components/Placeholder/tileSprites";
import { DEFAULT_MESSAGES, type PlaceholderVariant } from "@/components/Placeholder/messages";

describe("TILE_SPRITES integrity", () => {
  it("registers 32px by 32px sprite strips with animation-specific frame counts", () => {
    expect(TILE_SPRITES.map((sprite) => sprite.name)).toEqual(["OwlBlink", "EagleIdle", "ToucanIdle"]);
    expect(TILE_SPRITES.map((sprite) => [sprite.name, sprite.frames])).toEqual([
      ["OwlBlink", 5],
      ["EagleIdle", 4],
      ["ToucanIdle", 4],
    ]);

    for (const sprite of TILE_SPRITES) {
      expect(sprite.name).toMatch(/^[A-Z][A-Za-z]+(Idle|Hop|Blink|Drift|Flutter|Hover|Peck)$/);
      expect(sprite.frameWidth).toBe(32);
      expect(sprite.frameHeight).toBe(32);
      expect(sprite.frames).toBeGreaterThanOrEqual(2);
      expect(sprite.src).toMatch(/(\.svg|data:image\/svg\+xml)/);
    }
  });

  it("returns a registered tile sprite from the pool", () => {
    const sprite = pickTileSprite();
    expect(TILE_SPRITES).toContain(sprite);
  });
});

describe("DEFAULT_MESSAGES", () => {
  it("provides a non-empty message for every variant", () => {
    for (const variant of Object.keys(DEFAULT_MESSAGES) as PlaceholderVariant[]) {
      expect(DEFAULT_MESSAGES[variant], `variant=${variant}`).toBeTruthy();
      expect(DEFAULT_MESSAGES[variant].trim().length).toBeGreaterThan(0);
    }
  });
});
