import { useState } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface UseNsfwContentReturn {
  nsfw: boolean;
  showNSFWContent: boolean;
  toggleNsfwVisibility: () => void;
}

export const useNsfwContent = (memo: Memo, initialShowNsfw?: boolean): UseNsfwContentReturn => {
  const [showNSFWContent, setShowNSFWContent] = useState(initialShowNsfw ?? false);
  const { memoRelatedSetting } = useInstance();

  const nsfw =
    memoRelatedSetting.enableBlurNsfwContent &&
    memo.tags?.some((tag) => memoRelatedSetting.nsfwTags.some((nsfwTag) => tag === nsfwTag || tag.startsWith(`${nsfwTag}/`)));

  return {
    nsfw: nsfw ?? false,
    showNSFWContent,
    toggleNsfwVisibility: () => setShowNSFWContent((prev) => !prev),
  };
};
