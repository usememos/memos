import {
  CalendarDaysIcon,
  CodeXmlIcon,
  HashIcon,
  ListChecksIcon,
  LockIcon,
  type LucideIcon,
  MapIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PenLineIcon,
  SparklesIcon,
  TextIcon,
  UsersIcon,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { IntroHeader, KeepHeader, ShareHeader, WriteHeader } from "./headers";

interface Row {
  icon: LucideIcon;
  label: string;
  text: string;
}

interface Page {
  icon: LucideIcon;
  title: string;
  sub: string;
  header: ReactNode;
  rows: Row[];
}

interface Props {
  open: boolean;
  /** Every way out counts the same: Skip, Done, Escape and a click outside. */
  onOpenChange: (open: boolean) => void;
}

/**
 * The welcome guide a new account sees once on Home: an intro, then Write, Keep and
 * Share. Each page is a still life of a real component over a few icon-and-line rows.
 *
 * All pages are laid out in one grid cell so the tallest sets the height and the footer,
 * which belongs to the dialog rather than to any page, never moves between pages.
 */
const WelcomeGuideDialog = ({ open, onOpenChange }: Props) => {
  const t = useTranslate();
  const [index, setIndex] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  const pages: Page[] = [
    {
      icon: SparklesIcon,
      title: t("welcome.title"),
      sub: t("welcome.headline"),
      header: <IntroHeader />,
      rows: [
        { icon: PenLineIcon, label: t("welcome.write"), text: t("welcome.intro-write") },
        { icon: CalendarDaysIcon, label: t("welcome.keep"), text: t("welcome.intro-keep") },
        { icon: UsersIcon, label: t("welcome.share"), text: t("welcome.intro-share") },
      ],
    },
    {
      icon: PenLineIcon,
      title: t("welcome.write"),
      sub: t("welcome.write-sub"),
      header: <WriteHeader />,
      rows: [
        { icon: TextIcon, label: t("welcome.no-title"), text: t("welcome.no-title-text") },
        { icon: CodeXmlIcon, label: t("welcome.markdown"), text: t("welcome.markdown-text") },
        { icon: PaperclipIcon, label: t("welcome.attach"), text: t("welcome.attach-text") },
      ],
    },
    {
      icon: CalendarDaysIcon,
      title: t("welcome.keep"),
      sub: t("welcome.keep-sub"),
      header: <KeepHeader />,
      rows: [
        { icon: CalendarDaysIcon, label: t("common.calendar"), text: t("welcome.calendar-text") },
        { icon: HashIcon, label: t("common.tags"), text: t("welcome.tags-text") },
        { icon: ListChecksIcon, label: t("common.views"), text: t("welcome.views-text") },
        { icon: MapIcon, label: t("common.map"), text: t("welcome.map-text") },
      ],
    },
    {
      icon: UsersIcon,
      title: t("welcome.share"),
      sub: t("welcome.share-sub"),
      header: <ShareHeader />,
      rows: [
        { icon: LockIcon, label: t("common.visibility"), text: t("welcome.visibility-text") },
        { icon: UsersIcon, label: t("space.spaces"), text: t("welcome.spaces-text") },
        { icon: MessageSquareIcon, label: t("welcome.comments"), text: t("welcome.comments-text") },
      ],
    },
  ];
  const last = index === pages.length - 1;

  const go = (next: number) => setIndex(Math.max(0, Math.min(pages.length - 1, next)));
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setIndex(0);
    onOpenChange(nextOpen);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent chrome="guide" showCloseButton={false} initialFocus={nextRef} onKeyDown={handleKeyDown}>
        <div className="grid">
          {pages.map((page, pageIndex) => {
            const active = pageIndex === index;
            return (
              <section
                key={page.title}
                className={cn("col-start-1 row-start-1 flex flex-col", !active && "invisible")}
                aria-hidden={!active}
                inert={!active}
              >
                {page.header}
                <div className="flex flex-col px-8 pt-5 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <page.icon className="size-4" strokeWidth={1.8} />
                    </span>
                    {active ? (
                      <DialogTitle className="text-xl leading-[26px] tracking-[-0.012em]">{page.title}</DialogTitle>
                    ) : (
                      <span className="text-xl leading-[26px] font-semibold tracking-[-0.012em]">{page.title}</span>
                    )}
                  </div>
                  {active ? (
                    <DialogDescription className="mt-1.5 leading-[21px]">{page.sub}</DialogDescription>
                  ) : (
                    <p className="mt-1.5 text-sm leading-[21px] text-muted-foreground">{page.sub}</p>
                  )}
                  <ul className="mt-5 flex flex-col gap-3.5">
                    {page.rows.map((row) => (
                      <li key={row.label} className="grid grid-cols-[104px_1fr] items-start gap-4 text-sm leading-[21px]">
                        <span className="flex items-center gap-1.5">
                          <row.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                          <span className="font-medium text-foreground">{row.label}</span>
                        </span>
                        <p className="min-w-0 text-foreground">{row.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-7 pt-4 pb-6">
          <Button
            variant="quiet"
            size="sm"
            className={cn(last && "invisible")}
            tabIndex={last ? -1 : undefined}
            onClick={() => handleOpenChange(false)}
          >
            {t("welcome.skip")}
          </Button>
          <div
            className="flex flex-1 items-center justify-center gap-1.5"
            role="group"
            aria-label={t("welcome.page-of", { current: index + 1, total: pages.length })}
          >
            {pages.map((page, pageIndex) => (
              <button
                key={page.title}
                type="button"
                aria-label={page.title}
                aria-current={pageIndex === index ? "step" : undefined}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  pageIndex === index ? "bg-foreground" : "bg-border hover:bg-muted-foreground/50",
                )}
                onClick={() => go(pageIndex)}
              />
            ))}
          </div>
          <Button ref={nextRef} onClick={() => (last ? handleOpenChange(false) : go(index + 1))}>
            {last ? t("welcome.done") : t("welcome.next")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeGuideDialog;
