import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { locationKey, mapMemos, readViewport, revealOffset, splitLabel, validLocation } from "@/components/MapView/model";
import { LocationSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const memo = (name: string, latitude = 0, longitude = 0) => create(MemoSchema, { name, location: { latitude, longitude } });

describe("map model", () => {
  it("keeps all pages, deduplicates resources and takes their latest location", () => {
    const pages = Array.from({ length: 3 }, (_, page) => ({
      memos: Array.from({ length: 500 }, (_, index) => memo(`memos/${page * 500 + index}`)),
    }));
    pages.push({ memos: [memo("memos/1", 35, 135)] });
    const result = mapMemos(pages, "create_time");
    expect(result).toHaveLength(1500);
    expect(result.find((item) => item.name === "memos/1")?.location?.latitude).toBe(35);
  });
  it("accepts zero coordinates and rejects invalid positions", () => {
    expect(validLocation(create(LocationSchema))).toBe(true);
    for (const [latitude, longitude] of [
      [NaN, 0],
      [0, Infinity],
      [91, 0],
      [0, -181],
    ]) {
      expect(validLocation(create(LocationSchema, { latitude, longitude }))).toBe(false);
    }
    expect(
      mapMemos([{ memos: [memo("valid"), memo("invalid", 95), create(MemoSchema, { name: "missing" })] }], "create_time").map(
        (item) => item.name,
      ),
    ).toEqual(["valid"]);
  });
  it("does not merge different coordinates based on their labels", () => {
    const a = create(LocationSchema, { placeholder: "Cafe", latitude: 1, longitude: 2 });
    const b = create(LocationSchema, { placeholder: "Cafe", latitude: 1, longitude: 3 });
    expect(locationKey(a)).not.toBe(locationKey(b));
  });
  it("validates a restorable viewport", () => {
    expect(readViewport("?lat=0&lng=0&zoom=0")).toEqual({ lat: 0, lng: 0, zoom: 0 });
    for (const search of ["", "?lat=&lng=0&zoom=1", "?lat=91&lng=0&zoom=3", "?lat=0&lng=0&zoom=20"])
      expect(readViewport(search)).toBeUndefined();
  });
  it("only pans a covered marker and never changes zoom", () => {
    expect(revealOffset({ x: 800, y: 300 }, { x: 1000, y: 800 }, { width: 400, height: 780 }, true)).toEqual([240, 0]);
    expect(revealOffset({ x: 100, y: 300 }, { x: 1000, y: 800 }, { width: 400, height: 780 }, true)).toEqual([0, 0]);
    expect(revealOffset({ x: 100, y: 650 }, { x: 390, y: 800 }, { width: 390, height: 360 }, false)).toEqual([0, 242]);
  });
  it("leads a geocoded label with its place", () => {
    expect(splitLabel("Qiucun, Guangde, Anhui")).toEqual({ title: "Qiucun", subtitle: "Guangde, Anhui" });
    expect(splitLabel("Kyoto")).toEqual({ title: "Kyoto" });
    expect(splitLabel("Kyoto, ")).toEqual({ title: "Kyoto, " });
  });
});
