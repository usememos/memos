import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { LocalFile } from "../types/attachment";

/*
 * Saved attachments and new files share one order in the draft. The order is a list of keys:
 * a saved attachment's name, or a new file's preview URL. An edited drawing keeps the key of the
 * attachment it replaces, so it holds that attachment's place. A key the order doesn't list (a
 * file added after the last reorder) keeps its natural place: saved first, then new, as added.
 */

/** The key a new file holds in the order. */
export const localFileOrderKey = (localFile: LocalFile): string => localFile.replaces ?? localFile.previewUrl;

/** Sorts `items` by `order`; items whose keys it doesn't list follow, in their own order. */
export function sortByOrder<T>(items: readonly T[], keysOf: (item: T) => string[], order: readonly string[]): T[] {
  if (order.length === 0) return [...items];
  const rank = new Map(order.map((key, index) => [key, index]));
  const rankOf = (item: T, index: number) => {
    const ranks = keysOf(item).flatMap((key) => (rank.has(key) ? [rank.get(key) as number] : []));
    return ranks.length > 0 ? Math.min(...ranks) : order.length + index;
  };
  return items
    .map((item, index) => ({ item, rank: rankOf(item, index) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}

/**
 * The order after moving the group at `from` to the place of the group at `to`, where each group
 * is one item's keys (a Live Photo is two files moving together). Moving down lands after the
 * target, moving up before it, so the dragged item always ends up where it was dropped.
 */
export function moveGroup(groups: readonly string[][], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return Array.from(new Set(groups.flat()));
  const next = [...groups];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  // An edited drawing and the saved drawing it replaces share a key; list it once.
  return Array.from(new Set(next.flat()));
}

/**
 * The order to sort by: the draft's, or before the first reorder the natural one, so an edited
 * drawing already sits where the saved drawing it replaces was.
 */
export const effectiveOrder = (
  order: readonly string[],
  attachments: readonly Attachment[],
  localFiles: readonly LocalFile[],
): readonly string[] =>
  order.length > 0 ? order : [...attachments.map((attachment) => attachment.name), ...localFiles.map((localFile) => localFile.previewUrl)];

/**
 * The memo's attachments in the draft's order, once the new files have uploaded. `uploaded`
 * maps each new file's preview URL to the attachment it became.
 */
export function orderAttachments(
  attachments: readonly Attachment[],
  uploaded: ReadonlyMap<string, Attachment>,
  order: readonly string[],
): Attachment[] {
  return sortByOrder(attachments, (attachment) => [attachment.name], renameUploadedKeys(order, uploaded));
}

/** The order with each uploaded file's preview URL swapped for its attachment's name. */
export function renameUploadedKeys(order: readonly string[], uploaded: ReadonlyMap<string, Attachment>): string[] {
  return order.map((key) => uploaded.get(key)?.name ?? key);
}
