import { KeyboardIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslate } from "@/utils/i18n";
import { isApplePlatform, primaryModifierGlyph } from "@/utils/platform";

type ShortcutLabelKey =
  | "setting.shortcuts.focus-search"
  | "setting.shortcuts.focus-search-slash"
  | "setting.shortcuts.move-cards"
  | "setting.shortcuts.open-card"
  | "setting.shortcuts.clear-search"
  | "setting.shortcuts.sidebar-search"
  | "setting.shortcuts.submit-search"
  | "setting.shortcuts.quick-find-enter"
  | "setting.shortcuts.quick-find-newline"
  | "setting.shortcuts.editor-save"
  | "setting.shortcuts.preview-prev"
  | "setting.shortcuts.calendar-move"
  | "setting.shortcuts.calendar-edges"
  | "setting.shortcuts.calendar-close"
  | "setting.shortcuts.resize-sidebar";

interface ShortcutRow {
  keys: string;
  labelKey: ShortcutLabelKey;
}

interface ShortcutGroup {
  titleKey: "setting.shortcuts.group-nav" | "setting.shortcuts.group-search" | "setting.shortcuts.group-editor" | "setting.shortcuts.group-misc";
  rows: ShortcutRow[];
}

const KeyboardShortcutsDialog = () => {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const mod = primaryModifierGlyph();
  const navQuick = isApplePlatform() ? "⌃Q" : "Ctrl+Q";

  const groups: ShortcutGroup[] = [
    {
      titleKey: "setting.shortcuts.group-nav",
      rows: [
        { keys: navQuick, labelKey: "setting.shortcuts.focus-search" },
        { keys: "/", labelKey: "setting.shortcuts.focus-search-slash" },
        { keys: "↑ ↓", labelKey: "setting.shortcuts.move-cards" },
        { keys: "Enter", labelKey: "setting.shortcuts.open-card" },
        { keys: "Esc", labelKey: "setting.shortcuts.clear-search" },
      ],
    },
    {
      titleKey: "setting.shortcuts.group-search",
      rows: [
        { keys: "/", labelKey: "setting.shortcuts.sidebar-search" },
        { keys: "Enter", labelKey: "setting.shortcuts.submit-search" },
        { keys: "Enter", labelKey: "setting.shortcuts.quick-find-enter" },
        { keys: "Shift+Enter", labelKey: "setting.shortcuts.quick-find-newline" },
      ],
    },
    {
      titleKey: "setting.shortcuts.group-editor",
      rows: [{ keys: `${mod}+Enter`, labelKey: "setting.shortcuts.editor-save" }],
    },
    {
      titleKey: "setting.shortcuts.group-misc",
      rows: [
        { keys: "← →", labelKey: "setting.shortcuts.preview-prev" },
        { keys: "← → ↑ ↓", labelKey: "setting.shortcuts.calendar-move" },
        { keys: "Home / End", labelKey: "setting.shortcuts.calendar-edges" },
        { keys: "Esc", labelKey: "setting.shortcuts.calendar-close" },
        { keys: "← → Home / End", labelKey: "setting.shortcuts.resize-sidebar" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <KeyboardIcon />
            {t("setting.shortcuts.open")}
          </Button>
        }
      />
      <DialogContent size="lg" className="max-h-[80dvh]">
        <DialogHeader>
          <DialogTitle>{t("setting.shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("setting.shortcuts.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto py-1">
          {groups.map((group) => (
            <section key={group.titleKey} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">{t(group.titleKey)}</h3>
              <ul className="flex flex-col gap-1.5">
                {group.rows.map((row) => (
                  <li key={`${group.titleKey}-${row.keys}-${row.labelKey}`} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground">{t(row.labelKey)}</span>
                    <kbd className="shrink-0 rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
                      {row.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;
