import type { RefObject } from "react";
import type { Memo } from "@/types/proto/api/memo_service_pb";

export interface MemoActionMenuProps {
  cardRef?: RefObject<HTMLElement | null>;
  memo: Memo;
  parentPage?: string;
  readonly?: boolean;
  onEdit?: () => void;
}
