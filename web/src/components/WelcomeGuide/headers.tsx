import {
  AstroidIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  HashIcon,
  LibraryIcon,
  ListChecksIcon,
  LockIcon,
  MapIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar/MonthCalendar";
import { SIDEBAR_ROW_CLASSES, SidebarRowIconSlot, sidebarRowStateClasses } from "@/components/AppSidebar/SidebarRow";
import SidebarSection from "@/components/AppSidebar/SidebarSection";
import { sidebarSurfaceVariants } from "@/components/AppSidebar/sidebar-layout";
import { MEMO_CARD_BASE_CLASSES } from "@/components/MemoView/constants";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import VisibilityIcon from "@/components/VisibilityIcon";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

/**
 * The guide's page headers: still lifes of real components. Each is drawn with the
 * component's own classes and sample content, and none of it can be operated: the
 * whole header is decorative, so assistive technology reads the page's text instead.
 */

/** Fixed header height: every page shares it so the stacked pages never shift. */
const HEADER_CLASSES = "relative mx-7 h-[168px] shrink-0 overflow-hidden";

const Still = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div aria-hidden="true" className={cn(HEADER_CLASSES, "pointer-events-none select-none", className)}>
    {children}
  </div>
);

/** A tag as the editor renders it inside memo content. */
const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-primary bg-primary/15 px-1.5 py-0.5 align-baseline text-[0.9em] leading-none text-primary">
    #{children}
  </span>
);

const Task = ({ checked, children }: { checked?: boolean; children: ReactNode }) => (
  <div className="flex items-center gap-2 text-sm leading-[22px]">
    <Checkbox checked={checked} disabled tabIndex={-1} />
    <span className={cn(checked && "text-muted-foreground line-through")}>{children}</span>
  </div>
);

const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn(MEMO_CARD_BASE_CLASSES, "mb-0 shadow-xs", className)}>{children}</div>
);

const Meta = ({ time, children }: { time: string; children?: ReactNode }) => (
  <div className="flex h-6 w-full items-center gap-2 text-ui text-muted-foreground">
    <span>{time}</span>
    {children}
  </div>
);

const MetaActions = ({ visibility }: { visibility: Visibility }) => (
  <span className="ms-auto flex items-center gap-1">
    <VisibilityIcon visibility={visibility} />
    <MoreVerticalIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
  </span>
);

/** Intro: two memos, the newer in front, the older behind and cropped by the frame. */
export const IntroHeader = () => {
  const t = useTranslate();
  return (
    <Still>
      <Card className="absolute -top-7 left-5 -right-2 opacity-50">
        <Meta time={t("welcome.sample.yesterday")}>
          <MetaActions visibility={Visibility.PUBLIC} />
        </Meta>
        <p className="text-sm leading-[22px]">
          {t("welcome.sample.memo-preview")} <Tag>{t("welcome.sample.tag-design")}</Tag>
        </p>
      </Card>
      <Card className="absolute top-9 left-0 right-0">
        <Meta time={t("welcome.sample.today")}>
          <MetaActions visibility={Visibility.PRIVATE} />
        </Meta>
        <p className="text-sm leading-[22px]">
          {t("welcome.sample.memo-release")} <Tag>{t("welcome.sample.tag-project")}</Tag>
        </p>
        <Task checked>{t("welcome.sample.task-sketch")}</Task>
        <Task>{t("welcome.sample.task-polish")}</Task>
      </Card>
    </Still>
  );
};

/** Write: the composer at rest with Markdown already rendered as typed. */
export const WriteHeader = () => {
  const t = useTranslate();
  return (
    <Still>
      <div className="absolute top-5 left-0 right-0 flex flex-col gap-2 rounded-lg border border-border/70 bg-card px-3.5 py-3 shadow-xs">
        <p className="text-sm leading-[22px]">
          {t("welcome.sample.write-lead")} <strong>{t("welcome.sample.write-strong")}</strong> {t("welcome.sample.write-tail")}{" "}
          <Tag>{t("welcome.sample.tag-reading")}</Tag>
        </p>
        <Task>{t("welcome.sample.write-task")}</Task>
        <div className="mt-1 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md border border-border/80 bg-card">
            <PlusIcon className="size-4" strokeWidth={1.8} />
          </span>
          <span className="flex h-7 items-center gap-1 rounded-md px-2 text-ui text-muted-foreground">
            <LockIcon className="size-3.5" strokeWidth={1.8} />
            {t("memo.visibility.private")}
            <ChevronDownIcon className="size-3" strokeWidth={1.8} />
          </span>
          <span className="ms-auto flex h-7 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs">
            {t("editor.save")}
          </span>
        </div>
      </div>
    </Still>
  );
};

const currentMonth = () => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { month, today: now.getDate() };
};

/** Keep: this month's calendar beside the sidebar's tool row, Views and Tags. */
export const KeepHeader = () => {
  const t = useTranslate();
  const { month, today } = currentMonth();
  const days = [today, today - 1, today - 2, today - 9, today - 15].filter((day) => day >= 1);
  const data = Object.fromEntries(days.map((day, index) => [`${month}-${String(day).padStart(2, "0")}`, index === 0 ? 2 : 1]));
  const pillClasses = cn(sidebarSurfaceVariants({ role: "navPill" }), sidebarRowStateClasses("current"), "gap-1.5 px-2 text-[12px]");
  return (
    <Still className="grid gap-4 pt-1 sm:grid-cols-[minmax(0,1fr)_160px]">
      <div className="text-[12px]">
        <MonthCalendar month={month} data={data} />
      </div>
      {/* The sidebar fragment needs its own column; on a phone the calendar stands alone. */}
      <div className="hidden flex-col gap-3 sm:flex">
        <div className="flex items-center gap-1">
          <span className={pillClasses}>
            <LibraryIcon className="size-4 opacity-75" strokeWidth={1.8} />
            {t("common.timeline")}
            <ChevronDownIcon className="size-3 opacity-75" strokeWidth={1.8} />
          </span>
          <CalendarDaysIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
          <MapIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
          <PaperclipIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
          <SearchIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
        </div>
        <SidebarSection label={t("common.views")}>
          <span className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses("idle"))}>
            <SidebarRowIconSlot icon={ListChecksIcon} />
            <span className="min-w-0 flex-1 truncate">{t("welcome.sample.view")}</span>
          </span>
        </SidebarSection>
        <SidebarSection label={t("common.tags")}>
          {[
            [t("welcome.sample.tag-ideas"), 1],
            [t("welcome.sample.tag-project"), 2],
          ].map(([tag, count]) => (
            <span key={String(tag)} className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses("idle"))}>
              <SidebarRowIconSlot icon={HashIcon} />
              <span className="min-w-0 flex-1 truncate">{tag}</span>
              <span className="text-2xs text-muted-foreground/60 tabular-nums">{count}</span>
            </span>
          ))}
        </SidebarSection>
      </div>
    </Still>
  );
};

/** Share: a public memo in a space, with a comment beneath it. */
export const ShareHeader = () => {
  const t = useTranslate();
  return (
    <Still>
      <Card className="absolute top-4 left-0 right-0">
        <Meta time={t("welcome.sample.today-early")}>
          <Badge variant="outline" shape="pill">
            <AstroidIcon className="size-3" strokeWidth={1.8} />
            {t("welcome.sample.space")}
          </Badge>
          <MetaActions visibility={Visibility.PUBLIC} />
        </Meta>
        <p className="text-sm leading-[22px]">
          {t("welcome.sample.share-memo")} <Tag>{t("welcome.sample.tag-ideas")}</Tag>
        </p>
        <div className="mt-1 w-full border-t border-border/70 pt-2">
          <div className="flex items-center gap-1.5 text-ui">
            <UserAvatar className="size-4" name="alice" />
            <span className="font-medium text-foreground">alice</span>
            <span className="text-muted-foreground">{t("welcome.sample.comment-age")}</span>
          </div>
          <p className="ps-[22px] text-ui leading-[18px] text-foreground">{t("welcome.sample.comment")}</p>
        </div>
      </Card>
    </Still>
  );
};
