import { HashIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import OverflowTip from "@/components/kit/OverflowTip";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { userStore } from "@/store";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const TagSelector = observer((props: Props) => {
  const t = useTranslate();
  const { editorRef } = props;
  const tags = Object.entries(userStore.state.tagCount)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const handleTagClick = (tag: string) => {
    const current = editorRef.current;
    if (current === null) return;

    const line = current.getLine(current.getCursorLineNumber());
    const lastCharOfLine = line.slice(-1);

    if (lastCharOfLine !== " " && lastCharOfLine !== "　" && line !== "") {
      current.insertText("\n");
    }
    current.insertText(`#${tag} `);
  };

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <HashIcon className="size-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("tooltip.tags")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" sideOffset={2}>
        {tags.length > 0 ? (
          <div className="flex flex-row justify-start items-start flex-wrap px-2 max-w-48 h-auto max-h-48 overflow-y-auto gap-x-2">
            {tags.map((tag) => {
              return (
                <div
                  key={tag}
                  className="inline-flex w-auto max-w-full cursor-pointer text-base leading-6 text-muted-foreground hover:opacity-80"
                  onClick={() => handleTagClick(tag)}
                >
                  <OverflowTip>#{tag}</OverflowTip>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="italic mx-2" onClick={(e) => e.stopPropagation()}>
            {t("tag.no-tag-found")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
});

export default TagSelector;
