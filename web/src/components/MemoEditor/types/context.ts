import { createContext } from "react";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { MemoRelation } from "@/types/proto/api/v1/memo_service";

interface Context {
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  setAttachmentList: (attachmentList: Attachment[]) => void;
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
}

export const MemoEditorContext = createContext<Context>({
  attachmentList: [],
  relationList: [],
  setAttachmentList: () => {},
  setRelationList: () => {},
});
