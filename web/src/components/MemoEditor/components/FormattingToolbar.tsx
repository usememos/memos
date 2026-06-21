import {
  BoldIcon,
  CodeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  type LucideIcon,
  Minimize2Icon,
  MoreHorizontalIcon,
} from "lucide-react";
import { type RefObject, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { isCompactWidth, useEditorActiveState, useElementWidth } from "../hooks";
import type { EditorController, FormattingController, ToolbarHeadingLevel } from "../types/editorController";

interface FormattingToolbarProps {
  controllerRef: RefObject<(EditorController & FormattingController) | null>;
  onExit: () => void;
  /** Extra classes for the host to frame the toolbar (e.g. the focus-mode header band). */
  className?: string;
}

const HEADING_LEVELS: ToolbarHeadingLevel[] = [1, 2, 3];

interface ToolbarButton {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Focus-mode header: a rich-text formatting toolbar driven entirely through the
 * editor controller. Purely presentational — owns no editor state beyond the
 * derived active-marks map. Responsive: below COMPACT_TOOLBAR_WIDTH the list and
 * link controls fold into a "more" menu while marks stay inline.
 */
export function FormattingToolbar({ controllerRef, onExit, className }: FormattingToolbarProps) {
  const t = useTranslate();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const compact = isCompactWidth(width);
  const active = useEditorActiveState(controllerRef);

  const handleLink = () => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    if (controller.isActive("link")) {
      controller.toggleLink();
      return;
    }
    const url = window.prompt(t("editor.format.link-prompt"));
    if (!url) {
      return;
    }
    const selected = controller.getSelectedText();
    if (selected) {
      controller.toggleLink(url);
    } else {
      controller.insertMarkdown(`[${url}](${url})`);
    }
  };

  const headingLabel = active.headingLevel === null ? t("editor.format.paragraph") : t(`editor.format.heading-${active.headingLevel}`);

  // One descriptor per control drives both layouts, so each action's icon,
  // label, active flag, and command live in a single place.
  const markButtons: ToolbarButton[] = [
    { Icon: BoldIcon, label: t("editor.format.bold"), active: active.bold, onClick: () => controllerRef.current?.toggleBold() },
    { Icon: ItalicIcon, label: t("editor.format.italic"), active: active.italic, onClick: () => controllerRef.current?.toggleItalic() },
    { Icon: CodeIcon, label: t("editor.format.code"), active: active.code, onClick: () => controllerRef.current?.toggleCode() },
  ];
  const listButtons: ToolbarButton[] = [
    {
      Icon: ListIcon,
      label: t("editor.format.bullet-list"),
      active: active.bulletList,
      onClick: () => controllerRef.current?.toggleBulletList(),
    },
    {
      Icon: ListOrderedIcon,
      label: t("editor.format.ordered-list"),
      active: active.orderedList,
      onClick: () => controllerRef.current?.toggleOrderedList(),
    },
    {
      Icon: ListTodoIcon,
      label: t("editor.format.task-list"),
      active: active.taskList,
      onClick: () => controllerRef.current?.toggleTaskList(),
    },
  ];
  const linkButton: ToolbarButton = { Icon: LinkIcon, label: t("editor.format.link"), active: active.link, onClick: handleLink };

  return (
    <div
      ref={rootRef}
      className={cn("w-full flex flex-row items-center gap-1 flex-nowrap", className)}
      role="toolbar"
      aria-label={t("editor.format.heading")}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t("editor.format.heading")}>
            <HeadingIcon className="w-4 h-4" />
            {!compact && <span className="ml-1 text-xs">{headingLabel}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => controllerRef.current?.setParagraph()}>{t("editor.format.paragraph")}</DropdownMenuItem>
          {HEADING_LEVELS.map((level) => (
            <DropdownMenuItem key={level} onClick={() => controllerRef.current?.setHeading(level)}>
              {t(`editor.format.heading-${level}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      {markButtons.map((button) => (
        <FmtButton key={button.label} {...button} />
      ))}

      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("editor.format.more")}>
              <MoreHorizontalIcon className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {listButtons.map((button) => (
              <DropdownMenuItem key={button.label} onClick={button.onClick}>
                {button.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={linkButton.onClick}>{linkButton.label}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <Divider />
          {listButtons.map((button) => (
            <FmtButton key={button.label} {...button} />
          ))}
          <Divider />
          <FmtButton {...linkButton} />
        </>
      )}

      <div className="flex-1" />

      <Button variant="ghost" size="icon" aria-label={t("editor.exit-focus-mode")} title={t("editor.exit-focus-mode")} onClick={onExit}>
        <Minimize2Icon className="w-4 h-4" />
      </Button>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="w-px h-5 bg-border mx-1 shrink-0" />;
}

function FmtButton({ Icon, active, label, onClick }: ToolbarButton) {
  // Active state shown by switching the kit variant (prop-only, per the shadcn
  // kit usage policy) rather than overriding className.
  return (
    <Button variant={active ? "secondary" : "ghost"} size="icon" aria-label={label} aria-pressed={active} title={label} onClick={onClick}>
      <Icon className="w-4 h-4" />
    </Button>
  );
}
