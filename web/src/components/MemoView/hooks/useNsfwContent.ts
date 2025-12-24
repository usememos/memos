import { useState } from "react";
import { instanceStore } from "@/store";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface UseNsfwContentReturn {
  nsfw: boolean;
  showNSFWContent: boolean;
  toggleNsfwVisibility: () => void;
}

export const useNsfwContent = (memo: Memo, initialShowNsfw?: boolean): UseNsfwContentReturn => {
  const [showNSFWContent, setShowNSFWContent] = useState(initialShowNsfw ?? false);
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;

  const nsfw =
    instanceMemoRelatedSetting.enableBlurNsfwContent &&
    memo.tags?.some((tag) => instanceMemoRelatedSetting.nsfwTags.some((nsfwTag) => tag === nsfwTag || tag.startsWith(`${nsfwTag}/`)));

  return {
    nsfw: nsfw ?? false,
    showNSFWContent,
    toggleNsfwVisibility: () => setShowNSFWContent((prev) => !prev),
  };
};
