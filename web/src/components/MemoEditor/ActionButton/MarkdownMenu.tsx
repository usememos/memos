import { Dropdown, Menu, MenuButton, MenuItem, Link } from "@mui/joy";
import { Button } from "@usememos/mui";
import { CheckSquareIcon, Code2Icon, SquareSlashIcon } from "lucide-react";
import { useTranslate } from "@/utils/i18n";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const MarkdownMenu = (props: Props) => {
  const t = useTranslate();

  const { editorRef } = props;

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
    <Dropdown>
      <MenuButton slots={{ root: "div" }}>
        <Button size="sm" variant="plain">
          <SquareSlashIcon className="w-4 h-4 mx-auto" />
        </Button>
      </MenuButton>
      <Menu className="text-sm" size="sm" sx={{ py: 0.5, minWidth: "auto" }} placement="bottom-start">
        <MenuItem sx={{ py: 0.5, minHeight: "auto", gap: 0.75 }} onClick={handleCodeBlockClick}>
          <Code2Icon className="w-3.5 h-auto" />
          <span>{t("markdown.code-block")}</span>
        </MenuItem>
        <MenuItem sx={{ py: 0.5, minHeight: "auto", gap: 0.75 }} onClick={handleCheckboxClick}>
          <CheckSquareIcon className="w-3.5 h-auto" />
          <span>{t("markdown.checkbox")}</span>
        </MenuItem>
        <div className="py-0.5 pl-2">
          <Link fontSize={11} href="https://www.usememos.com/docs/getting-started/content-syntax" target="_blank">
            {t("markdown.content-syntax")}
          </Link>
        </div>
      </Menu>
    </Dropdown>
  );
};

export default MarkdownMenu;
