import { Dropdown, IconButton, Menu, MenuButton, MenuItem } from "@mui/joy";
import { Link } from "@mui/joy";
import { CheckSquareIcon, Code2Icon, SquareSlashIcon } from "lucide-react";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const MarkdownMenu = (props: Props) => {
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
      <MenuButton
        slots={{ root: IconButton }}
        slotProps={{
          root: {
            size: "sm",
          },
        }}
      >
        <SquareSlashIcon className="w-5 h-5 mx-auto" />
      </MenuButton>
      <Menu className="text-sm" size="sm" placement="bottom-start">
        <MenuItem onClick={handleCodeBlockClick}>
          <Code2Icon className="w-4 h-auto" />
          <span>Code block</span>
        </MenuItem>
        <MenuItem onClick={handleCheckboxClick}>
          <CheckSquareIcon className="w-4 h-auto" />
          <span>Checkbox</span>
        </MenuItem>
        <div className="-mt-0.5 pl-2">
          <Link fontSize={12} href="https://www.usememos.com/docs/getting-started/content-syntax" target="_blank">
            Content syntax
          </Link>
        </div>
      </Menu>
    </Dropdown>
  );
};

export default MarkdownMenu;
