import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import { isMemoBlurred } from "@/lib/tag";
import type { AttachmentVisualItem } from "@/utils/media-item";

export const useBlurredAttachmentItems = (items: AttachmentVisualItem[]): Set<string> => {
  const { isUserSettingsInitialized, userTagsSetting } = useAuth();
  const hasBlurRules = Object.values(userTagsSetting?.tags ?? {}).some((metadata) => metadata.blurContent);
  const memoNames = useMemo(
    () => [...new Set(items.flatMap((item) => item.attachments.flatMap((attachment) => (attachment.memo ? [attachment.memo] : []))))],
    [items],
  );
  // Reuse memo detail caching and unavailable-memo handling. Multiple files
  // from one memo need only one lookup; users without blur rules need none.
  const queries = useQueries({
    queries: isUserSettingsInitialized && hasBlurRules ? memoNames.map(memoDetailQueryOptions) : [],
  });
  const blurredMemos = new Set<string>();
  if (hasBlurRules) {
    memoNames.forEach((name, index) => {
      const query = queries[index];
      if (!query?.data || query.isError || isMemoBlurred(query.data, userTagsSetting)) {
        blurredMemos.add(name);
      }
    });
  }

  return new Set(
    items
      .filter((item) =>
        item.attachments.some((attachment) => attachment.memo && (!isUserSettingsInitialized || blurredMemos.has(attachment.memo))),
      )
      .map((item) => item.id),
  );
};
