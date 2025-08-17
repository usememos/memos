import { XIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface TagSuggestion {
  tag: string;
  reason: string;
}

interface Props {
  tags: TagSuggestion[];
  onTagClick: (tag: string) => void;
  onAddAll: () => void;
  onClose: () => void;
}

const TagRecommendationPanel = (props: Props) => {
  const t = useTranslate();
  const { tags, onTagClick, onAddAll, onClose } = props;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-muted/50 border border-border rounded-md p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{t("editor.tag-recommend.suggested-tags")}</span>
        <div className="flex items-center gap-1">
          {tags.length > 1 && (
            <Button variant="ghost" size="sm" onClick={onAddAll} className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground">
              <PlusIcon className="size-3 mr-1" />
              {t("editor.tag-recommend.add-all")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
            <XIcon className="size-3" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tagSuggestion) => (
          <Tooltip key={tagSuggestion.tag}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTagClick(tagSuggestion.tag)}
                className={cn(
                  "text-xs h-6 px-2 border-dashed",
                  "hover:border-solid hover:bg-primary hover:text-primary-foreground",
                  "transition-all duration-200",
                )}
              >
                #{tagSuggestion.tag}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">{tagSuggestion.reason}</div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default TagRecommendationPanel;
