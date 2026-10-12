import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { getMemoSortTime } from "@/hooks/useMemoSorting";
import type { Location, Memo } from "@/types/proto/api/memo_service_pb";

export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

export const validLocation = (location: Location | undefined): location is Location =>
  !!location &&
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude) &&
  Math.abs(location.latitude) <= 90 &&
  Math.abs(location.longitude) <= 180;

export const locationKey = (location: Location): string => `${location.latitude},${location.longitude}`;

/** A geocoded label split into the place itself and the region after it, so a rail can lead with the place. */
export function splitLabel(label: string): { title: string; subtitle?: string } {
  const index = label.indexOf(",");
  if (index <= 0) return { title: label };
  const subtitle = label.slice(index + 1).trim();
  return subtitle ? { title: label.slice(0, index).trim(), subtitle } : { title: label };
}

export function mapMemos(pages: { memos: Memo[] }[] | undefined, timeBasis: MemoTimeBasis): Memo[] {
  const memos = new Map<string, Memo>();
  for (const page of pages ?? []) for (const memo of page.memos) memos.set(memo.name, memo);
  const time = (memo: Memo) => getMemoSortTime(memo, timeBasis)?.getTime() ?? 0;
  return [...memos.values()]
    .filter((memo) => validLocation(memo.location))
    .sort((a, b) => time(b) - time(a) || a.name.localeCompare(b.name));
}

/**
 * What a pin shows, in the calendar cell's mark order: the memo's first photo; else its author,
 * when several creators share the map; else the plain dot.
 */
export type MapPinFace = { kind: "photo"; url: string } | { kind: "author"; avatarUrl?: string; name?: string } | { kind: "dot" };

export interface MapPin {
  face: MapPinFace;
  /** The pin's tooltip and accessible name: the place, and its author when several share the map. */
  label: string;
}

/** `photo` is undefined for a hidden memo, which never shows its images; `author` only when several creators share the map. */
export function pinFace(photo: string | undefined, author: { avatarUrl?: string; name?: string } | undefined): MapPinFace {
  if (photo) return { kind: "photo", url: photo };
  if (author) return { kind: "author", avatarUrl: author.avatarUrl || undefined, name: author.name };
  return { kind: "dot" };
}

/**
 * The label a selection at one point may be titled and written with. A place label is its
 * author's own words, so it only speaks for memos by that author, or for several authors who
 * all used it; otherwise there is none and the coordinates stand in. `memos` is newest first.
 */
export function pointLabel(memos: Memo[]): string {
  const labels = new Set(memos.map((memo) => memo.location?.placeholder.trim() ?? ""));
  const creators = new Set(memos.map((memo) => memo.creator));
  if (creators.size === 1) return memos[0]?.location?.placeholder.trim() ?? "";
  return labels.size === 1 ? [...labels][0] : "";
}

export function readViewport(search: string): MapViewport | undefined {
  const params = new URLSearchParams(search);
  const values = ["lat", "lng", "zoom"].map((key) => params.get(key));
  if (values.some((value) => value === null || value.trim() === "")) return undefined;
  const [lat, lng, zoom] = values.map(Number);
  if (![lat, lng, zoom].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || zoom < 0 || zoom > 19) return undefined;
  return { lat, lng, zoom };
}

/** Smallest translation that leaves a selected point visible beside an overlay. */
export function revealOffset(
  point: { x: number; y: number },
  size: { x: number; y: number },
  panel: { width: number; height: number },
  desktop: boolean,
) {
  const right = desktop ? Math.max(48, size.x - panel.width - 40) : size.x - 32;
  const bottom = desktop ? size.y - 32 : Math.max(100, size.y - panel.height - 32);
  return [
    point.x > right ? point.x - right : point.x < 32 ? point.x - 32 : 0,
    point.y > bottom ? point.y - bottom : point.y < 96 ? point.y - 96 : 0,
  ] as [number, number];
}
