import { createContext } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service";
import type { LocalFile } from "../../memo-metadata";

/**
 * Context interface for MemoEditor
 * Provides access to editor state and actions for child components
 */
export interface MemoEditorContextValue {
  /** List of uploaded attachments */
  attachmentList: Attachment[];
  /** List of memo relations/links */
  relationList: MemoRelation[];
  /** Update the attachment list */
  setAttachmentList: (attachmentList: Attachment[]) => void;
  /** Update the relation list */
  setRelationList: (relationList: MemoRelation[]) => void;
  /** Name of memo being edited (undefined for new memos) */
  memoName?: string;
  /** Add local files for upload preview */
  addLocalFiles?: (files: LocalFile[]) => void;
  /** Remove a local file by preview URL */
  removeLocalFile?: (previewUrl: string) => void;
  /** List of local files pending upload */
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
