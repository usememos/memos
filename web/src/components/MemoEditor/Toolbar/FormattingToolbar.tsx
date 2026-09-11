import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  type LucideIcon,
  Minimize2Icon,
  MoreHorizontalIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef, type MouseEventHandler, type RefObject, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import {
  EDITOR_COMMANDS,
  type EditorCommand,
  type EditorCommandId,
  isCommandActive,
  type ToolbarHeadingLevel,
} from "../formatting/commands";
import { isCompactWidth, useEditorActiveState, useElementWidth } from "../hooks";
import type { EditorController } from "../types";

interface FormattingToolbarProps {
  controllerRef: RefObject<EditorController | null>;
  /**
   * Trailing dismiss button for the frame the editor sits in: "minimize" collapses
   * focus mode back into the page, "close" dismisses a host-owned frame. Omitted on
   * the inline normal-mode toolbar, which has no frame to leave.
   */
  exit?: { action: "minimize" | "close"; onExit: () => void };
  /** Extra classes for the host to frame the toolbar row. */
  className?: string;
}

const MARK_COMMANDS = EDITOR_COMMANDS.filter((command) => command.group === "mark");
const BLOCK_COMMANDS = EDITOR_COMMANDS.filter((command) => command.group === "block");
// Paragraph + headings render as a single icon dropdown (a closed set); the
// trigger glyph reflects the current block level.
const HEADING_COMMANDS = EDITOR_COMMANDS.filter((command) => command.group === "heading");
const HEADING_LEVEL_ICONS: Record<ToolbarHeadingLevel, LucideIcon> = { 1: Heading1Icon, 2: Heading2Icon, 3: Heading3Icon };

interface ToolbarButton {
  Icon?: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

// Command buttons must not take focus on mousedown — that blurs the editor and
// drops the selection the command targets. The click still fires and applies the
// format to the live selection.
const preventFocusSteal: MouseEventHandler<HTMLButtonElement> = (event) => event.preventDefault();

/**
 * Formatting toolbar: a lean inline row of the heading picker plus mark/block
 * controls, every one derived from the shared command catalog
 * (formatting/commands.ts), so adding a verb there surfaces it here automatically.
 * Groups are separated by thin vertical dividers. Responsive: below
 * COMPACT_TOOLBAR_WIDTH the block controls fold into a "more" menu while marks
 * stay inline. When the editor sits in a frame, the button that dismisses it is
 * pushed to the far edge.
 */
export function FormattingToolbar({ controllerRef, exit, className }: FormattingToolbarProps) {
  const t = useTranslate();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const compact = isCompactWidth(width);
  const active = useEditorActiveState(controllerRef);

  const run = (id: EditorCommandId) => controllerRef.current?.formatting?.run(id);

  // Menus grab focus while open and hand it back to their trigger on close; send
  // it to the editor instead so the user can keep typing after a pick.
  const returnFocusToEditor = () => {
    controllerRef.current?.focus();
    return false;
  };

  // Map a catalog command to a toolbar button.
  const toButton = (command: EditorCommand): ToolbarButton => ({
    Icon: command.icon,
    label: t(command.labelKey),
    active: isCommandActive(active, command.id),
    onClick: () => run(command.id),
  });

  // Type glyph for paragraph, else the matching Hn glyph. Deeper levels (H4–H6)
  // aren't toolbar-addressable and report as null, i.e. the Type glyph.
  const HeadingGlyph = active.headingLevel === null ? TypeIcon : HEADING_LEVEL_ICONS[active.headingLevel];
  const ExitIcon = exit?.action === "close" ? XIcon : Minimize2Icon;
  const exitLabel = exit && t(exit.action === "close" ? "common.close" : "editor.exit-focus-mode");
  const markButtons = MARK_COMMANDS.map(toButton);
  const blockButtons = BLOCK_COMMANDS.map(toButton);

  return (
    <div
      ref={rootRef}
      className={cn("w-full flex flex-row items-center gap-0.5", className)}
      role="toolbar"
      aria-label={t("editor.format.heading")}
    >
      <DropdownMenu>
        <DropdownMenuTrigger render={<SegmentButton Icon={HeadingGlyph} label={t("editor.format.heading")} />} />
        <DropdownMenuContent align="start" size="sm" finalFocus={returnFocusToEditor}>
          {HEADING_COMMANDS.map((command) => (
            <DropdownMenuItem key={command.id} onClick={() => run(command.id)}>
              {t(command.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      {markButtons.map((button) => (
        <SegmentButton key={button.label} {...button} onMouseDown={preventFocusSteal} />
      ))}

      <Divider />

      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<SegmentButton Icon={MoreHorizontalIcon} label={t("editor.format.more")} />} />
          <DropdownMenuContent align="start" size="sm" finalFocus={returnFocusToEditor}>
            {blockButtons.map((button) => (
              <DropdownMenuItem key={button.label} onClick={button.onClick}>
                {button.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        blockButtons.map((button) => <SegmentButton key={button.label} {...button} onMouseDown={preventFocusSteal} />)
      )}

      {exit && (
        <>
          <div className="flex-1" />
          <Button variant="quiet" size="icon-compact" aria-label={exitLabel} title={exitLabel} onClick={exit.onExit}>
            <ExitIcon className="size-4" strokeWidth={1.8} />
          </Button>
        </>
      )}
    </div>
  );
}

// Thin vertical rule between command groups (heading · marks · blocks).
function Divider() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border/70" />;
}

interface SegmentButtonProps extends ComponentPropsWithoutRef<"button"> {
  Icon?: LucideIcon;
  label: string;
  /** Toggle state; when set the segment gets aria-pressed and the active fill. */
  active?: boolean;
}

// The one segment element, shared by command toggles and dropdown triggers: the kit's
// quiet 28px square, so the toolbar container stays transparent and only the verb that
// is on carries the accent fill. Forwards ref + rest props so it also works as a Base UI
// `render` trigger (which injects its own onClick/aria attributes).
const SegmentButton = forwardRef<HTMLButtonElement, SegmentButtonProps>(({ Icon, label, active, ...rest }, ref) => (
  <Button ref={ref} variant="quiet" size="icon-compact" aria-label={label} aria-pressed={active} title={label} {...rest}>
    {Icon && <Icon className="size-4" strokeWidth={1.8} />}
  </Button>
));
SegmentButton.displayName = "SegmentButton";
