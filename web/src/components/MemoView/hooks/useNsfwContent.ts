import { useState } from "react";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface UseNsfwContentReturn {
  nsfw: boolean;
  showNSFWContent: boolean;
  toggleNsfwVisibility: () => void;
}

export const useNsfwContent = (memo: Memo, initialShowNsfw?: boolean): UseNsfwContentReturn => {
  const [showNSFWContent, setShowNSFWContent] = useState(initialShowNsfw ?? false);

  // Always blur content tagged with NSFW
  const nsfw = memo.tags?.includes("NSFW") ?? false;

  return {
    nsfw,
    showNSFWContent,
    toggleNsfwVisibility: () => setShowNSFWContent((prev) => !prev),
  };
};
