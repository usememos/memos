import { Fragment } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatShortcutKey, SHORTCUT_GROUPS, SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { type Translations, useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Key = ({ children }: { children: string }) => (
  <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-xs leading-none text-foreground">
    {children}
  </kbd>
);

const KeyboardShortcutsDialog = ({ open, onOpenChange }: Props) => {
  const t = useTranslate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" initialFocus finalFocus>
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("shortcuts.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map(({ group, labelKey }) => (
            <section key={group} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(labelKey as Translations)}</h3>
              <dl className="flex flex-col gap-1.5">
                {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between gap-4 text-sm">
                    <dt className="text-foreground">{t(shortcut.labelKey as Translations)}</dt>
                    <dd className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {shortcut.keys.map((binding, index) => (
                        <Fragment key={binding.join(" ")}>
                          {index > 0 && <span>/</span>}
                          {binding.map((key, keyIndex) => (
                            <Fragment key={key}>
                              {keyIndex > 0 && <span>{t("shortcuts.then")}</span>}
                              <Key>{formatShortcutKey(key)}</Key>
                            </Fragment>
                          ))}
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;
