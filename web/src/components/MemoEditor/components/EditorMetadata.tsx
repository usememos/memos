import type { FC } from "react";
import { AttachmentList, LocationDisplay, RelationList } from "@/components/memo-metadata";
import { useEditorContext } from "../state";

export const EditorMetadata: FC = () => {
  const { state, actions, dispatch } = useEditorContext();

  return (
    <div className="w-full flex flex-col gap-2">
      {state.metadata.location && (
        <LocationDisplay
          mode="edit"
          location={state.metadata.location}
          onRemove={() => dispatch(actions.setMetadata({ location: undefined }))}
        />
      )}

      <AttachmentList
        mode="edit"
        attachments={state.metadata.attachments}
        localFiles={state.localFiles}
        onAttachmentsChange={(attachments) => dispatch(actions.setMetadata({ attachments }))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
      />

      <RelationList
        mode="edit"
        relations={state.metadata.relations}
        currentMemoName=""
        onRelationsChange={(relations) => dispatch(actions.setMetadata({ relations }))}
      />
    </div>
  );
};
