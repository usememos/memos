import { CheckSquareIcon, Code2Icon, SquareSlashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useTranslate } from "@/utils/i18n";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
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
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <SquareSlashIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("tooltip.markdown-menu")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={handleCodeBlockClick}>
          <Code2Icon className="w-4 h-auto text-muted-foreground" />
          {t("markdown.code-block")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCheckboxClick}>
          <CheckSquareIcon className="w-4 h-auto text-muted-foreground" />
          {t("markdown.checkbox")}
        </DropdownMenuItem>
        <div className="px-2 -mt-1">
          <a
            className="text-xs text-primary hover:underline"
            href="https://www.usememos.com/docs/guides/content-syntax"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("markdown.content-syntax")}
          </a>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MarkdownMenu;
