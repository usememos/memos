import { createContext } from "react";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { MemoRelation } from "@/types/proto/api/v1/memo_service";

interface Context {
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  setAttachmentList: (attachmentList: Attachment[]) => void;
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
  // Optional: central upload handler so UI can show progress consistently
  uploadFiles?: (files: FileList) => Promise<void>;
}

export const MemoEditorContext = createContext<Context>({
  attachmentList: [],
  relationList: [],
  setAttachmentList: () => {},
  setRelationList: () => {},
});
