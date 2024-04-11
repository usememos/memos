import { IconButton } from "@mui/joy";
import { uniqBy } from "lodash-es";
import { useContext } from "react";
import toast from "react-hot-toast";
import showCreateMemoRelationDialog from "@/components/CreateMemoRelationDialog";
import Icon from "@/components/Icon";
import { MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { useTranslate } from "@/utils/i18n";
import { EditorRefActions } from "../Editor";
import { MemoEditorContext } from "../types";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const AddMemoRelationButton = (props: Props) => {
  const { editorRef } = props;
  const context = useContext(MemoEditorContext);
  const t = useTranslate();

  const handleAddMemoRelationBtnClick = () => {
    showCreateMemoRelationDialog({
      onConfirm: (memos, embedded) => {
        // If embedded mode is enabled, embed the memo instead of creating a relation.
        if (embedded) {
          if (!editorRef.current) {
            toast.error(t("message.failed-to-embed-memo"));
            return;
          }

          const cursorPosition = editorRef.current.getCursorPosition();
          const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
          if (prevValue !== "" && !prevValue.endsWith("\n")) {
            editorRef.current.insertText("\n");
          }
          for (const memo of memos) {
            editorRef.current.insertText(`![[memos/${memo.uid}]]\n`);
          }
          setTimeout(() => {
            editorRef.current?.scrollToCursor();
            editorRef.current?.focus();
          });
          return;
        }

        context.setRelationList(
          uniqBy(
            [
              ...memos.map((memo) => ({
                memo: context.memoName || "",
                relatedMemo: memo.name,
                type: MemoRelation_Type.REFERENCE,
              })),
              ...context.relationList,
            ].filter((relation) => relation.relatedMemo !== context.memoName),
            "relatedMemoId",
          ),
        );
      },
    });
  };

  return (
    <IconButton size="sm" onClick={handleAddMemoRelationBtnClick}>
      <Icon.Link className="w-5 h-5 mx-auto" />
    </IconButton>
  );
};

export default AddMemoRelationButton;
