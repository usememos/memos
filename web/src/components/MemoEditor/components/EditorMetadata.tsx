import type { FC } from "react";
import { useEditorContext } from "../state";
import type { EditorMetadataProps } from "../types";
import AttachmentList from "./AttachmentList";
import LocationDisplay from "./LocationDisplay";
import RelationList from "./RelationList";

export const EditorMetadata: FC<EditorMetadataProps> = ({ memoName }) => {
  const { state, actions, dispatch } = useEditorContext();

  return (
    <div className="w-full flex flex-col gap-2">
      <AttachmentList
        attachments={state.metadata.attachments}
        localFiles={state.localFiles}
        onAttachmentsChange={(attachments) => dispatch(actions.setMetadata({ attachments }))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
      />

      <RelationList
        relations={state.metadata.relations}
        onRelationsChange={(relations) => dispatch(actions.setMetadata({ relations }))}
        memoName={memoName}
      />

      {state.metadata.location && (
        <LocationDisplay location={state.metadata.location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />
      )}
    </div>
  );
};
