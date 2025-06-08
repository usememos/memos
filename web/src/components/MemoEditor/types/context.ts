import { createContext } from "react";
import { MemoRelation } from "@/types/proto/api/v1/memo_service";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { EditorRefActions } from "../Editor";

interface Context {
  resourceList: Resource[];
  relationList: MemoRelation[];
  setResourceList: (resourceList: Resource[]) => void;
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
  editorRef?: React.RefObject<EditorRefActions>;
}

export const MemoEditorContext = createContext<Context>({
  resourceList: [],
  relationList: [],
  setResourceList: () => {},
  setRelationList: () => {},
});
