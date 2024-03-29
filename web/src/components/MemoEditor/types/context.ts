import { createContext } from "react";
import { MemoRelation } from "@/types/proto/api/v2/memo_relation_service";

interface Context {
  relationList: MemoRelation[];
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
}

export const MemoEditorContext = createContext<Context>({
  relationList: [],
  setRelationList: () => {},
});
