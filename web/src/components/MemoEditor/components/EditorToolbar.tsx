import { create } from "@bufbuild/protobuf";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import {
  generateVideoLinkFilename,
  VIDEO_LINK_MIME_TYPE,
  type VideoLinkInfo,
} from "@/components/attachment/utils/videoLinkResolver";
import { attachmentServiceClient } from "@/connect";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import VisibilitySelector from "../Toolbar/VisibilitySelector";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName }) => {
  const { state, actions, dispatch } = useEditorContext();
  const { valid } = validationService.canSave(state);

  const isSaving = state.ui.isLoading.saving;

  const handleLocationChange = (location: typeof state.metadata.location) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleVisibilityChange = (visibility: typeof state.metadata.visibility) => {
    dispatch(actions.setMetadata({ visibility }));
  };

  const handleAddVideoLink = async (info: VideoLinkInfo) => {
    try {
      // Create an attachment with video link metadata using protobuf schema
      const attachment = await attachmentServiceClient.createAttachment({
        attachment: create(AttachmentSchema, {
          filename: generateVideoLinkFilename(info),
          type: VIDEO_LINK_MIME_TYPE,
          externalLink: info.originalUrl,
          // Empty content for video links (they are external)
          content: new Uint8Array(),
          size: BigInt(0),
        }),
      });

      // Add the attachment to the memo
      dispatch(actions.addAttachment(attachment));
    } catch (error) {
      console.error("Failed to create video link attachment:", error);
    }
  };

  return (
    <div className="w-full flex flex-row justify-between items-center mb-2">
      <div className="flex flex-row justify-start items-center">
        <InsertMenu
          isUploading={state.ui.isLoading.uploading}
          location={state.metadata.location}
          onLocationChange={handleLocationChange}
          onToggleFocusMode={handleToggleFocusMode}
          onAddVideoLink={handleAddVideoLink}
          memoName={memoName}
        />
      </div>

      <div className="flex flex-row justify-end items-center gap-2">
        <VisibilitySelector value={state.metadata.visibility} onChange={handleVisibilityChange} />

        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}

        <Button onClick={onSave} disabled={!valid || isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};
