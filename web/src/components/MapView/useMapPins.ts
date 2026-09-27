import { useMemo } from "react";
import { getMemoThumbnail } from "@/components/CalendarView/dayModel";
import { getLocationDisplayText } from "@/components/MemoMetadata/Location/locationHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { useUsersByUsernames } from "@/hooks/useUserQueries";
import { extractUsernameFromName } from "@/lib/resource-names";
import { isMemoBlurred } from "@/lib/tag";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { type MapPin, pinFace } from "./model";

/**
 * Each memo's pin, keyed by memo name. Photos are found once per memo list; authors are resolved
 * in one batch, and only when no single creator is selected.
 */
export function useMapPins(memos: Memo[], showAuthors: boolean): ReadonlyMap<string, MapPin> {
  const { userTagsSetting } = useAuth();
  const photos = useMemo(
    () => new Map(memos.map((memo) => [memo.name, isMemoBlurred(memo, userTagsSetting) ? undefined : getMemoThumbnail(memo)])),
    [memos, userTagsSetting],
  );
  const usernames = useMemo(
    () => (showAuthors ? Array.from(new Set(memos.map((memo) => extractUsernameFromName(memo.creator)))) : []),
    [memos, showAuthors],
  );
  const { data: usersByUsername } = useUsersByUsernames(usernames);

  return useMemo(() => {
    const pins = new Map<string, MapPin>();
    for (const memo of memos) {
      const place = getLocationDisplayText(memo.location!);
      const user = showAuthors ? usersByUsername?.get(extractUsernameFromName(memo.creator)) : undefined;
      const name = user?.displayName || user?.username;
      pins.set(memo.name, {
        face: pinFace(photos.get(memo.name), showAuthors ? { avatarUrl: user?.avatarUrl, name } : undefined),
        label: name ? `${place} · ${name}` : place,
      });
    }
    return pins;
  }, [memos, photos, showAuthors, usersByUsername]);
}
