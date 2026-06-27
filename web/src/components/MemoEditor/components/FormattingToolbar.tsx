import { HeadingIcon, type LucideIcon, Minimize2Icon, MoreHorizontalIcon } from "lucide-react";
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
import {
  EDITOR_COMMANDS,
  EDITOR_COMMANDS_BY_ID,
  type EditorCommand,
  type EditorCommandId,
  isCommandActive,
} from "../Editor/editorCommands";
import { isCompactWidth, useEditorActiveState, useElementWidth } from "../hooks";
import type { EditorController } from "../types/editorController";

interface FormattingToolbarProps {
  controllerRef: RefObject<EditorController | null>;
  onExit: () => void;
  /** Extra classes for the host to frame the toolbar (e.g. the focus-mode header band). */
  className?: string;
}

const MARK_COMMANDS = EDITOR_COMMANDS.filter((command) => command.group === "mark");
const LIST_COMMANDS = EDITOR_COMMANDS.filter((command) => command.group === "list");
// Paragraph + headings render as a single label-only dropdown (a closed set).
const HEADING_COMMANDS = EDITOR_COMMANDS.filter((command) => command.group === "heading");

interface ToolbarButton {
  Icon?: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Focus-mode header: a rich-text formatting toolbar driven entirely through the
 * editor controller's formatting capability. Every button is derived from the
 * shared command catalog (Editor/editorCommands.ts), so adding a verb there
 * surfaces it here automatically. Responsive: below COMPACT_TOOLBAR_WIDTH the
 * list and link controls fold into a "more" menu while marks stay inline.
 */
export function FormattingToolbar({ controllerRef, onExit, className }: FormattingToolbarProps) {
  const t = useTranslate();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const compact = isCompactWidth(width);
  const active = useEditorActiveState(controllerRef);

  const run = (id: EditorCommandId) => controllerRef.current?.formatting?.run(id);

  const handleLink = () => {
    const formatting = controllerRef.current?.formatting;
    if (!formatting) {
      return;
    }
    if (formatting.getActiveFormats().link) {
      formatting.run("link");
      return;
    }
    const url = window.prompt(t("editor.format.link-prompt"));
    if (!url) {
      return;
    }
    const selected = formatting.getSelectedText();
    if (selected) {
      formatting.run("link", { url });
    } else {
      controllerRef.current?.insertMarkdown(`[${url}](${url})`);
    }
  };

  // Map a catalog command to a toolbar button. `link` keeps its bespoke
  // prompt-then-apply flow; everything else just runs its command.
  const toButton = (command: EditorCommand): ToolbarButton => ({
    Icon: command.icon,
    label: t(command.labelKey),
    active: isCommandActive(active, command.id),
    onClick: command.id === "link" ? handleLink : () => run(command.id),
  });

  const headingLabel = active.headingLevel === null ? t("editor.format.paragraph") : t(`editor.format.heading-${active.headingLevel}`);
  const markButtons = MARK_COMMANDS.map(toButton);
  const listButtons = LIST_COMMANDS.map(toButton);
  const linkButton = toButton(EDITOR_COMMANDS_BY_ID.link);

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
          {HEADING_COMMANDS.map((command) => (
            <DropdownMenuItem key={command.id} onClick={() => run(command.id)}>
              {t(command.labelKey)}
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
      {Icon && <Icon className="w-4 h-4" />}
    </Button>
  );
}
