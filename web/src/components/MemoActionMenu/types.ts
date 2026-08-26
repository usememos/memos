import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { MemoOriginScope } from "../MemoView/navigation";

export interface MemoActionMenuProps {
  memo: Memo;
  parentScope: MemoOriginScope;
  readonly?: boolean;
  className?: string;
  onEdit?: () => void;
}
