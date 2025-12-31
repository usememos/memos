import type { FC } from "react";
import { useEditorContext } from "../state";
import type { EditorMetadataProps } from "../types";
import AttachmentListV2 from "./AttachmentListV2";
import LocationDisplayV2 from "./LocationDisplayV2";
import RelationListV2 from "./RelationListV2";

export const EditorMetadata: FC<EditorMetadataProps> = () => {
  const { state, actions, dispatch } = useEditorContext();

  return (
    <div className="w-full flex flex-col gap-2">
      <AttachmentListV2
        attachments={state.metadata.attachments}
        localFiles={state.localFiles}
        onAttachmentsChange={(attachments) => dispatch(actions.setMetadata({ attachments }))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
      />

      <RelationListV2
        relations={state.metadata.relations}
        onRelationsChange={(relations) => dispatch(actions.setMetadata({ relations }))}
      />

      {state.metadata.location && (
        <LocationDisplayV2 location={state.metadata.location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />
      )}
    </div>
  );
};
