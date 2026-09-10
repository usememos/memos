import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoActionMenuProps {
  memo: Memo;
  parentPage?: string;
  readonly?: boolean;
  onEdit?: () => void;
}
