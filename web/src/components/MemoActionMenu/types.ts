import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface MemoActionMenuProps {
  memo: Memo;
  readonly?: boolean;
  className?: string;
  onEdit?: () => void;
}
