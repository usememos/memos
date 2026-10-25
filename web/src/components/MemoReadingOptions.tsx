import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { updateDevicePreferences, useDevicePreferences } from "@/hooks/useDevicePreferences";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

/**
 * The reading switch on a memo's page, so a reader who is not signed in can hide
 * completed task items. It is the browser-wide device preference: it changes what
 * this browser shows, never the memo, its URL or sharing.
 */
const MemoReadingOptions = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const { hideCompletedTasks } = useDevicePreferences();
  const labelId = useId();
  return (
    <div className={cn("flex w-full items-center justify-end gap-2", className)}>
      <span id={labelId} className="text-sm text-muted-foreground">
        {t("memo.hide-completed-tasks")}
      </span>
      <Switch
        aria-labelledby={labelId}
        checked={hideCompletedTasks}
        onCheckedChange={(checked) => updateDevicePreferences({ hideCompletedTasks: checked })}
      />
    </div>
  );
};

export default MemoReadingOptions;
