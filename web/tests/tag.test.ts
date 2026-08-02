import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { findTagMetadata, mergeTagCounts } from "@/lib/tag";
import {
  type UserSetting_TagMetadata,
  type UserSetting_TagsSetting,
  UserSetting_TagsSettingSchema,
  UserStatsSchema,
} from "@/types/proto/api/v1/user_service_pb";

describe("exact tag keys", () => {
  it("aggregates names that collide with Object prototype properties", () => {
    const source = Object.fromEntries([
      ["toString", 1],
      ["constructor", 2],
      ["__proto__", 3],
    ]);
    const counts = mergeTagCounts(source, { toString: 4 });

    expect(Object.getPrototypeOf(counts)).toBeNull();
    expect(counts.toString).toBe(5);
    expect(counts.constructor).toBe(2);
    expect(counts.__proto__).toBe(3);
  });

  it("preserves exact prototype-shaped tag keys through protobuf maps", () => {
    const source = Object.fromEntries([
      ["normal", 1],
      ["constructor", 2],
      ["__proto__", 3],
    ]);
    const encoded = toBinary(UserStatsSchema, create(UserStatsSchema, { tagCount: source }));
    const decoded = fromBinary(UserStatsSchema, encoded);
    const counts = mergeTagCounts(decoded.tagCount);

    expect(Object.keys(decoded.tagCount).sort()).toEqual(["__proto__", "constructor", "normal"]);
    expect(counts.normal).toBe(1);
    expect(counts.constructor).toBe(2);
    expect(counts.__proto__).toBe(3);
  });

  it("preserves exact prototype-shaped metadata keys when creating tag settings", () => {
    const source = Object.fromEntries([
      ["normal", { blurContent: false }],
      ["constructor", { blurContent: true }],
      ["__proto__", { blurContent: true }],
    ]);
    const created = create(UserSetting_TagsSettingSchema, { tags: source });
    const decoded = fromBinary(UserSetting_TagsSettingSchema, toBinary(UserSetting_TagsSettingSchema, created));

    expect(Object.keys(created.tags).sort()).toEqual(["__proto__", "constructor", "normal"]);
    expect(Object.keys(decoded.tags).sort()).toEqual(["__proto__", "constructor", "normal"]);
    expect(decoded.tags.normal.blurContent).toBe(false);
    expect(decoded.tags.constructor.blurContent).toBe(true);
    expect(decoded.tags.__proto__.blurContent).toBe(true);
  });

  it("does not treat inherited properties as exact metadata", () => {
    const metadata = { blurContent: true } as UserSetting_TagMetadata;
    const setting = { tags: { ".*": metadata } } as UserSetting_TagsSetting;

    expect(findTagMetadata("toString", setting)).toBe(metadata);
  });
});
