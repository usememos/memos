import { CheckSquareIcon, Code2Icon, SquareSlashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const MarkdownMenu = (props: Props) => {
  const { editorRef } = props;
  const t = useTranslate();

  const handleCodeBlockClick = () => {
    if (!editorRef.current) {
      return;
    }

    const cursorPosition = editorRef.current.getCursorPosition();
    const prevValue = editorRef.current.getContent().slice(0, cursorPosition);
    if (prevValue === "" || prevValue.endsWith("\n")) {
      editorRef.current.insertText("", "```\n", "\n```");
    } else {
      editorRef.current.insertText("", "\n```\n", "\n```");
    }
    setTimeout(() => {
      editorRef.current?.scrollToCursor();
      editorRef.current?.focus();
    });
  };

  const handleCheckboxClick = () => {
    if (!editorRef.current) {
      return;
    }

    const currentPosition = editorRef.current.getCursorPosition();
    const currentLineNumber = editorRef.current.getCursorLineNumber();
    const currentLine = editorRef.current.getLine(currentLineNumber);
    let newLine = "";
    let cursorChange = 0;
    if (/^- \[( |x|X)\] /.test(currentLine)) {
      newLine = currentLine.replace(/^- \[( |x|X)\] /, "");
      cursorChange = -6;
    } else if (/^\d+\. |- /.test(currentLine)) {
      const match = currentLine.match(/^\d+\. |- /) ?? [""];
      newLine = currentLine.replace(/^\d+\. |- /, "- [ ] ");
      cursorChange = -match[0].length + 6;
    } else {
      newLine = "- [ ] " + currentLine;
      cursorChange = 6;
    }
    editorRef.current.setLine(currentLineNumber, newLine);
    editorRef.current.setCursorPosition(currentPosition + cursorChange);
    setTimeout(() => {
      editorRef.current?.scrollToCursor();
      editorRef.current?.focus();
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <SquareSlashIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="text-sm p-1">
        <div className="flex flex-col text-sm gap-0.5">
          <button
            onClick={handleCodeBlockClick}
            className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-background outline-none rounded"
          >
            <Code2Icon className="w-4 h-auto" />
            <span>{t("markdown.code-block")}</span>
          </button>
          <button
            onClick={handleCheckboxClick}
            className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-background outline-none rounded"
          >
            <CheckSquareIcon className="w-4 h-auto" />
            <span>{t("markdown.checkbox")}</span>
          </button>
          <div className="pl-2">
            <a
              className="text-xs text-primary hover:underline"
              href="https://www.usememos.com/docs/getting-started/content-syntax"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("markdown.content-syntax")}
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MarkdownMenu;
