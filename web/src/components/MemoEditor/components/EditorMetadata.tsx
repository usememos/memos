import type { FC } from "react";
import { AttachmentListEditor, LocationDisplayEditor, RelationListEditor } from "@/components/MemoMetadata";
import { useEditorContext } from "../state";
import type { EditorMetadataProps } from "../types";

const toDatetimeLocalValue = (date?: Date) => {
  if (!date) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

export const EditorMetadata: FC<EditorMetadataProps> = ({ memoName }) => {
  const { state, actions, dispatch } = useEditorContext();

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted-foreground">提醒时间</label>
        <input
          type="datetime-local"
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={toDatetimeLocalValue(state.metadata.remindTime)}
          onChange={(e) =>
            dispatch(
              actions.setMetadata({
                remindTime: e.target.value ? new Date(e.target.value) : undefined,
              }),
            )
          }
        />
      </div>

      <AttachmentListEditor
        attachments={state.metadata.attachments}
        localFiles={state.localFiles}
        onAttachmentsChange={(attachments) => dispatch(actions.setMetadata({ attachments }))}
        onLocalFilesChange={(localFiles) => dispatch(actions.setLocalFiles(localFiles))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
      />

      <RelationListEditor
        relations={state.metadata.relations}
        onRelationsChange={(relations) => dispatch(actions.setMetadata({ relations }))}
        memoName={memoName}
      />

      {state.metadata.location && (
        <LocationDisplayEditor location={state.metadata.location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />
      )}
    </div>
  );
};