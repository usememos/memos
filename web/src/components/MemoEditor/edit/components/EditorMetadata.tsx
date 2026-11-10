import type { FC } from "react";
import { AttachmentListEditor, LocationDisplayEditor, RelationListEditor } from "@/components/MemoMetadata";
import { getEditorBacklinkRelations, getEditorReferenceRelations } from "@/components/MemoMetadata/Relation/relationHelpers";
import { extractManagedAttachmentUIDs } from "@/utils/managed-attachment";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorMetadataProps } from "../types";

export const EditorMetadata: FC<EditorMetadataProps> = ({
  memoName,
  uploadingLocalFileURLs,
  onInsertAttachments,
  onInsertLocalFiles,
  onTranscribeAttachment,
  transcribingAttachment,
  transcriptionDisabled,
  onEditDrawing,
  openingDrawing,
}) => {
  const { actions, dispatch } = useEditorContext();
  const attachments = useEditorSelector((s) => s.metadata.attachments);
  const localFiles = useEditorSelector((s) => s.localFiles);
  const relations = useEditorSelector((s) => s.metadata.relations);
  const location = useEditorSelector((s) => s.metadata.location);
  const attachmentOrder = useEditorSelector((s) => s.attachmentOrder);
  const content = useEditorSelector((s) => s.content);
  const placementActionsDisabled = useEditorSelector(
    (s) => s.ui.isLoading.saving || s.ui.isLoading.uploading || s.ui.pendingInlineImageInsertions > 0,
  );
  const inlineAttachmentUIDs = extractManagedAttachmentUIDs(content);

  const hasLinks =
    getEditorReferenceRelations(relations, memoName).length > 0 || getEditorBacklinkRelations(relations, memoName).length > 0;
  // Links and the place follow the attachments in the same list, so the draft reads as one quiet list under the gallery.
  const trailingRows =
    hasLinks || location ? (
      <>
        {hasLinks && (
          <RelationListEditor
            relations={relations}
            onRelationsChange={(next) => dispatch(actions.setMetadata({ relations: next }))}
            memoName={memoName}
          />
        )}
        {location && <LocationDisplayEditor location={location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />}
      </>
    ) : undefined;

  return (
    <div className="w-full flex flex-col gap-2">
      <AttachmentListEditor
        attachments={attachments}
        localFiles={localFiles}
        onAttachmentsChange={(next) => dispatch(actions.setMetadata({ attachments: next }))}
        onLocalFilesChange={(next) => dispatch(actions.setLocalFiles(next))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
        order={attachmentOrder}
        onOrderChange={(next) => dispatch(actions.setAttachmentOrder(next))}
        inlineAttachmentUIDs={inlineAttachmentUIDs}
        onInsertAttachments={onInsertAttachments}
        onInsertLocalFiles={onInsertLocalFiles}
        placementActionsDisabled={placementActionsDisabled}
        uploadingLocalFileURLs={uploadingLocalFileURLs}
        onTranscribeAttachment={onTranscribeAttachment}
        transcribingAttachment={transcribingAttachment}
        transcriptionDisabled={transcriptionDisabled}
        onEditDrawing={onEditDrawing}
        openingDrawing={openingDrawing}
      >
        {trailingRows}
      </AttachmentListEditor>
    </div>
  );
};
