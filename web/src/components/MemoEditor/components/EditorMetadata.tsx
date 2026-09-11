import type { FC } from "react";
import { AttachmentListEditor, LocationDisplayEditor, RelationListEditor } from "@/components/MemoMetadata";
import { METADATA_ROW_LIST_CLASSES } from "@/components/MemoMetadata/MetadataSection";
import { extractManagedAttachmentUIDs } from "@/utils/managed-attachment";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorMetadataProps } from "../types";

export const EditorMetadata: FC<EditorMetadataProps> = ({ memoName, uploadingLocalFileURLs, onInsertAttachments, onInsertLocalFiles }) => {
  const { actions, dispatch } = useEditorContext();
  const attachments = useEditorSelector((s) => s.metadata.attachments);
  const localFiles = useEditorSelector((s) => s.localFiles);
  const relations = useEditorSelector((s) => s.metadata.relations);
  const location = useEditorSelector((s) => s.metadata.location);
  const content = useEditorSelector((s) => s.content);
  const placementActionsDisabled = useEditorSelector(
    (s) => s.ui.isLoading.saving || s.ui.isLoading.uploading || s.ui.pendingInlineImageInsertions > 0,
  );
  const inlineAttachmentUIDs = extractManagedAttachmentUIDs(content);

  return (
    <div className="w-full flex flex-col gap-2">
      <AttachmentListEditor
        attachments={attachments}
        localFiles={localFiles}
        onAttachmentsChange={(next) => dispatch(actions.setMetadata({ attachments: next }))}
        onLocalFilesChange={(next) => dispatch(actions.setLocalFiles(next))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
        inlineAttachmentUIDs={inlineAttachmentUIDs}
        onInsertAttachments={onInsertAttachments}
        onInsertLocalFiles={onInsertLocalFiles}
        placementActionsDisabled={placementActionsDisabled}
        uploadingLocalFileURLs={uploadingLocalFileURLs}
      />

      <RelationListEditor
        relations={relations}
        onRelationsChange={(next) => dispatch(actions.setMetadata({ relations: next }))}
        memoName={memoName}
      />

      {location && (
        <div className={METADATA_ROW_LIST_CLASSES}>
          <LocationDisplayEditor location={location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />
        </div>
      )}
    </div>
  );
};
