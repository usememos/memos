import { createContext } from "react";
import { MemoRelation } from "@/types/proto/api/v1/memo_service";
import { Resource } from "@/types/proto/api/v1/resource_service";

interface Context {
  resourceList: Resource[];
  relationList: MemoRelation[];
  setResourceList: (resourceList: Resource[]) => void;
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
}

export const MemoEditorContext = createContext<Context>({
  resourceList: [],
  relationList: [],
  setResourceList: () => {},
  setRelationList: () => {},
});
