import { CornerDownLeftIcon, Loader2Icon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslate } from "@/utils/i18n";

interface ChatComposerProps {
  isSending: boolean;
  /** Blocks sending when the selection is over budget or unresolvable. */
  disabled: boolean;
  /** Explains why sending is blocked, shown under the input. */
  disabledReason: string | undefined;
  onSend: (content: string) => void;
}

/** The message input. Enter sends; Shift+Enter inserts a newline. */
const ChatComposer = ({ isSending, disabled, disabledReason, onSend }: ChatComposerProps) => {
  const t = useTranslate();
  const [draft, setDraft] = useState("");

  const canSend = !disabled && !isSending && draft.trim() !== "";

  const handleSend = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("ai.composer-placeholder")}
          rows={2}
          disabled={disabled || isSending}
          className="min-h-[4.5rem] resize-y"
          aria-label={t("ai.composer-placeholder")}
        />
        <Button disabled={!canSend} onClick={handleSend} className="mb-0.5">
          {isSending ? (
            <Loader2Icon className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <CornerDownLeftIcon className="size-4" strokeWidth={2} />
          )}
          <span className="ms-1.5">{t("ai.send")}</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{disabledReason ?? t("ai.composer-hint")}</p>
    </div>
  );
};

export default ChatComposer;
