import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { stringify as stringifyYaml } from "yaml";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useTranslate } from "@/utils/i18n";
import { POLL_LANGUAGE_TAG, type PollDefinition } from "../../MemoContent/poll/types";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fenced ```poll markdown block ready to insert at the cursor. */
  onConfirm: (markdown: string) => void;
}

export const CreatePollDialog = ({ open, onOpenChange, onConfirm }: CreatePollDialogProps) => {
  const t = useTranslate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multiple, setMultiple] = useState(false);

  // Reset the form each time the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setQuestion("");
      setOptions(["", ""]);
      setMultiple(false);
    }
  }, [open]);

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  };

  const handleAddOption = () => {
    setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, ""]));
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => (prev.length <= MIN_OPTIONS ? prev : prev.filter((_, i) => i !== index)));
  };

  const trimmedOptions = options.map((option) => option.trim()).filter((option) => option.length > 0);
  const canConfirm = question.trim().length > 0 && trimmedOptions.length >= MIN_OPTIONS;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const poll: PollDefinition = {
      id: uuidv4(),
      question: question.trim(),
      type: multiple ? "multiple" : "single",
      options: trimmedOptions,
    };
    const markdown = "```" + POLL_LANGUAGE_TAG + "\n" + stringifyYaml(poll) + "```";
    onConfirm(markdown);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))] p-0!" showCloseButton={false}>
        <VisuallyHidden>
          <DialogClose />
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>{t("editor.insert-menu.create-poll")}</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col p-3 gap-3">
          <DialogTitle className="text-base font-medium">{t("editor.insert-menu.create-poll")}</DialogTitle>

          <div className="grid gap-1">
            <Label htmlFor="poll-question" className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("editor.poll.question")}
            </Label>
            <Input
              id="poll-question"
              placeholder={t("editor.poll.question-placeholder")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("editor.poll.options")}</Label>
            <div className="flex flex-col gap-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={t("editor.poll.option-placeholder", { index: index + 1 })}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={options.length <= MIN_OPTIONS}
                    onClick={() => handleRemoveOption(index)}
                    aria-label={t("editor.poll.remove-option")}
                  >
                    <Trash2Icon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start mt-1"
              disabled={options.length >= MAX_OPTIONS}
              onClick={handleAddOption}
            >
              <PlusIcon className="w-4 h-4" />
              {t("editor.poll.add-option")}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 py-1">
            <Label htmlFor="poll-multiple" className="text-sm">
              {t("editor.poll.allow-multiple")}
            </Label>
            <Switch id="poll-multiple" checked={multiple} onCheckedChange={setMultiple} />
          </div>

          <div className="w-full flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
