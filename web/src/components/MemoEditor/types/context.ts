import { createContext } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service";
import type { LocalFile } from "../../memo-metadata";

interface Context {
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  setAttachmentList: (attachmentList: Attachment[]) => void;
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
  // For local file upload/preview
  addLocalFiles?: (files: LocalFile[]) => void;
  removeLocalFile?: (previewUrl: string) => void;
  localFiles?: LocalFile[];
}

export const MemoEditorContext = createContext<Context>({
  attachmentList: [],
  relationList: [],
  setAttachmentList: () => {},
  setRelationList: () => {},
  addLocalFiles: () => {},
  removeLocalFile: () => {},
  localFiles: [],
});
