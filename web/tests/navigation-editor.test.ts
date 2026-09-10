import { describe, expect, it } from "vitest";
import {
  addCard,
  addGroup,
  createCard,
  removeCard,
  removeGroup,
  renameGroup,
  updateCard,
  validateCardDraft,
} from "@/modules/navigation/editor";
import { createSeedConfig, type NavConfig } from "@/modules/navigation/types";

const seed = (): NavConfig => createSeedConfig();

describe("validateCardDraft", () => {
  it("requires a title and a valid http(s) URL", () => {
    const config = seed();
    expect(validateCardDraft({ title: "", url: "https://example.com" }, config)).toBe("titleRequired");
    expect(validateCardDraft({ title: "A", url: "ftp://example.com" }, config)).toBe("urlInvalid");
    expect(validateCardDraft({ title: "A", url: "https://example.com" }, config)).toBeNull();
  });

  it("rejects a duplicate URL but allows editing the same card", () => {
    const config = seed();
    const existing = config.groups[0].items[0];
    expect(validateCardDraft({ title: "Other", url: existing.url }, config)).toBe("urlDuplicate");
    expect(validateCardDraft({ title: "Renamed", url: existing.url }, config, existing.id)).toBeNull();
  });
});

describe("card helpers", () => {
  it("adds a card to the target group and leaves other groups untouched", () => {
    const config = seed();
    const card = createCard({ title: "Example", url: "https://example.com", note: "hi" });
    const next = addCard(config, "g-dev", card);

    expect(next.groups.find((g) => g.id === "g-dev")?.items.some((c) => c.id === card.id)).toBe(true);
    expect(next.groups.find((g) => g.id === "g-common")?.items).toHaveLength(2);
    expect(next.groups.find((g) => g.id === "g-dev")?.items).toHaveLength(2);
  });

  it("returns the original config when the target group is missing", () => {
    const config = seed();
    const card = createCard({ title: "Example", url: "https://example.com" });
    expect(addCard(config, "nope", card)).toBe(config);
  });

  it("updates a card only when something actually changed", () => {
    const config = seed();
    const card = config.groups[0].items[0];
    const same = updateCard(config, card.id, { title: card.title, url: card.url });
    expect(same).toBe(config);

    const next = updateCard(config, card.id, { title: "Renamed", url: card.url, note: "note" });
    const updated = next.groups[0].items.find((c) => c.id === card.id);
    expect(updated?.title).toBe("Renamed");
    expect(updated?.note).toBe("note");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(card.updatedAt);

    const cleared = updateCard(next, card.id, { title: "Renamed", url: card.url, note: "  " });
    expect(cleared.groups[0].items.find((c) => c.id === card.id)?.note).toBeUndefined();
  });

  it("removes a card and writes a tombstone", () => {
    const config = seed();
    const card = config.groups[0].items[0];
    const next = removeCard(config, card.id, 123);

    expect(next.groups[0].items.some((c) => c.id === card.id)).toBe(false);
    expect(next.tombstones).toContainEqual({ id: card.id, deletedAt: 123 });
    expect(removeCard(config, "missing")).toBe(config);
  });
});

describe("group helpers", () => {
  it("appends a new group", () => {
    const config = seed();
    const next = addGroup(config, "  新分组  ");
    const last = next.groups[next.groups.length - 1];
    expect(last.name).toBe("新分组");
    expect(last.items).toEqual([]);
    expect(addGroup(config, "   ")).toBe(config);
  });

  it("renames a group only when the name changes", () => {
    const config = seed();
    expect(renameGroup(config, "g-common", "常用")).toBe(config);
    const next = renameGroup(config, "g-common", "Favorites");
    expect(next.groups[0].name).toBe("Favorites");
  });

  it("removes a group and tombstones its cards", () => {
    const config = seed();
    const group = config.groups[0];
    const next = removeGroup(config, group.id, 99);

    expect(next.groups.some((g) => g.id === group.id)).toBe(false);
    expect(next.tombstones).toEqual(group.items.map((card) => ({ id: card.id, deletedAt: 99 })));
    expect(removeGroup(config, "missing")).toBe(config);
  });
});
