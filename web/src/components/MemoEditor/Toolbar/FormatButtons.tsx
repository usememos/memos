import { HashIcon, ListIcon, CheckSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorContext } from "../state";

const FormatButtons = () => {
  const { state, actions, dispatch } = useEditorContext();

   const insertText = (text: string) => {
    const content = state.content ?? "";
    const needsNewLine = content.length > 0 && !content.endsWith("\n");

    const newContent = `${content}${needsNewLine ? "\n" : ""}${text}`;

    dispatch(actions.updateContent(newContent));
  };


  return (
    <div className="flex flex-row items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="shadow-none"
        onClick={() => insertText("# ")}
        title="Título"
      >
        <HashIcon className="size-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="shadow-none"
        onClick={() => insertText("- [ ] ")}
        title="Tarea"
      >
        <CheckSquareIcon className="size-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="shadow-none"
        onClick={() => insertText("* ")}
        title="Lista"
      >
        <ListIcon className="size-4" />
      </Button>
    </div>
  );
};

export default FormatButtons;
