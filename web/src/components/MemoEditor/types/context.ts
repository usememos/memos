import { createContext } from "react";
import { MemoRelation } from "@/types/proto/api/v2/memo_relation_service";

interface Context {
  relationList: MemoRelation[];
  setRelationList: (relationList: MemoRelation[]) => void;
  // memoId is the id of the memo that is being edited.
  memoId?: number;
}

export const MemoEditorContext = createContext<Context>({
  relationList: [],
  setRelationList: () => {},
});
