import { createContext } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import type { LocalFile } from "./attachment";

export interface MemoEditorContextValue {
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  setAttachmentList: (attachmentList: Attachment[]) => void;
  setRelationList: (relationList: MemoRelation[]) => void;
  memoName?: string;
  addLocalFiles?: (files: LocalFile[]) => void;
  removeLocalFile?: (previewUrl: string) => void;
  localFiles?: LocalFile[];
}

const defaultContextValue: MemoEditorContextValue = {
  attachmentList: [],
  relationList: [],
  setAttachmentList: () => {},
  setRelationList: () => {},
  addLocalFiles: () => {},
  removeLocalFile: () => {},
  localFiles: [],
};

export const MemoEditorContext = createContext<MemoEditorContextValue>(defaultContextValue);
