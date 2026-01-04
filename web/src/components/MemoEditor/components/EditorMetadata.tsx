import type { FC } from "react";
import DateTimeInput from "@/components/DateTimeInput";
import { useTranslate } from "@/utils/i18n";
import { useEditorContext } from "../state";
import type { EditorMetadataProps } from "../types";
import AttachmentList from "./AttachmentList";
import LocationDisplay from "./LocationDisplay";
import RelationList from "./RelationList";

export const EditorMetadata: FC<EditorMetadataProps> = () => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();

  return (
    <div className="w-full flex flex-col gap-2">
      <AttachmentList
        attachments={state.metadata.attachments}
        localFiles={state.localFiles}
        onAttachmentsChange={(attachments) => dispatch(actions.setMetadata({ attachments }))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
      />

      <RelationList relations={state.metadata.relations} onRelationsChange={(relations) => dispatch(actions.setMetadata({ relations }))} />

      {state.metadata.location && (
        <LocationDisplay location={state.metadata.location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />
      )}
      <div className="w-full flex flex-row justify-start items-center text-sm space-x-2">
        <div className="flex items-center">
          <span className="text-gray-400">{t("editor.created-at")}:</span>
          <DateTimeInput
            value={state.timestamps.createTime || new Date()}
            onChange={(date) => dispatch(actions.setTimestamps({ createTime: date }))}
          />
        </div>
      </div>
    </div>
  );
};
